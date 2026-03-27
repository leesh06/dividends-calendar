import type { OcrResult, ParsedHolding, ParseResult } from '../types';

const MIN_CONFIDENCE = 30;

/** 숫자 문자열에서 콤마/공백 제거 후 파싱 */
function parseNumber(str: string): number {
  const cleaned = str.replace(/[,\s]/g, '').replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** 티커 패턴 (미국 주식: 2~5 영문 대문자) */
const US_TICKER_PATTERN = /\b([A-Z]{2,5})\b/;

/** 한국 종목코드 패턴 (6자리 숫자) */
const KR_TICKER_PATTERN = /\b(\d{6})\b/;

/**
 * 키움증권 캡처 포맷 파싱 (미국 ETF)
 * 예상 포맷: 종목명 | 티커 | 수량 | 매입금액 | 평가금액
 */
export function parseKiumCapture(ocrResult: OcrResult): ParseResult {
  const holdings: ParsedHolding[] = [];
  const lines = ocrResult.lines.filter((l) => l.confidence > MIN_CONFIDENCE);

  for (const line of lines) {
    const text = line.text;
    const tickerMatch = text.match(US_TICKER_PATTERN);
    if (!tickerMatch) continue;

    const ticker = tickerMatch[1];
    const numbers = text.match(/[\d,]+\.?\d*/g) || [];
    const numValues = numbers.map(parseNumber).filter((n) => n > 0);

    if (numValues.length < 2) continue;

    // 숫자 배열에서 수량(정수), 금액(소수점 가능)을 추론
    const quantity = numValues.find((n) => n === Math.floor(n) && n < 10000) || numValues[0];
    const avgPrice = numValues.length >= 3 ? numValues[numValues.length - 2] : 0;
    const evalAmount = numValues[numValues.length - 1];

    // 티커 앞의 텍스트를 종목명으로 사용
    const nameEnd = text.indexOf(ticker);
    const name = nameEnd > 0 ? text.substring(0, nameEnd).trim() : ticker;

    holdings.push({
      ticker,
      name: name || ticker,
      quantity,
      avgPrice,
      evalAmount,
      currency: 'USD',
      market: 'US',
      confidence: line.confidence,
    });
  }

  return {
    holdings,
    broker: '키움증권',
    overallConfidence: ocrResult.confidence,
    rawText: ocrResult.text,
  };
}

/**
 * 삼성증권 캡처 포맷 파싱 (한국 ETF)
 * 예상 포맷: 종목명 | 계정명 | 평가손익 | 수량 | 평가금액
 */
export function parseSamsungCapture(ocrResult: OcrResult): ParseResult {
  const holdings: ParsedHolding[] = [];
  const lines = ocrResult.lines.filter((l) => l.confidence > MIN_CONFIDENCE);

  for (const line of lines) {
    const text = line.text;

    // ETF 관련 키워드 포함 여부 확인
    const isEtfLine =
      /KODEX|TIGER|KBSTAR|SOL|ACE|ARIRANG|HANARO|KOSEF/i.test(text) ||
      KR_TICKER_PATTERN.test(text);

    if (!isEtfLine) continue;

    const tickerMatch = text.match(KR_TICKER_PATTERN);
    const numbers = text.match(/[\d,]+/g) || [];
    const numValues = numbers.map(parseNumber).filter((n) => n > 0);

    if (numValues.length < 2) continue;

    // ETF 이름 추출 (숫자 앞의 한글+영문 부분)
    const nameMatch = text.match(/^(.+?)(?:\d|$)/);
    const name = nameMatch ? nameMatch[1].trim() : text.substring(0, 20).trim();

    const quantity = numValues.find((n) => n === Math.floor(n) && n < 100000) || numValues[0];
    const evalAmount = numValues[numValues.length - 1];

    holdings.push({
      ticker: tickerMatch ? tickerMatch[1] : '',
      name,
      quantity,
      avgPrice: 0,
      evalAmount,
      currency: 'KRW',
      market: 'KR',
      confidence: line.confidence,
    });
  }

  return {
    holdings,
    broker: '삼성증권',
    overallConfidence: ocrResult.confidence,
    rawText: ocrResult.text,
  };
}

/** 증권사 자동 감지 후 파싱 */
export function autoParse(ocrResult: OcrResult): ParseResult {
  const text = ocrResult.text;

  // 키움증권 감지: 미국 티커가 많거나 USD/달러 언급
  const usTickerCount = (text.match(/\b[A-Z]{2,5}\b/g) || []).length;
  const hasUsdHint = /USD|달러|미국|키움/i.test(text);

  // 삼성증권 감지: 한국 ETF 키워드 또는 원화 언급
  const hasKrHint = /KODEX|TIGER|삼성|원화|KRW/i.test(text);

  if (hasKrHint && !hasUsdHint) {
    return parseSamsungCapture(ocrResult);
  }
  if (usTickerCount >= 2 || hasUsdHint) {
    return parseKiumCapture(ocrResult);
  }

  // 양쪽 다 시도 후 결과가 더 많은 쪽 선택
  const kiumResult = parseKiumCapture(ocrResult);
  const samsungResult = parseSamsungCapture(ocrResult);

  return kiumResult.holdings.length >= samsungResult.holdings.length
    ? kiumResult
    : samsungResult;
}
