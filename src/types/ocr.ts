import type { Currency, Market } from './account';

/** OCR 인식 결과 (원시) */
export interface OcrResult {
  text: string;
  confidence: number;
  lines: OcrLine[];
}

/** OCR 인식 행 */
export interface OcrLine {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

/** OCR로 파싱된 보유 종목 */
export interface ParsedHolding {
  ticker: string;
  name: string;
  quantity: number;
  avgPrice: number;
  evalAmount: number;
  currency: Currency;
  market: Market;
  confidence: number;
}

/** 파싱 결과 */
export interface ParseResult {
  holdings: ParsedHolding[];
  broker: string;
  overallConfidence: number;
  rawText: string;
}
