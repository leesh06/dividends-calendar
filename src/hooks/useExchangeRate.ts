import { useEffect, useCallback } from 'react';
import { fetchExchangeRate } from '../services/exchangeApi';
import { useCurrencyStore } from '../stores/currencyStore';

const FALLBACK_RATE = 1350;

interface UseExchangeRateReturn {
  rate: number;
  isLoading: boolean;
  lastUpdated: string | null;
  refresh: () => Promise<void>;
}

export function useExchangeRate(): UseExchangeRateReturn {
  const { rate, isLoading, lastUpdated, setRate, setLoading } =
    useCurrencyStore();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchExchangeRate();
      setRate(data.rate, data.lastUpdated);
    } catch {
      // 실패 시 기존 환율 유지, 없으면 폴백값 사용
      if (rate === 0) {
        setRate(FALLBACK_RATE, '폴백 환율');
      }
    } finally {
      setLoading(false);
    }
  }, [rate, setRate, setLoading]);

  useEffect(() => {
    if (rate === 0) {
      refresh();
    }
  }, [rate, refresh]);

  return { rate, isLoading, lastUpdated, refresh };
}
