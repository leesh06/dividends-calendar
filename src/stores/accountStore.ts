import { create } from 'zustand';
import type { Account } from '../types';

interface AccountState {
  /** 전체 계좌 목록 */
  accounts: Account[];
  /** 선택된 계좌 ID 목록 (비어있으면 전체) */
  selectedAccountIds: string[];
  /** 계좌 목록 설정 */
  setAccounts: (accounts: Account[]) => void;
  /** 계좌 선택 토글 */
  toggleAccount: (accountId: string) => void;
  /** 전체 선택 */
  selectAll: () => void;
  /** 계좌 추가 */
  addAccount: (account: Account) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  selectedAccountIds: [],

  setAccounts: (accounts) => set({ accounts }),

  toggleAccount: (accountId) =>
    set((state) => {
      const allIds = state.accounts.map((a) => a.accountId);
      let ids = state.selectedAccountIds;

      // 전체 선택 상태에서 하나를 끄면 → 나머지만 선택
      if (ids.length === 0) {
        ids = allIds.filter((id) => id !== accountId);
      } else if (ids.includes(accountId)) {
        ids = ids.filter((id) => id !== accountId);
      } else {
        ids = [...ids, accountId];
      }

      // 모두 선택되면 전체 선택 상태(빈 배열)로
      if (ids.length === allIds.length) {
        ids = [];
      }

      return { selectedAccountIds: ids };
    }),

  selectAll: () => set({ selectedAccountIds: [] }),

  addAccount: (account) =>
    set((state) => ({ accounts: [...state.accounts, account] })),
}));
