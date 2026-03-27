import { GAS_WEB_APP_URL } from '../utils/constants';
import type { Account, Holding, Dividend } from '../types';

/** GAS 응답 형식 */
interface GasResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

/** 전체 데이터 (앱 초기 로딩용) */
export interface AllData {
  accounts: Account[];
  holdings: Holding[];
  dividends: Dividend[];
  settings: Record<string, string>;
}

/** GET 요청 헬퍼 */
async function gasGet<T>(action: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(GAS_WEB_APP_URL);
  url.searchParams.set('action', action);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`GAS 요청 실패: ${res.status} ${res.statusText}`);
  }

  const json: GasResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(json.error || '알 수 없는 오류가 발생했습니다.');
  }
  return json.data;
}

/** POST 요청 헬퍼 */
async function gasPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`GAS 요청 실패: ${res.status} ${res.statusText}`);
  }

  const json: GasResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(json.error || '알 수 없는 오류가 발생했습니다.');
  }
  return json.data;
}

/** Holding 데이터 숫자 필드 변환 + 빈 행/유령 종목 필터 */
function normalizeHoldings(holdings: Holding[]): Holding[] {
  return holdings
    .filter((h) => h.ticker && h.ticker.toString().trim() !== '')
    .map((h) => ({
      ...h,
      quantity: Number(h.quantity) || 0,
      avgPrice: Number(h.avgPrice) || 0,
      currentPrice: Number(h.currentPrice) || 0,
    }))
    .filter((h) => h.quantity > 0 && (h.ticker.startsWith('CASH') || h.currentPrice > 0));
}

/** Dividend 데이터 숫자 필드 변환 + 빈 행 필터 + 누락 필드 기본값 */
function normalizeDividends(dividends: Dividend[]): Dividend[] {
  return dividends
    .filter((d) => d.ticker && d.ticker.toString().trim() !== '')
    .map((d) => ({
      ...d,
      amount: Number(d.amount) || 0,
      currency: d.currency || 'USD',
      status: d.status || 'actual',
      frequency: d.frequency || 'monthly',
      source: d.source || 'finnhub',
      updatedAt: d.updatedAt || '',
    }));
}

/** 전체 데이터 일괄 조회 */
export async function getAll(): Promise<AllData> {
  const data = await gasGet<AllData>('getAll');
  return {
    ...data,
    holdings: normalizeHoldings(data.holdings),
    dividends: normalizeDividends(data.dividends),
  };
}

/** 계좌 목록 조회 */
export function getAccounts(): Promise<Account[]> {
  return gasGet<Account[]>('getAccounts');
}

/** 보유 종목 조회 */
export async function getHoldings(accountId?: string): Promise<Holding[]> {
  const params = accountId ? { accountId } : undefined;
  const data = await gasGet<Holding[]>('getHoldings', params);
  return normalizeHoldings(data);
}

/** 배당 데이터 조회 */
export async function getDividends(month?: string): Promise<Dividend[]> {
  const params = month ? { month } : undefined;
  const data = await gasGet<Dividend[]>('getDividends', params);
  return normalizeDividends(data);
}

/** 보유 종목 upsert (OCR 결과 저장) */
export function upsertHoldings(
  accountId: string,
  holdings: Omit<Holding, 'holdingId' | 'accountId' | 'updatedAt'>[],
): Promise<{ updated: number }> {
  return gasPost<{ updated: number }>({
    action: 'upsertHoldings',
    accountId,
    holdings,
  });
}

/** 계좌 추가 */
export function addAccount(
  account: Omit<Account, 'accountId' | 'createdAt' | 'updatedAt'>,
): Promise<Account> {
  return gasPost<Account>({
    action: 'addAccount',
    account,
  });
}

/** 계좌 삭제 (계좌 + 해당 보유종목 모두 삭제) */
export function deleteAccount(
  accountId: string,
): Promise<{ deleted: string }> {
  return gasPost<{ deleted: string }>({
    action: 'deleteAccount',
    accountId,
  });
}

/** 보유 종목 삭제 */
export function deleteHolding(
  accountId: string,
  ticker: string,
): Promise<{ deleted: number }> {
  return gasPost<{ deleted: number }>({
    action: 'deleteHolding',
    accountId,
    ticker,
  });
}

/** 설정 변경 */
export function updateSetting(key: string, value: string): Promise<void> {
  return gasPost<void>({
    action: 'updateSetting',
    key,
    value,
  });
}

/** GAS에서 환율 조회 */
export function getExchangeRate(): Promise<{ rate: number; lastUpdated: string }> {
  return gasGet<{ rate: number; lastUpdated: string }>('getExchangeRate');
}

/** GAS에서 현재가 업데이트 트리거 */
export function updateQuotes(): Promise<{ updated: number }> {
  return gasPost<{ updated: number }>({ action: 'updateQuotes' });
}

/** 캡처 이미지 분석 (Gemini AI) */
export interface CaptureResult {
  broker: string;
  holdings: {
    name: string;
    ticker: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    evalAmount: number;
    purchaseAmount: number;
    profitLoss: number;
    currency: string;
    market: string;
  }[];
}

export function parseCapture(imageBase64: string): Promise<CaptureResult> {
  return gasPost<CaptureResult>({
    action: 'parseCapture',
    imageBase64,
  });
}
