import { useState, useEffect, useCallback, useRef } from 'react';
import { getHoldings } from '../services/sheetsApi';
import { GAS_WEB_APP_URL } from '../utils/constants';
import type { Holding } from '../types';

interface UseHoldingsReturn {
  holdings: Holding[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** 선택된 계좌의 보유 종목 조회 */
export function useHoldings(accountIds: string[]): UseHoldingsReturn {
  const [allHoldings, setAllHoldings] = useState<Holding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchData = useCallback(async () => {
    if (!GAS_WEB_APP_URL) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getHoldings();
      setAllHoldings(data);
      hasFetched.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '보유 종목 로딩 실패');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFetched.current) {
      fetchData();
    }
  }, [fetchData]);

  // 계좌 필터링은 로컬에서 처리 (GAS 재호출 안 함)
  const holdings = accountIds.length > 0
    ? allHoldings.filter((h) => accountIds.includes(h.accountId))
    : allHoldings;

  return { holdings, isLoading, error, refetch: fetchData };
}
