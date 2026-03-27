import { GAS_WEB_APP_URL } from '../utils/constants';

export interface ExchangeRateData {
  rate: number;
  lastUpdated: string;
}

/** GAS 응답 형식 */
interface GasResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

/** USD/KRW 환율 조회 (GAS 프록시 경유 - CORS 우회) */
export async function fetchExchangeRate(): Promise<ExchangeRateData> {
  const url = new URL(GAS_WEB_APP_URL);
  url.searchParams.set('action', 'getExchangeRate');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`환율 조회 실패: ${res.status}`);
  }

  const json: GasResponse<ExchangeRateData> = await res.json();
  if (!json.success) {
    throw new Error(json.error || '환율 데이터를 가져올 수 없습니다.');
  }

  return json.data;
}
