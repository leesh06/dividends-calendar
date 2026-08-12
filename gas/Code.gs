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
      case 'deleteAccount':
        data = SheetsService.deleteAccount(body.accountId);
        break;
      case 'deleteHolding':
        data = SheetsService.deleteHolding(body.accountId, body.ticker);
        break;
      case 'resetAll':
        data = SheetsService.resetAll();
        break;
      case 'dedupeDividends':
        data = SheetsService.dedupeDividends();
        break;
      case 'fetchDividends':
        DividendFetcher.fetchAll();
        data = { success: true };
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

/** 한국 종목코드 6자리 패딩 (Sheets가 숫자로 저장해서 앞자리 0이 빠지는 문제 대응)
 *  KRX 2024 개편으로 영숫자 혼합 코드(예: 0043Y0)도 존재 → 영숫자 모두 패딩 대상 */
function padKrTicker_(ticker, market) {
  var t = ticker.toString().trim().toUpperCase();
  if (market === 'KR' && /^[0-9A-Z]+$/.test(t) && t.indexOf('CASH') !== 0) {
    while (t.length < 6) t = '0' + t;
  }
  return t;
}

/** 시트 시간대 설정이 비어있을 때 사용할 기본값
 *  (이 시트의 날짜 셀은 UTC 자정으로 저장돼 있음 → GMT 기준이 원본 날짜와 일치) */
var DEFAULT_SHEET_TZ = 'Etc/GMT';

/**
 * 배당 고유 키 (ticker + exDate)
 * 시트에서 읽은 exDate는 Date 객체, 신규 수집분은 'yyyy-MM-dd' 문자열이라
 * 반드시 문자열로 정규화 후 비교해야 함 (타입 불일치 → 중복 적재 버그의 원인)
 */
function dividendKey_(ticker, exDate, tz) {
  var zone = (typeof tz === 'string' && tz) ? tz : DEFAULT_SHEET_TZ;
  var dateStr = exDate instanceof Date
    ? Utilities.formatDate(exDate, zone, 'yyyy-MM-dd')
    : String(exDate).slice(0, 10);
  return String(ticker).trim() + '_' + dateStr;
}

/** 환율 유효성 범위 (USD/KRW가 이 범위를 벗어나면 비정상으로 간주) */
var RATE_MIN = 800;
var RATE_MAX = 3000;
/** GOOGLEFINANCE 수식을 넣을 임시 셀 위치 (settings 시트 사용) */
var GFIN_CELL = 'Z1';

/** 현재 시각 문자열 (KST) */
function nowKst_() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
}

/** 환율 값이 정상 범위인지 확인 */
function isValidRate_(rate) {
  return typeof rate === 'number' && rate >= RATE_MIN && rate <= RATE_MAX;
}

/**
 * 환율 조회 (GOOGLEFINANCE 메인 + Yahoo 폴백)
 * 구글파이낸스 값이 비정상이면 자동으로 Yahoo로 전환
 */
function getExchangeRate_() {
  var rate = getGoogleFinanceRate_();
  if (!isValidRate_(rate)) {
    rate = getYahooRate_();
  }
  if (!isValidRate_(rate)) {
    throw new Error('환율 조회 실패: 유효한 값 없음');
  }
  return { rate: rate, lastUpdated: nowKst_() };
}

/**
 * GOOGLEFINANCE로 USD/KRW 조회
 * settings 시트의 임시 셀에 수식을 넣고 값을 읽은 뒤 정리
 * 실패 시 null 반환 (폴백 유도)
 */
function getGoogleFinanceRate_() {
  try {
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    var sheet = SpreadsheetApp.openById(id).getSheetByName('settings');
    if (!sheet) return null;
    var cell = sheet.getRange(GFIN_CELL);
    cell.setFormula('=GOOGLEFINANCE("CURRENCY:USDKRW")');
    SpreadsheetApp.flush();
    var rate = cell.getValue();
    cell.clearContent();
    return typeof rate === 'number' ? rate : null;
  } catch (err) {
    return null;
  }
}

/** Yahoo Finance로 USD/KRW 조회 (폴백). 실패 시 null */
function getYahooRate_() {
  var url = YAHOO_CHART_BASE + 'USDKRW=X?range=1d&interval=1d';
  var res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (res.getResponseCode() !== 200) return null;
  var json = JSON.parse(res.getContentText());
  if (!json.chart || !json.chart.result) return null;
  return json.chart.result[0].meta.regularMarketPrice;
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
    var t = padKrTicker_(h.ticker, h.market);
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
