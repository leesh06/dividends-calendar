import { useState, useMemo } from 'react';
import { useCurrency } from '../../hooks/useCurrency';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import type { Holding, Dividend, Currency } from '../../types';
import { calcAnnualYield } from '../../utils/dividendEstimator';

interface HoldingsListProps {
  holdings: Holding[];
  dividends: Dividend[];
}

type SortMode = 'value' | 'yield';

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'value', label: '평가금액순' },
  { key: 'yield', label: '배당률순' },
];

const MARKET_LABELS: Record<string, { label: string; gradient: string }> = {
  US: { label: 'US', gradient: 'from-blue-500 to-blue-600' },
  KR: { label: 'KR', gradient: 'from-emerald-500 to-emerald-600' },
};

/** 현재가 포맷 (원본 통화 기준) */
function formatPrice(price: number, currency: Currency): string {
  return formatCurrency(price, currency);
}

/** 보유 종목 리스트 - 프리미엄 UI */
export default function HoldingsList({ holdings, dividends }: HoldingsListProps) {
  const { format, convert } = useCurrency();
  const [sortMode, setSortMode] = useState<SortMode>('value');

  // 종목별 수익률 미리 계산 (정렬용)
  const yieldMap = useMemo(() => {
    const map = new Map<string, number>();
    holdings.forEach((h) => {
      map.set(h.holdingId, calcAnnualYield(h, dividends));
    });
    return map;
  }, [holdings, dividends]);

  // 정렬 적용
  const sortedHoldings = useMemo(() => {
    const sorted = [...holdings];
    if (sortMode === 'value') {
      sorted.sort((a, b) =>
        convert(b.currentPrice * b.quantity, b.currency)
        - convert(a.currentPrice * a.quantity, a.currency),
      );
    } else {
      sorted.sort((a, b) =>
        (yieldMap.get(b.holdingId) || 0) - (yieldMap.get(a.holdingId) || 0),
      );
    }
    return sorted;
  }, [holdings, sortMode, yieldMap, convert]);

  if (holdings.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-dark-text-secondary tracking-wide uppercase">
            보유 종목
          </h3>
          <span className="text-xs text-dark-text-muted">
            {holdings.length}개
          </span>
        </div>

        {/* 정렬 토글 */}
        <div className="flex rounded-lg bg-dark-bg/60 border border-dark-border/50 p-0.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortMode(opt.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 ${
                sortMode === opt.key
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-dark-text-muted hover:text-dark-text-secondary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {sortedHoldings.map((holding, index) => {
          const evalAmount = holding.currentPrice * holding.quantity;
          const yieldRate = yieldMap.get(holding.holdingId) || 0;
          const market = MARKET_LABELS[holding.market] || {
            label: '??',
            gradient: 'from-gray-500 to-gray-600',
          };
          const isCash = holding.ticker.startsWith('CASH');

          return (
            <div
              key={holding.holdingId}
              className="group relative bg-dark-surface rounded-2xl border border-dark-border/60 overflow-hidden hover:border-dark-border transition-all duration-200"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {/* 좌측 마켓 인디케이터 바 */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${market.gradient}`}
              />

              <div className="pl-4 pr-3.5 py-3">
                <div className="flex items-start justify-between">
                  {/* 좌: 종목 정보 */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* 마켓 뱃지 */}
                    <div
                      className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${market.gradient} flex items-center justify-center shadow-sm`}
                    >
                      <span className="text-[10px] font-bold text-white tracking-tight">
                        {market.label}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-dark-text truncate leading-tight">
                        {holding.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-medium text-dark-text-muted">
                          {holding.ticker}
                        </span>
                        <span className="text-dark-border">·</span>
                        <span className="text-xs text-dark-text-muted">
                          {formatNumber(holding.quantity)}주
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 우: 평가금액 + 현재가 */}
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-bold text-dark-text tabular-nums">
                      {format(evalAmount, holding.currency)}
                    </p>
                    {!isCash && (
                      <p className="text-[11px] text-dark-text-muted mt-0.5 tabular-nums">
                        현재가 {formatPrice(holding.currentPrice, holding.currency)}
                      </p>
                    )}
                  </div>
                </div>

                {/* 하단: 배당수익률 표시 */}
                {yieldRate > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-dark-border/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        <span className="text-sm text-dark-text-muted">배당수익률(세후)</span>
                      </div>
                      <span className="text-sm font-extrabold text-success tabular-nums">
                        {yieldRate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
