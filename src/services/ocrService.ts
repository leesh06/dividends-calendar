import Tesseract from 'tesseract.js';
import type { OcrResult, OcrLine } from '../types';

/** Tesseract Worker 싱글턴 */
let worker: Tesseract.Worker | null = null;

/** 워커 초기화 (한국어 + 영어 동시 인식) */
async function getWorker(): Promise<Tesseract.Worker> {
  if (!worker) {
    worker = await Tesseract.createWorker('kor+eng');
  }
  return worker;
}

/** 이미지 OCR 인식 */
export async function recognize(
  image: File | string | HTMLImageElement,
): Promise<OcrResult> {
  const w = await getWorker();
  const { data } = await w.recognize(image);

  // Tesseract.js 버전에 따라 lines가 없을 수 있으므로 안전하게 처리
  const rawLines = (data as unknown as Record<string, unknown>).lines as Array<{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }> || [];
  const lines: OcrLine[] = rawLines.map((line: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }) => ({
    text: line.text.trim(),
    confidence: line.confidence,
    bbox: line.bbox,
  }));

  // lines가 비어있으면 텍스트를 줄 단위로 분할하여 생성
  if (lines.length === 0 && data.text) {
    const textLines = data.text.split('\n').filter((l: string) => l.trim());
    textLines.forEach((text: string) => {
      lines.push({
        text: text.trim(),
        confidence: data.confidence,
        bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
      });
    });
  }

  return {
    text: data.text,
    confidence: data.confidence,
    lines,
  };
}

/** 워커 종료 (앱 종료 시 호출) */
export async function terminate(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
