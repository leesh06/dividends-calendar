/**
 * Google Apps Script - 웹앱 엔드포인트
 * doGet: 데이터 조회
 * doPost: 데이터 저장/수정
 */

/** GET 요청 처리 */
function doGet(e) {
  try {
    var action = e.parameter.action;
    var data;

    switch (action) {
      case 'getAll':
        data = SheetsService.getAll();
        break;
      case 'getAccounts':
        data = SheetsService.getAccounts();
        break;
      case 'getHoldings':
        data = SheetsService.getHoldings(e.parameter.accountId);
        break;
      case 'getDividends':
        data = SheetsService.getDividends(e.parameter.month);
        break;
      case 'getSettings':
        data = SheetsService.getSettings();
        break;
      case 'getExchangeRate':
        data = getExchangeRate_();
        break;
      case 'getQuotes':
        data = getQuotes_();
        break;
      default:
        return jsonResponse_(false, null, '알 수 없는 action: ' + action);
    }

    return jsonResponse_(true, data, null);
  } catch (err) {
    return jsonResponse_(false, null, err.message);
  }
}

/** POST 요청 처리 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var data;

    switch (action) {
      case 'upsertHoldings':
        data = SheetsService.upsertHoldings(body.accountId, body.holdings);
        break;
      case 'addAccount':
        data = SheetsService.addAccount(body.account);
        break;
      case 'updateSetting':
        data = SheetsService.updateSetting(body.key, body.value);
        break;
      case 'parseCapture':
        data = GeminiOcr.parseCapture(body.imageBase64);
        break;
      case 'updateQuotes':
        data = updateQuotes_();
        break;
      case 'clearDividends':
        data = clearDividends_();
        break;
      default:
        return jsonResponse_(false, null, '알 수 없는 action: ' + action);
    }

    return jsonResponse_(true, data, null);
  } catch (err) {
    return jsonResponse_(false, null, err.message);
  }
}

var EXCHANGE_RATE_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
var YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

/** 환율 조회 (exchangerate-api.com - 무료) */
function getExchangeRate_() {
  var res = UrlFetchApp.fetch(EXCHANGE_RATE_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('환율 조회 실패: ' + res.getResponseCode());
  }
  var data = JSON.parse(res.getContentText());
  if (!data || !data.rates || !data.rates.KRW) {
    throw new Error('KRW 환율 없음');
  }
  return {
    rate: data.rates.KRW,
    lastUpdated: data.date
  };
}

/** Yahoo Finance로 단일 종목 현재가 조회 */
function fetchYahooQuote_(ticker) {
  var url = YAHOO_CHART_BASE + ticker.toString().trim() + '?range=1d&interval=1d';
  var res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (res.getResponseCode() !== 200) return null;
  var json = JSON.parse(res.getContentText());
  if (!json.chart || !json.chart.result) return null;
  return json.chart.result[0].meta.regularMarketPrice;
}

/** 보유종목 전체 현재가 일괄 조회 */
function getQuotes_() {
  var holdings = SheetsService.getHoldings();
  var quotes = {};
  var seen = {};
  holdings.forEach(function(h) {
    if (!h.ticker || seen[h.ticker]) return;
    seen[h.ticker] = true;
    var t = h.ticker.toString().trim();
    if (t.indexOf('CASH') === 0) return;
    var yahooTicker = h.market === 'KR'
      ? t + '.KS'
      : t;
    var price = fetchYahooQuote_(yahooTicker);
    if (price !== null) {
      quotes[h.ticker] = price;
    }
    Utilities.sleep(300);
  });
  return quotes;
}

/** holdings 시트의 currentPrice를 Yahoo 현재가로 업데이트 */
function updateQuotes_() {
  var quotes = getQuotes_();
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  );
  var sheet = ss.getSheetByName('holdings');
  if (!sheet) throw new Error('holdings 시트를 찾을 수 없습니다.');

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var tickerCol = headers.indexOf('ticker');
  var priceCol = headers.indexOf('currentPrice');
  var updatedCol = headers.indexOf('updatedAt');
  var updated = 0;
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');

  for (var i = 1; i < data.length; i++) {
    var ticker = data[i][tickerCol];
    if (quotes[ticker] !== undefined) {
      sheet.getRange(i + 1, priceCol + 1).setValue(quotes[ticker]);
      if (updatedCol >= 0) {
        sheet.getRange(i + 1, updatedCol + 1).setValue(now);
      }
      updated++;
    }
  }
  return { updated: updated };
}

/** dividends 시트 데이터 전부 삭제 (헤더 유지) */
function clearDividends_() {
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  );
  var sheet = ss.getSheetByName('dividends');
  if (!sheet) throw new Error('dividends 시트를 찾을 수 없습니다.');

  var lastRow = sheet.getLastRow();
  var DATA_START_ROW = 2;
  if (lastRow >= DATA_START_ROW) {
    sheet.deleteRows(DATA_START_ROW, lastRow - DATA_START_ROW + 1);
  }
  return { cleared: lastRow - DATA_START_ROW + 1 };
}

/** JSON 응답 헬퍼 */
function jsonResponse_(success, data, error) {
  var output = JSON.stringify({
    success: success,
    data: data,
    error: error
  });
  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}
