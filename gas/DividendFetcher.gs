/**
 * 배당 데이터 수집기
 * - 미국 ETF: Yahoo Finance (티커 그대로)
 * - 한국 ETF: Yahoo Finance (티커 + .KS)
 * 모든 운용사(KODEX, TIGER, PLUS, RISE, ACE 등) 통합 커버
 */
var DividendFetcher = (function() {
  var YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

  /** 고유 ID 생성 */
  function generateId_() {
    return 'div_' + Utilities.getUuid().substring(0, 8);
  }

  /** 현재 날짜 ISO */
  function today_() {
    return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  }

  /** 타임스탬프 → YYYY-MM-DD */
  function tsToDate_(ts) {
    var d = new Date(ts * 1000);
    return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
  }

  /** HTTP GET */
  function httpGet_(url, headers) {
    var options = { muteHttpExceptions: true };
    if (headers) options.headers = headers;
    var res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() !== 200) {
      Logger.log('HTTP GET 오류: ' + res.getResponseCode() + ' - ' + url);
      return null;
    }
    return JSON.parse(res.getContentText());
  }

  /** holdings 시트에서 시장별 티커 목록 */
  function getTickersByMarket_(market) {
    var holdings = SheetsService.getHoldings();
    var tickers = {};
    holdings.forEach(function(h) {
      if (h.market === market && h.ticker) {
        tickers[h.ticker] = h.name;
      }
    });
    return tickers;
  }

  /** 배당 빈도 추정 */
  function guessFrequency_(count) {
    if (count >= 10) return 'monthly';
    if (count >= 3) return 'quarterly';
    return 'annual';
  }

  /**
   * dividends 시트를 1회만 읽어 기존 배당 키 인덱스 생성
   * (기존에는 배당 1건마다 전체 시트를 재조회 → 시트가 클수록 기하급수로 느려짐)
   */
  function loadDividendContext_() {
    var ss = SpreadsheetApp.openById(
      PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
    );
    var sheet = ss.getSheetByName('dividends');
    if (!sheet) throw new Error('dividends 시트를 찾을 수 없습니다.');

    var tz = ss.getSpreadsheetTimeZone();
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var tickerCol = headers.indexOf('ticker');
    var exDateCol = headers.indexOf('exDate');
    var index = {};

    for (var i = 1; i < data.length; i++) {
      var ticker = String(data[i][tickerCol]).trim();
      if (!ticker) continue;
      index[dividendKey_(ticker, data[i][exDateCol], tz)] = true;
    }
    return { sheet: sheet, tz: tz, index: index };
  }

  /** 신규 배당 행 일괄 추가 (appendRow 반복 대신 setValues 1회) */
  function appendDividendRows_(ctx, rows) {
    if (rows.length === 0) return;
    var startRow = ctx.sheet.getLastRow() + 1;
    ctx.sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
  }

  /** Yahoo 응답에서 시트에 없는 배당만 골라 newRows에 적재 */
  function collectTickerDividends_(ticker, name, market, events, ctx, newRows) {
    var currency = market === 'US' ? 'USD' : 'KRW';
    var roundDigits = market === 'US' ? 10000 : 1;
    var divCount = Object.keys(events).length;

    Object.keys(events).forEach(function(key) {
      var div = events[key];
      var exDate = tsToDate_(parseInt(key));
      var divKey = dividendKey_(ticker, exDate, ctx.tz);
      if (ctx.index[divKey]) return;
      ctx.index[divKey] = true;

      var amount = market === 'US'
        ? Math.round(div.amount * roundDigits) / roundDigits
        : Math.round(div.amount);

      newRows.push([
        generateId_(), ticker, name,
        exDate, tsToDate_(div.date),
        amount, currency,
        guessFrequency_(divCount), 'actual',
        'yahoo', today_()
      ]);
    });
  }

  /**
   * Yahoo Finance에서 배당 수집 (US/KR 공통)
   * @param {string} market - 'US' 또는 'KR'
   */
  function fetchDividendsByMarket_(market) {
    var tickers = getTickersByMarket_(market);
    var tickerList = Object.keys(tickers);
    if (tickerList.length === 0) {
      Logger.log(market + ' 종목 없음 - 건너뜀');
      return;
    }

    var ctx = loadDividendContext_();
    var newRows = [];
    Logger.log(market + ' ' + tickerList.length + '종목 배당 수집 시작 (Yahoo Finance)');

    tickerList.forEach(function(ticker) {
      // 한국 ETF는 6자리 패딩 + .KS 접미사 추가
      var paddedTicker = padKrTicker_(ticker, market);
      var yahooTicker = market === 'KR' ? paddedTicker + '.KS' : ticker;
      var url = YAHOO_BASE + yahooTicker + '?range=2y&interval=1mo&events=div';
      var result = httpGet_(url, { 'User-Agent': 'Mozilla/5.0' });

      if (!result || !result.chart || !result.chart.result) return;
      var chartData = result.chart.result[0];
      if (!chartData.events || !chartData.events.dividends) return;

      collectTickerDividends_(
        ticker, tickers[ticker], market,
        chartData.events.dividends, ctx, newRows
      );

      Utilities.sleep(500);
    });

    appendDividendRows_(ctx, newRows);
    Logger.log(market + ' 배당 수집 완료: 신규 ' + newRows.length + '건');
  }

  return {
    /** 미국 ETF 배당 수집 */
    fetchUsDividends: function() {
      fetchDividendsByMarket_('US');
    },

    /** 한국 ETF 배당 수집 (Yahoo Finance .KS) */
    fetchKrDividends: function() {
      fetchDividendsByMarket_('KR');
    },

    /** 전체 수집 */
    fetchAll: function() {
      this.fetchUsDividends();
      this.fetchKrDividends();
    }
  };
})();
