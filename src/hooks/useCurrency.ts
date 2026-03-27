import { useCallback } from 'react';
import { useCurrencyStore } from '../stores/currencyStore';
import { formatCurrency } from '../utils/formatters';
import type { Currency } from '../types';

interface UseCurrencyReturn {
  /** 금액을 현재 표시 통화로 변환 */
  convert: (amount: number, fromCurrency: Currency) => number;
  /** 금액을 현재 표시 통화로 포맷 */
  format: (amount: number, fromCurrency: Currency) => string;
  /** 현재 표시 통화 */
  currentCurrency: Currency;
  /** 통화 토글 */
  toggle: () => void;
}

export function useCurrency(): UseCurrencyReturn {
  const { currentCurrency, rate, toggleCurrency } = useCurrencyStore();

  const convert = useCallback(
    (amount: number, fromCurrency: Currency): number => {
      if (fromCurrency === currentCurrency) return amount;
      if (rate === 0) return amount;

      // USD -> KRW
      if (fromCurrency === 'USD' && currentCurrency === 'KRW') {
        return amount * rate;
      }
      // KRW -> USD
      return amount / rate;
    },
    [currentCurrency, rate],
  );

  const format = useCallback(
    (amount: number, fromCurrency: Currency): string => {
      const converted = convert(amount, fromCurrency);
      return formatCurrency(converted, currentCurrency);
    },
    [convert, currentCurrency],
  );

  return {
    convert,
    format,
    currentCurrency,
    toggle: toggleCurrency,
  };
}
