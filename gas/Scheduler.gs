/**
 * 시간 기반 트리거 관리
 * 매일 오전 9시에 배당 데이터 자동 수집
 */

/** 일일 트리거 설정 (수동 실행 1회) */
function setupDailyTrigger() {
  // 기존 트리거 제거
  removeDailyTrigger();

  ScriptApp.newTrigger('dailyFetchDividends')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .inTimezone('Asia/Seoul')
    .create();

  Logger.log('일일 배당 수집 트리거가 설정되었습니다 (매일 오전 9시)');
}

/** 일일 트리거 제거 */
function removeDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'dailyFetchDividends') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

/** 트리거에서 호출되는 함수 */
function dailyFetchDividends() {
  Logger.log('배당 데이터 자동 수집 시작: ' + new Date().toISOString());

  try {
    DividendFetcher.fetchAll();

    // 마지막 동기화 시간 기록
    SheetsService.updateSetting(
      'lastSyncAt',
      new Date().toISOString()
    );

    Logger.log('배당 데이터 자동 수집 완료');
  } catch (err) {
    Logger.log('배당 데이터 수집 오류: ' + err.message);
  }
}

/** 수동 테스트용 함수 */
function manualFetchDividends() {
  dailyFetchDividends();
}

/** dividends 시트 초기화 후 다시 수집 */
function resetAndFetchDividends() {
  Logger.log('배당 데이터 초기화 시작: ' + new Date().toISOString());
  try {
    clearDividends_();
    Logger.log('dividends 시트 초기화 완료');
    DividendFetcher.fetchAll();
    SheetsService.updateSetting(
      'lastSyncAt',
      new Date().toISOString()
    );
    Logger.log('배당 데이터 재수집 완료');
  } catch (err) {
    Logger.log('배당 초기화/재수집 오류: ' + err.message);
  }
}

/** holdings의 현재가를 Yahoo Finance로 업데이트 */
function updateHoldingsQuotes() {
  Logger.log('현재가 업데이트 시작: ' + new Date().toISOString());
  try {
    var result = updateQuotes_();
    Logger.log('현재가 업데이트 완료: ' + result.updated + '건');
  } catch (err) {
    Logger.log('현재가 업데이트 오류: ' + err.message);
  }
}

/**
 * 초기 설정 (최초 1회 실행)
 * GAS 에디터에서 이 함수를 직접 실행하세요.
 */
function initSetup() {
  var props = PropertiesService.getScriptProperties();

  // 스프레드시트 ID 설정
  props.setProperty('SPREADSHEET_ID', '1zuclKEPmZFshRynnQqU9-DgnJR2s5SQDjUkt_uJAl5k');

  // Gemini API 키 (캡처 이미지 분석용)
  props.setProperty('GEMINI_API_KEY', 'AIzaSyDvvQTGgIm5hsOpYkT9ls2pVtDeyf2Fs8s');

  // Finnhub API 키 (https://finnhub.io 에서 무료 발급)
  // props.setProperty('FINNHUB_API_KEY', 'YOUR_API_KEY_HERE');

  Logger.log('초기 설정 완료!');
  Logger.log('SPREADSHEET_ID: ' + props.getProperty('SPREADSHEET_ID'));
  Logger.log('');
  Logger.log('다음 단계:');
  Logger.log('1. Finnhub API 키를 발급받아 위 주석을 해제하고 설정하세요');
  Logger.log('2. setupDailyTrigger() 함수를 실행하여 자동 수집을 시작하세요');
  Logger.log('3. 웹앱으로 배포하세요 (배포 > 새 배포 > 웹앱)');
}
