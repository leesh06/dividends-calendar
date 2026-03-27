import { useState } from 'react';
import Card from '../common/Card';
import type { ParsedHolding } from '../../types';

interface OcrResultEditorProps {
  holdings: ParsedHolding[];
  broker: string;
  onSave: (holdings: ParsedHolding[]) => void;
}

/** OCR 인식 결과 편집 테이블 */
export default function OcrResultEditor({ holdings: initial, broker, onSave }: OcrResultEditorProps) {
  const [items, setItems] = useState<ParsedHolding[]>(initial);

  function updateItem(idx: number, field: keyof ParsedHolding, value: string) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, [field]: ['quantity', 'avgPrice', 'evalAmount'].includes(field) ? Number(value) || 0 : value }
          : item,
      ),
    );
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-dark-text-secondary">
          인식 결과 ({broker})
        </h3>
        <span className="text-xs text-dark-text-muted">{items.length}개 종목</span>
      </div>

      {items.map((item, idx) => (
        <Card key={idx} className="!p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${item.market === 'US' ? 'bg-us-stock' : 'bg-kr-stock'}`} />
              <input
                value={item.name}
                onChange={(e) => updateItem(idx, 'name', e.target.value)}
                className="bg-transparent text-sm font-medium text-dark-text border-b border-transparent focus:border-accent outline-none"
              />
            </div>
            <button
              onClick={() => removeItem(idx)}
              className="text-dark-text-muted hover:text-danger transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-dark-text-muted">티커</label>
              <input
                value={item.ticker}
                onChange={(e) => updateItem(idx, 'ticker', e.target.value)}
                className="w-full bg-dark-bg rounded px-2 py-1 text-xs text-dark-text border border-dark-border focus:border-accent outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-dark-text-muted">수량</label>
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                className="w-full bg-dark-bg rounded px-2 py-1 text-xs text-dark-text border border-dark-border focus:border-accent outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-dark-text-muted">평가금액</label>
              <input
                type="number"
                value={item.evalAmount}
                onChange={(e) => updateItem(idx, 'evalAmount', e.target.value)}
                className="w-full bg-dark-bg rounded px-2 py-1 text-xs text-dark-text border border-dark-border focus:border-accent outline-none"
              />
            </div>
          </div>
        </Card>
      ))}

      {items.length > 0 && (
        <button
          onClick={() => onSave(items)}
          className="w-full py-3 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-light transition-colors"
        >
          저장하기
        </button>
      )}
    </div>
  );
}
