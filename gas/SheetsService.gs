/**
 * Google Sheets CRUD 서비스
 * 스프레드시트 ID는 스크립트 속성에서 관리
 */
var SheetsService = (function() {
  var SHEET_NAMES = {
    ACCOUNTS: 'accounts',
    HOLDINGS: 'holdings',
    DIVIDENDS: 'dividends',
    SETTINGS: 'settings'
  };

  /** 스프레드시트 객체 가져오기 */
  function getSpreadsheet_() {
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!id) throw new Error('SPREADSHEET_ID가 설정되지 않았습니다.');
    return SpreadsheetApp.openById(id);
  }

  /** 시트의 모든 데이터를 객체 배열로 변환 */
  function sheetToObjects_(sheetName) {
    var sheet = getSpreadsheet_().getSheetByName(sheetName);
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    var headers = data[0];
    var rows = data.slice(1);
    return rows.map(function(row) {
      var obj = {};
      headers.forEach(function(header, i) {
        obj[header] = row[i];
      });
      return obj;
    });
  }

  /** 고유 ID 생성 */
  function generateId_(prefix) {
    return prefix + '_' + Utilities.getUuid().substring(0, 8);
  }

  /** 현재 날짜 (ISO) */
  function today_() {
    return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  }

  return {
    /** 전체 데이터 일괄 조회 */
    getAll: function() {
      return {
        accounts: this.getAccounts(),
        holdings: this.getHoldings(),
        dividends: this.getDividends(),
        settings: this.getSettings()
      };
    },

    /** 계좌 목록 조회 */
    getAccounts: function() {
      return sheetToObjects_(SHEET_NAMES.ACCOUNTS);
    },

    /** 보유 종목 조회 (accountId 필터 옵션) */
    getHoldings: function(accountId) {
      var all = sheetToObjects_(SHEET_NAMES.HOLDINGS);
      if (!accountId) return all;
      return all.filter(function(h) { return h.accountId === accountId; });
    },

    /** 배당 데이터 조회 (month 필터 옵션, 형식: YYYY-MM) */
    getDividends: function(month) {
      var all = sheetToObjects_(SHEET_NAMES.DIVIDENDS);
      if (!month) return all;
      return all.filter(function(d) {
        return d.exDate && d.exDate.toString().substring(0, 7) === month;
      });
    },

    /** 설정 조회 (key-value 객체로 반환) */
    getSettings: function() {
      var rows = sheetToObjects_(SHEET_NAMES.SETTINGS);
      var settings = {};
      rows.forEach(function(row) {
        settings[row.key] = row.value;
      });
      return settings;
    },

    /** 보유 종목 upsert */
    upsertHoldings: function(accountId, holdings) {
      var sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.HOLDINGS);
      if (!sheet) throw new Error('holdings 시트를 찾을 수 없습니다.');

      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var tickerCol = headers.indexOf('ticker');
      var accountCol = headers.indexOf('accountId');
      var updated = 0;

      // ticker_map 시트에서 기존 매핑 로드
      var tickerMapSheet = getSpreadsheet_().getSheetByName('ticker_map');
      var existingMap = {};
      if (tickerMapSheet) {
        var mapData = tickerMapSheet.getDataRange().getValues();
        for (var m = 1; m < mapData.length; m++) {
          if (mapData[m][0]) existingMap[mapData[m][0]] = true;
        }
      }

      holdings.forEach(function(holding) {
        var existingRow = -1;
        for (var i = 1; i < data.length; i++) {
          if (data[i][accountCol] === accountId && data[i][tickerCol] === holding.ticker) {
            existingRow = i + 1;
            break;
          }
        }

        var row = [
          existingRow > 0 ? data[existingRow - 1][0] : generateId_('hld'),
          accountId,
          holding.ticker,
          holding.name,
          holding.quantity,
          holding.avgPrice,
          holding.currentPrice || 0,
          holding.currency,
          holding.market,
          today_()
        ];

        if (existingRow > 0) {
          sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
        } else {
          sheet.appendRow(row);
        }

        // 한국 ETF 종목코드를 ticker_map에 자동 저장
        if (holding.market === 'KR' && holding.ticker && holding.ticker !== 'UNKNOWN'
            && !holding.ticker.toString().startsWith('CASH') && !existingMap[holding.name]) {
          if (tickerMapSheet) {
            tickerMapSheet.appendRow([holding.name, holding.ticker]);
            existingMap[holding.name] = true;
          }
        }

        updated++;
      });

      return { updated: updated };
    },

    /** 계좌 추가 (같은 이름+증권사 계좌가 있으면 기존 계좌 반환) */
    addAccount: function(account) {
      var sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.ACCOUNTS);
      if (!sheet) throw new Error('accounts 시트를 찾을 수 없습니다.');

      // 같은 이름+증권사 계좌가 이미 있으면 기존 계좌 반환
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var nameCol = headers.indexOf('accountName');
      var brokerCol = headers.indexOf('broker');
      for (var i = 1; i < data.length; i++) {
        if (data[i][nameCol] === account.accountName && data[i][brokerCol] === account.broker) {
          var existing = {};
          headers.forEach(function(h, idx) { existing[h] = data[i][idx]; });
          return existing;
        }
      }

      var newAccount = {
        accountId: generateId_('acc'),
        accountName: account.accountName,
        broker: account.broker,
        currency: account.currency,
        isActive: account.isActive !== undefined ? account.isActive : true,
        createdAt: today_(),
        updatedAt: today_()
      };

      sheet.appendRow([
        newAccount.accountId,
        newAccount.accountName,
        newAccount.broker,
        newAccount.currency,
        newAccount.isActive,
        newAccount.createdAt,
        newAccount.updatedAt
      ]);

      return newAccount;
    },

    /** 계좌 삭제 (계좌 + 해당 보유종목 모두 삭제) */
    deleteAccount: function(accountId) {
      var ss = getSpreadsheet_();

      // 1. holdings 시트에서 해당 계좌 종목 삭제
      var holdingsSheet = ss.getSheetByName(SHEET_NAMES.HOLDINGS);
      if (holdingsSheet) {
        var hData = holdingsSheet.getDataRange().getValues();
        var hHeaders = hData[0];
        var hAccountCol = hHeaders.indexOf('accountId');
        for (var i = hData.length - 1; i >= 1; i--) {
          if (hData[i][hAccountCol] === accountId) {
            holdingsSheet.deleteRow(i + 1);
          }
        }
      }

      // 2. accounts 시트에서 계좌 삭제
      var accountsSheet = ss.getSheetByName(SHEET_NAMES.ACCOUNTS);
      if (accountsSheet) {
        var aData = accountsSheet.getDataRange().getValues();
        var aHeaders = aData[0];
        var aIdCol = aHeaders.indexOf('accountId');
        for (var j = aData.length - 1; j >= 1; j--) {
          if (aData[j][aIdCol] === accountId) {
            accountsSheet.deleteRow(j + 1);
          }
        }
      }

      return { deleted: accountId };
    },

    /** 보유 종목 삭제 (accountId + ticker 기준) */
    deleteHolding: function(accountId, ticker) {
      var sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.HOLDINGS);
      if (!sheet) throw new Error('holdings 시트를 찾을 수 없습니다.');

      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var tickerCol = headers.indexOf('ticker');
      var accountCol = headers.indexOf('accountId');
      var deleted = 0;

      for (var i = data.length - 1; i >= 1; i--) {
        var matchTicker = data[i][tickerCol] === ticker;
        var matchAccount = !accountId || data[i][accountCol] === accountId;
        if (matchTicker && matchAccount) {
          sheet.deleteRow(i + 1);
          deleted++;
        }
      }
      return { deleted: deleted };
    },

    /** 전체 초기화 (accounts + holdings 데이터 삭제, 빈 행 정리, 헤더 유지) */
    resetAll: function() {
      var ss = getSpreadsheet_();
      var sheetsToClean = [SHEET_NAMES.ACCOUNTS, SHEET_NAMES.HOLDINGS];
      var DATA_START_ROW = 2;
      var result = {};

      sheetsToClean.forEach(function(name) {
        var sheet = ss.getSheetByName(name);
        if (!sheet) return;
        var lastRow = sheet.getLastRow();
        if (lastRow >= DATA_START_ROW) {
          sheet.deleteRows(DATA_START_ROW, lastRow - DATA_START_ROW + 1);
        }
        result[name] = lastRow - DATA_START_ROW + 1;
      });

      // dividends 시트도 빈 행 정리 (데이터가 있는 행 중 ticker가 비어있는 행 제거)
      var divSheet = ss.getSheetByName(SHEET_NAMES.DIVIDENDS);
      if (divSheet) {
        var dData = divSheet.getDataRange().getValues();
        var dHeaders = dData[0];
        var dTickerCol = dHeaders.indexOf('ticker');
        var cleaned = 0;
        for (var i = dData.length - 1; i >= 1; i--) {
          var row = dData[i];
          var isEmpty = row.every(function(cell) {
            return cell === '' || cell === null || cell === undefined;
          });
          var noTicker = !row[dTickerCol] || row[dTickerCol].toString().trim() === '';
          if (isEmpty || noTicker) {
            divSheet.deleteRow(i + 1);
            cleaned++;
          }
        }
        result.dividendsCleaned = cleaned;
      }

      return result;
    },

    /** 설정 업데이트 */
    updateSetting: function(key, value) {
      var sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.SETTINGS);
      if (!sheet) throw new Error('settings 시트를 찾을 수 없습니다.');

      var data = sheet.getDataRange().getValues();
      var keyCol = 0;

      for (var i = 1; i < data.length; i++) {
        if (data[i][keyCol] === key) {
          sheet.getRange(i + 1, 2).setValue(value);
          sheet.getRange(i + 1, 3).setValue(today_());
          return;
        }
      }

      sheet.appendRow([key, value, today_()]);
    }
  };
})();
