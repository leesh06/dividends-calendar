/**
 * 배당 데이터 수집기
 * - 미국 ETF: Yahoo Finance (비공식 API, 무료)
 * - 한국 ETF: 삼성자산운용(KODEX) API + 미래에셋(TIGER) API
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

  /** YYYYMMDD → YYYY-MM-DD */
  function formatDate_(dateStr) {
    if (!dateStr || dateStr.length < 8) return '';
    var s = dateStr.toString();
    return s.substring(0, 4) + '-' + s.substring(4, 6) + '-' + s.substring(6, 8);
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

  /** HTTP POST */
  function httpPost_(url, payload, headers) {
    var options = {
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      payload: payload,
      muteHttpExceptions: true
    };
    if (headers) options.headers = headers;
    var res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() !== 200) {
      Logger.log('HTTP POST 오류: ' + res.getResponseCode() + ' - ' + url);
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

  /** 종목명에서 운용사 판별 */
  function detectAssetManager_(name) {
    if (!name) return 'unknown';
    var n = name.toUpperCase();
    if (n.indexOf('KODEX') >= 0) return 'kodex';
    if (n.indexOf('TIGER') >= 0) return 'tiger';
    return 'unknown';
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

  var KODEX_API = 'https://m.samsungfund.com/api/v1/kodex/distribution.do';
  var TIGER_API = 'https://investments.miraeasset.com/tigeretf/ko/distribution/overall/list.ajax';

  return {
    /**
     * 미국 ETF 배당 수집 (Yahoo Finance)
     * 무료, API 키 불필요
     */
    fetchUsDividends: function() {
      var tickers = getTickersByMarket_('US');
      var tickerList = Object.keys(tickers);
      if (tickerList.length === 0) {
        Logger.log('미국 ETF 종목 없음 - 건너뜀');
        return;
      }

      Logger.log('미국 ETF ' + tickerList.length + '종목 배당 수집 시작 (Yahoo Finance)');

      tickerList.forEach(function(ticker) {
        var url = YAHOO_BASE + ticker + '?range=2y&interval=1mo&events=div';
        var result = httpGet_(url, { 'User-Agent': 'Mozilla/5.0' });

        if (!result || !result.chart || !result.chart.result) return;
        var chartData = result.chart.result[0];
        if (!chartData.events || !chartData.events.dividends) return;

        var dividends = chartData.events.dividends;
        var divCount = Object.keys(dividends).length;

        Object.keys(dividends).forEach(function(key) {
          var div = dividends[key];
          upsertDividend_({
            ticker: ticker,
            name: tickers[ticker],
            exDate: tsToDate_(parseInt(key)),
            payDate: tsToDate_(div.date),
            amount: Math.round(div.amount * 10000) / 10000,
            currency: 'USD',
            frequency: guessFrequency_(divCount),
            status: 'actual',
            source: 'yahoo'
          });
        });

        Utilities.sleep(500);
      });

      Logger.log('미국 ETF 배당 수집 완료');
    },

    /** KODEX 분배금 수집 */
    fetchKodexDividends: function() {
      var tickers = getTickersByMarket_('KR');
      var kodexTickers = {};
      Object.keys(tickers).forEach(function(ticker) {
        if (detectAssetManager_(tickers[ticker]) === 'kodex') {
          kodexTickers[ticker] = tickers[ticker];
        }
      });

      var tickerList = Object.keys(kodexTickers);
      if (tickerList.length === 0) return;

      Logger.log('KODEX ' + tickerList.length + '종목 분배금 수집');

      tickerList.forEach(function(ticker) {
        var url = KODEX_API + '?pageNo=1&ordrColm=DIVID_Y&period=1&ordrSort=DESC&srchVal=' + ticker;
        var result = httpGet_(url, { 'User-Agent': 'Mozilla/5.0' });
        if (!result || !result.dividList) return;

        result.dividList.forEach(function(item) {
          upsertDividend_({
            ticker: item.stkTicker || ticker,
            name: item.fNm || kodexTickers[ticker],
            exDate: formatDate_(item.basicD),
            payDate: formatDate_(item.payD),
            amount: parseFloat(item.dividA) || 0,
            currency: 'KRW',
            frequency: guessFrequency_(result.dividList.length),
            status: 'actual',
            source: 'kodex'
          });
        });
        Utilities.sleep(500);
      });
    },

    /** TIGER 분배금 수집 */
    fetchTigerDividends: function() {
      var tickers = getTickersByMarket_('KR');
      var tigerTickers = {};
      Object.keys(tickers).forEach(function(ticker) {
        if (detectAssetManager_(tickers[ticker]) === 'tiger') {
          tigerTickers[ticker] = tickers[ticker];
        }
      });

      var tickerList = Object.keys(tigerTickers);
      if (tickerList.length === 0) return;

      Logger.log('TIGER ' + tickerList.length + '종목 분배금 수집');
      var currentYear = new Date().getFullYear();

      tickerList.forEach(function(ticker) {
        [currentYear, currentYear - 1].forEach(function(year) {
          var payload = 'year=' + year + '&month=&ordrColm=DISTB_RATE&ordrSort=DESC&srchText=' + ticker;
          var result = httpPost_(TIGER_API, payload, {
            'Referer': 'https://investments.miraeasset.com/tigeretf/ko/distribution/overall/list.do',
            'User-Agent': 'Mozilla/5.0'
          });
          if (!result || !result.list) return;

          result.list.forEach(function(item) {
            upsertDividend_({
              ticker: ticker,
              name: item.itemNm || tigerTickers[ticker],
              exDate: formatDate_(item.stddDt),
              payDate: formatDate_(item.realPayDt),
              amount: parseFloat(item.perDistbAmt) || 0,
              currency: 'KRW',
              frequency: guessFrequency_(result.list.length),
              status: 'actual',
              source: 'tiger'
            });
          });
        });
        Utilities.sleep(500);
      });
    },

    /** 한국 ETF 전체 */
    fetchKrDividends: function() {
      this.fetchKodexDividends();
      this.fetchTigerDividends();
    },

    /** 전체 수집 */
    fetchAll: function() {
      this.fetchUsDividends();
      this.fetchKrDividends();
    }
  };
})();
