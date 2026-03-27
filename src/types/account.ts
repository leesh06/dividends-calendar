/** 증권사 구분 */
export type Broker = '키움증권' | '삼성증권';

/** 통화 구분 */
export type Currency = 'USD' | 'KRW';

/** 시장 구분 */
export type Market = 'US' | 'KR';

/** 계좌 정보 */
export interface Account {
  accountId: string;
  accountName: string;
  broker: Broker;
  currency: Currency;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 보유 종목 */
export interface Holding {
  holdingId: string;
  accountId: string;
  ticker: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currency: Currency;
  market: Market;
  updatedAt: string;
}
