import { create } from 'zustand';

interface AppState {
  /** 앱 전체 로딩 상태 */
  isLoading: boolean;
  /** 글로벌 에러 메시지 */
  error: string | null;
  /** 로딩 설정 */
  setLoading: (isLoading: boolean) => void;
  /** 에러 설정 */
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isLoading: false,
  error: null,
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
