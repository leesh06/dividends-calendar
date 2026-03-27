import Card from '../common/Card';

interface OcrProgressProps {
  isProcessing: boolean;
  confidence: number;
  error: string | null;
}

const PERCENT = 100;

/** OCR 진행률 바 + 상태 텍스트 */
export default function OcrProgress({ isProcessing, confidence, error }: OcrProgressProps) {
  if (!isProcessing && confidence === 0 && !error) return null;

  return (
    <Card>
      {isProcessing ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-dark-text">이미지 인식 중...</p>
            <Spinner />
          </div>
          <div className="w-full h-1.5 bg-dark-border rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-danger flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-danger">{error}</p>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-dark-text">인식 완료</p>
          <p className={`text-sm font-medium ${confidence >= 80 ? 'text-success' : confidence >= 50 ? 'text-warning' : 'text-danger'}`}>
            신뢰도 {confidence.toFixed(0)}%
          </p>
        </div>
      )}
    </Card>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-dark-border border-t-accent rounded-full animate-spin" />
  );
}
