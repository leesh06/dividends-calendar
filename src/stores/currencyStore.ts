import { create } from 'zustand';
import type { Currency } from '../types';

interface CurrencyState {
  /** 현재 표시 통화 */
  currentCurrency: Currency;
  /** USD/KRW 환율 */
  rate: number;
  /** 마지막 환율 갱신 시간 */
  lastUpdated: string | null;
  /** 환율 로딩 중 */
  isLoading: boolean;
  /** 통화 토글 */
  toggleCurrency: () => void;
  /** 통화 설정 */
  setCurrency: (currency: Currency) => void;
  /** 환율 설정 */
  setRate: (rate: number, lastUpdated: string) => void;
  /** 로딩 상태 설정 */
  setLoading: (isLoading: boolean) => void;
}

export const useCurrencyStore = create<CurrencyState>((set) => ({
  currentCurrency: 'KRW',
  rate: 0,
  lastUpdated: null,
  isLoading: false,

  toggleCurrency: () =>
    set((state) => ({
      currentCurrency: state.currentCurrency === 'KRW' ? 'USD' : 'KRW',
    })),

  setCurrency: (currency) => set({ currentCurrency: currency }),

  setRate: (rate, lastUpdated) => set({ rate, lastUpdated }),

  setLoading: (isLoading) => set({ isLoading }),
}));
