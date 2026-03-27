import { useRef } from 'react';
import Card from '../common/Card';

interface ImageUploaderProps {
  onImageSelect: (file: File) => void;
  preview: string | null;
}

/** 이미지 업로드 (파일 선택 / 카메라 촬영) */
export default function ImageUploader({ onImageSelect, preview }: ImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onImageSelect(file);
  }

  return (
    <Card className="text-center">
      {preview ? (
        <img
          src={preview}
          alt="캡처 미리보기"
          className="w-full max-h-60 object-contain rounded-lg mb-3"
        />
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
            보유 종목 화면을 캡처해주세요
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-light transition-colors"
        >
          파일 선택
        </button>
        <button
          onClick={() => cameraRef.current?.click()}
          className="flex-1 py-2.5 rounded-xl bg-dark-border text-dark-text text-sm font-medium hover:bg-dark-text-muted/30 transition-colors"
        >
          카메라 촬영
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
    </Card>
  );
}
