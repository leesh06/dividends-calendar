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

  /** dividends 시트에 upsert */
  function upsertDividend_(dividend) {
    var ss = SpreadsheetApp.openById(
      PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
    );
    var sheet = ss.getSheetByName('dividends');
    if (!sheet) return;

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var tickerCol = headers.indexOf('ticker');
    var exDateCol = headers.indexOf('exDate');

    for (var i = 1; i < data.length; i++) {
      if (data[i][tickerCol] === dividend.ticker &&
          data[i][exDateCol] === dividend.exDate) {
        var row = [
          data[i][0], dividend.ticker, dividend.name,
          dividend.exDate, dividend.payDate,
          dividend.amount, dividend.currency,
          dividend.frequency, dividend.status,
          dividend.source, today_()
        ];
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return;
      }
    }

    sheet.appendRow([
      generateId_(), dividend.ticker, dividend.name,
      dividend.exDate, dividend.payDate,
      dividend.amount, dividend.currency,
      dividend.frequency, dividend.status,
      dividend.source, today_()
    ]);
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

    var currency = market === 'US' ? 'USD' : 'KRW';
    var roundDigits = market === 'US' ? 10000 : 1;
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

      var dividends = chartData.events.dividends;
      var divCount = Object.keys(dividends).length;

      Object.keys(dividends).forEach(function(key) {
        var div = dividends[key];
        var amount = market === 'US'
          ? Math.round(div.amount * roundDigits) / roundDigits
          : Math.round(div.amount);

        upsertDividend_({
          ticker: ticker,
          name: tickers[ticker],
          exDate: tsToDate_(parseInt(key)),
          payDate: tsToDate_(div.date),
          amount: amount,
          currency: currency,
          frequency: guessFrequency_(divCount),
          status: 'actual',
          source: 'yahoo'
        });
      });

      Utilities.sleep(500);
    });

    Logger.log(market + ' 배당 수집 완료');
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
