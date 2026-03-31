import type { Currency } from '../types';

const LOCALE = 'ko-KR';

/** 통화 포맷 */
export function formatCurrency(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: currency === 'KRW' ? 0 : 2,
    maximumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(amount);
}

/** 날짜 포맷 (YYYY-MM-DD) */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 월 문자열 포맷 (YYYY-MM) */
export function formatMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** 숫자에 콤마 추가 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat(LOCALE).format(num);
}

/** 퍼센트 포맷 */
export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
