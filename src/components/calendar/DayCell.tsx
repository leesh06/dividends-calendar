import type { Currency, DividendEvent } from '../../types';

interface DayCellProps {
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  event?: DividendEvent;
  totalAmount?: number;
  currency: Currency;
  onClick: () => void;
}

/** 캘린더 개별 날짜 셀 — 도트 + 금액 표시 */
export default function DayCell({
  day,
  isCurrentMonth,
  isToday,
  isSelected,
  event,
  totalAmount,
  currency,
  onClick,
}: DayCellProps) {
  const hasEvent = event && event.dividends.length > 0;
  const hasActual = hasEvent && event.dividends.some((d) => d.status === 'actual');

  return (
    <button
      onClick={onClick}
      disabled={!isCurrentMonth}
      className={`
        relative flex flex-col items-center pt-1.5 pb-1 min-h-[56px] rounded-xl transition-colors
        ${isCurrentMonth ? 'hover:bg-dark-surface' : 'opacity-20 pointer-events-none'}
        ${isSelected ? 'bg-amber-500/20' : ''}
      `}
    >
      {/* 날짜 숫자 */}
      <span
        className={`text-sm font-semibold mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
          isSelected
            ? 'bg-amber-500 text-white'
            : isToday
              ? 'text-emerald-400 font-bold border border-emerald-400'
              : isCurrentMonth
                ? 'text-dark-text'
                : 'text-dark-text-muted'
        }`}
      >
        {day}
      </span>

      {/* 배당 도트: 확정=노란색, 예상=파란색, 오늘=초록색 */}
      {hasEvent && (
        <div
          className={`w-1.5 h-1.5 rounded-full mb-0.5 ${
            isToday
              ? 'bg-emerald-400'
              : hasActual
                ? 'bg-amber-400'
                : 'bg-blue-400'
          }`}
        />
      )}

      {/* 금액 (축약) */}
      {hasEvent && totalAmount !== undefined && totalAmount > 0 && (
        <span className={`text-[9px] font-medium leading-none ${
          isToday
            ? 'text-emerald-400'
            : hasActual
              ? 'text-amber-400'
              : 'text-blue-400'
        }`}>
          {formatShort(totalAmount, currency)}
        </span>
      )}
    </button>
  );
}

/** 금액 축약 표시 */
function formatShort(n: number, currency: Currency): string {
  if (currency === 'USD') {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    if (n >= 1) return `$${Math.round(n)}`;
    return '';
  }
  const TEN_THOUSAND = 10000;
  const THOUSAND = 1000;
  if (n >= TEN_THOUSAND) return `${Math.round(n / TEN_THOUSAND)}만`;
  if (n >= THOUSAND) return `${(n / THOUSAND).toFixed(0)}천`;
  if (n >= 1) return Math.round(n).toString();
  return '';
}
