import type { Currency } from './account';

/** 배당 주기 */
export type DividendFrequency = 'monthly' | 'quarterly' | 'annual';

/** 배당 상태 (확정/예상) */
export type DividendStatus = 'actual' | 'estimated';

/** 배당 데이터 출처 */
export type DividendSource = 'finnhub' | 'krx' | 'manual';

/** 배당 이력 */
export interface Dividend {
  dividendId: string;
  ticker: string;
  name: string;
  exDate: string;
  payDate: string;
  amount: number;
  currency: Currency;
  frequency: DividendFrequency;
  status: DividendStatus;
  source: DividendSource;
  updatedAt: string;
}

/** 캘린더에 표시할 배당 이벤트 */
export interface DividendEvent {
  date: string;
  dividends: DividendEventItem[];
  totalAmount: number;
  currency: Currency;
}

/** 개별 배당 이벤트 항목 */
export interface DividendEventItem {
  ticker: string;
  name: string;
  amount: number;
  totalAmount: number;
  quantity: number;
  currency: Currency;
  status: DividendStatus;
  accountId: string;
}
