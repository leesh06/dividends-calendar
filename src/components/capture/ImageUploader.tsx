import { useRef } from 'react';
import Card from '../common/Card';

interface ImageUploaderProps {
  onImageSelect: (files: File[]) => void;
  previews: string[];
  onRemove: (index: number) => void;
}

/** 이미지 업로드 (복수 파일 선택 / 카메라 촬영 / 추가 업로드) */
export default function ImageUploader({ onImageSelect, previews, onRemove }: ImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    onImageSelect(Array.from(files));
    // input 초기화 (같은 파일 재선택 가능)
    e.target.value = '';
  }

  const hasImages = previews.length > 0;

  return (
    <Card className="text-center">
      {hasImages ? (
        <div className="space-y-3">
          {/* 썸네일 리스트 */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {previews.map((src, i) => (
              <div key={i} className="relative flex-shrink-0">
                <img
                  src={src}
                  alt={`캡처 ${i + 1}`}
                  className="w-24 h-24 object-cover rounded-lg border border-dark-border"
                />
                <button
                  onClick={() => onRemove(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
                >
                  ×
                </button>
                <span className="absolute bottom-0.5 left-0.5 bg-dark-bg/80 text-dark-text text-[10px] px-1 rounded">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-dark-text-muted">
            {previews.length}장 선택됨 · 추가 업로드 가능
          </p>
        </div>
      ) : (
        <div className="py-8">
          <svg className="w-12 h-12 mx-auto text-dark-text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-dark-text-secondary">
            증권사 앱 캡처를 업로드하세요
          </p>
          <p className="text-xs text-dark-text-muted mt-1">
            여러 장 선택 가능 (종목 목록 + 예수금 등)
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-light transition-colors"
        >
          {hasImages ? '+ 추가 선택' : '파일 선택'}
        </button>
        <button
          onClick={() => cameraRef.current?.click()}
          className="flex-1 py-2.5 rounded-xl bg-dark-border text-dark-text text-sm font-medium hover:bg-dark-text-muted/30 transition-colors"
        >
          카메라 촬영
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFile} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
    </Card>
  );
}
