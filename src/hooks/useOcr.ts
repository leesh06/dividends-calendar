import { useState, useCallback } from 'react';
import { recognize } from '../services/ocrService';
import { autoParse } from '../utils/parsers';
import type { OcrResult, ParseResult } from '../types';

interface UseOcrReturn {
  /** OCR + 파싱 실행 */
  processImage: (image: File) => Promise<ParseResult | null>;
  /** OCR 원시 결과 */
  ocrResult: OcrResult | null;
  /** 파싱 결과 */
  parseResult: ParseResult | null;
  /** 신뢰도 점수 */
  confidence: number;
  /** 처리 중 여부 */
  isProcessing: boolean;
  /** 에러 */
  error: string | null;
  /** 결과 초기화 */
  reset: () => void;
}

export function useOcr(): UseOcrReturn {
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback(async (image: File): Promise<ParseResult | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      const ocr = await recognize(image);
      setOcrResult(ocr);
      setConfidence(ocr.confidence);

      const parsed = autoParse(ocr);
      setParseResult(parsed);
      return parsed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OCR 처리 중 오류가 발생했습니다.';
      setError(msg);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setOcrResult(null);
    setParseResult(null);
    setConfidence(0);
    setError(null);
  }, []);

  return {
    processImage,
    ocrResult,
    parseResult,
    confidence,
    isProcessing,
    error,
    reset,
  };
}
