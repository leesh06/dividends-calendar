/**
 * OpenAI GPT-4o-mini를 활용한 증권사 캡처 이미지 분석
 * - 이미지에서 종목명, 티커, 수량, 매입금액, 평가금액 추출
 * - 종목별로 시장(US/KR) 자동 판별 (증권사 무관, 한 캡처에 미국/한국 혼재 OK)
 */
var GeminiOcr = (function() {
  var OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

  /** API 키 조회 */
  function getApiKey_() {
    return PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  }

  /** 캡처 분석 프롬프트 */
  var PARSE_PROMPT = [
    '이 이미지는 한국 증권사 앱의 보유 종목 캡처 화면입니다.',
    '이미지에서 모든 보유 종목 정보를 추출하여 JSON으로 반환해주세요.',
    '',
    '각 종목에 대해 다음 필드를 추출하세요:',
    '- name: 종목명 (한글 또는 영문 이름)',
    '- ticker: 티커/종목코드',
    '  * 미국 ETF: 이미지에 보이는 영문 티커 그대로 (예: VCLT, VEA)',
    '  * 한국 ETF: 이미지에 종목코드가 보이면 그대로, 안 보이면 반드시 "UNKNOWN"',
    '  * 한국 종목코드는 보통 6자리이며, 숫자뿐 아니라 영문자가 섞인 코드(예: 0043Y0, 491A20)도 있습니다. 보이는 그대로 정확히 읽으세요.',
    '  * 절대로 종목코드를 추측하거나 지어내지 마세요. 이미지에 없으면 "UNKNOWN"입니다.',
    '- quantity: 보유 수량 (정수)',
    '- avgPrice: 주당 매입 평균가. 매입금액을 수량으로 나눈 값 (숫자)',
    '- currentPrice: 주당 현재가. 평가금액을 수량으로 나눈 값 (숫자)',
    '- evalAmount: 총 평가 금액 (숫자)',
    '- purchaseAmount: 총 매입 금액 (숫자, 없으면 0)',
    '- profitLoss: 평가 손익 (숫자, 없으면 0)',
    '- currency: 해당 종목의 실제 거래 통화. 미국 ETF는 반드시 "USD", 한국 ETF는 "KRW"',
    '- market: 시장 ("US" 또는 "KR")',
    '',
    '★★★ 시장 판별 - 각 종목마다 독립적으로 판단 ★★★',
    '증권사가 어디든 상관없이, 각 종목의 티커/이름을 보고 시장을 결정하세요.',
    '한 캡처에 미국 ETF와 한국 ETF가 섞여 있을 수 있습니다 (예: 키움증권에서 미국 ETF와 국내 ETF를 같이 보유).',
    '- 영문 티커 (VCLT, VEA, EMLC, SCHD, JEPI 등) → market="US", currency="USD"',
    '- 한글 종목명 + 6자리 종목코드(숫자 또는 영문 혼합) (KODEX, TIGER, PLUS, RISE, ACE, SOL, HANARO, TIME 등) → market="KR", currency="KRW"',
    '',
    '중요한 금액 처리 규칙 (종목별로 독립 적용):',
    '- 미국 ETF(영문 티커)의 경우만: 키움증권은 원화(KRW)로 표시되지만, 실제 거래 통화는 USD이므로 변환 필요',
    '  * 화면에 보이는 원화 금액을 환율 약 1450으로 나눠서 USD로 변환',
    '  * 예: 평가금액 46,325,228원, 수량 1231 → currentPrice = 46325228 / 1450 / 1231 = 약 25.95 USD',
    '  * 예: 매입금액 45,075,023원, 수량 1231 → avgPrice = 45075023 / 1450 / 1231 = 약 25.23 USD',
    '  * evalAmount, purchaseAmount, profitLoss 모두 USD로 변환',
    '- 한국 ETF(KODEX, TIGER 등)는 어느 증권사 캡처든 변환 없이 KRW 그대로 사용',
    '  * 키움증권 캡처에 KODEX가 있어도 KRW 그대로 (USD 변환 금지!)',
    '',
    '증권사 판별 (broker 필드용 - 화면 상단/UI 디자인으로 판단):',
    '- 키움증권 화면이면 broker="키움증권" (보유 종목은 미국/한국 ETF 둘 다 가능)',
    '- 삼성증권 화면이면 broker="삼성증권" (보유 종목은 미국/한국 ETF 둘 다 가능)',
    '- broker는 화면 디자인/로고로만 판별, 종목 시장 판별과는 별개입니다',
    '',
    '주의사항:',
    '- 반드시 이미지에 보이는 모든 종목을 빠짐없이 추출하세요. 종목명이 잘려 보여도 수량이 있으면 포함하세요.',
    '- 테이블의 각 행을 하나씩 확인하여 누락된 종목이 없는지 검증하세요.',
    '- 수량은 "보유수량", "가능수량", "매도가능" 컬럼에서 찾으세요',
    '- 숫자에서 쉼표는 제거하고 순수 숫자만 반환',
    '',
    '★★★ 가장 중요 - 현금/예수금 인식 ★★★',
    '반드시 종목 테이블뿐만 아니라 다른른 요약 테이블도 확인하세요!',
    '삼성증권 퇴직연금 화면에서는 상단에 "현금성자산"이라는 항목이 있고, 이것이 원화예수금입니다.',
    '예시: 이미지 상단에 "현금성자산 13,327,635"가 보이면 → ticker="CASH_KRW", name="원화예수금", quantity=1, avgPrice=13327635, currentPrice=13327635, evalAmount=13327635, currency="KRW", market="KR"',
    '',
    '예수금 인식 규칙:',
    '  * 이미지 전체(상단 요약, 종목 테이블, 하단)를 모두 스캔하세요.',
    '  * 키워드: "원화예수금", "예수금", "현금", "현금성자산", "외화예수금", "달러예수금"',
    '  * 키움증권: "원화예수금" 항목이 테이블 상단/하단에 있음',
    '  * 삼성증권: "현금성자산" 항목이 상단 요약 테이블에 있음 → 이것이 원화예수금',
    '- 원화예수금이 있으면 반드시 포함: ticker="CASH_KRW", name="원화예수금", quantity=1, avgPrice=금액, currentPrice=금액, evalAmount=금액, currency="KRW", market="KR"',
    '- 달러예수금이 있으면 반드시 포함: ticker="CASH_USD", name="달러예수금", quantity=1, avgPrice=금액, currentPrice=금액, evalAmount=금액, currency="USD", market="US"',
    '- 예수금이 0원이면 제외. 하지만 금액이 있으면 절대 누락하지 마세요.',
    '',
    '다음 JSON 형식으로만 반환하세요. 다른 텍스트 없이:',
    '{"broker": "키움증권" 또는 "삼성증권", "holdings": [종목 배열]}'
  ].join('\n');

  /** ticker_map 시트에서 종목명→종목코드 매핑 조회 */
  function getNameToTickerMap_() {
    var map = {};
    try {
      var ss = SpreadsheetApp.openById(
        PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
      );
      var sheet = ss.getSheetByName('ticker_map');
      if (!sheet) return map;
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][1]) {
          map[data[i][0]] = data[i][1].toString();
        }
      }
    } catch (e) {
      Logger.log('매핑 조회 실패 (무시): ' + e.message);
    }
    return map;
  }

  /** ticker_map 시트에 새 매핑 저장 */
  function saveToTickerMap_(name, ticker) {
    try {
      var ss = SpreadsheetApp.openById(
        PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
      );
      var sheet = ss.getSheetByName('ticker_map');
      if (!sheet) return;
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === name) return; // 이미 있으면 스킵
      }
      sheet.appendRow([name, ticker]);
    } catch (e) {
      Logger.log('매핑 저장 실패 (무시): ' + e.message);
    }
  }

  return {
    /**
     * 캡처 이미지 분석
     * @param {string} imageBase64 - base64 인코딩된 이미지
     * @returns {Object} { broker, holdings: [...] }
     */
    parseCapture: function(imageBase64) {
      var apiKey = getApiKey_();
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY가 설정되지 않았습니다. initSetup()을 다시 실행하세요.');
      }

      // data:image/png;base64, 형식 확인
      var imageUrl = imageBase64;
      if (imageBase64.indexOf('data:') !== 0) {
        imageUrl = 'data:image/png;base64,' + imageBase64;
      }

      var payload = {
        model: 'gpt-5.4-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a JSON-only response bot. Always respond with valid JSON, no markdown.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: PARSE_PROMPT },
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'high' }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 8192,
        temperature: 0.1
      };

      var res = UrlFetchApp.fetch(OPENAI_URL, {
        method: 'POST',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + apiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      if (res.getResponseCode() !== 200) {
        Logger.log('OpenAI API 오류: ' + res.getResponseCode());
        Logger.log(res.getContentText());
        throw new Error('OpenAI API 호출 실패: ' + res.getResponseCode());
      }

      var result = JSON.parse(res.getContentText());
      var text = result.choices[0].message.content;

      // JSON 블록 추출 (마크다운 코드블록 제거)
      var jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      var jsonStr = jsonMatch ? jsonMatch[1] : text;
      jsonStr = jsonStr.trim();

      // JSON 정리: 트레일링 콤마 제거, 싱글쿼트→더블쿼트
      jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      jsonStr = jsonStr.replace(/'/g, '"');

      var parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        Logger.log('JSON 파싱 실패, 재시도: ' + e.message);
        Logger.log('원문: ' + jsonStr.substring(0, 500));
        // { 부터 마지막 } 까지 추출 시도
        var braceMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'));
        } else {
          throw new Error('GPT 응답을 JSON으로 파싱할 수 없습니다. 다시 시도해주세요.');
        }
      }

      // 배열이면 holdings로 감싸기
      if (Array.isArray(parsed)) {
        parsed = { broker: '알 수 없음', holdings: parsed };
      }

      // holdings 시트에서 종목명→종목코드 매핑 적용
      var nameMap = getNameToTickerMap_();
      parsed.holdings.forEach(function(h) {
        if (h.ticker === 'UNKNOWN' && nameMap[h.name]) {
          h.ticker = nameMap[h.name];
        }
      });

      var unknownCount = parsed.holdings.filter(function(h) { return h.ticker === 'UNKNOWN'; }).length;
      Logger.log('OpenAI OCR 결과: ' + parsed.holdings.length + '종목 인식 (증권사: ' + parsed.broker + ', 미매핑: ' + unknownCount + ')');
      return parsed;
    }
  };
})();
