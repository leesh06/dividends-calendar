import { useState, useMemo } from 'react';
import { useAccountStore } from '../../stores/accountStore';
import { useCurrency } from '../../hooks/useCurrency';
import { formatCurrency } from '../../utils/formatters';
import { deleteAccount as deleteAccountApi } from '../../services/sheetsApi';
import type { Holding } from '../../types';
import Card from '../common/Card';
import Toggle from '../common/Toggle';

interface AccountSelectorProps {
  allHoldings: Holding[];
  onAccountDeleted?: () => void;
}

const BROKER_COLORS: Record<string, string> = {
  '키움증권': 'bg-us-stock',
  '삼성증권': 'bg-kr-stock',
};

/** 계좌별 토글 카드 */
export default function AccountSelector({ allHoldings, onAccountDeleted }: AccountSelectorProps) {
  const { accounts, selectedAccountIds, toggleAccount, selectAll, removeAccount } = useAccountStore();
  const { convert, currentCurrency } = useCurrency();
  const isAllSelected = selectedAccountIds.length === 0;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // 보유종목이 있는 계좌만 필터 (전체 holdings 기준, 선택 상태와 무관하게)
  const accountsWithHoldings = useMemo(() => {
    const accountIdsWithData = new Set(allHoldings.map((h) => h.accountId));
    return accounts.filter((a) => accountIdsWithData.has(a.accountId));
  }, [accounts, allHoldings]);

  /** 계좌별 총 평가금액 계산 (전체 holdings 기준) */
  function getAccountValue(accountId: string): number {
    return allHoldings
      .filter((h) => h.accountId === accountId)
      .reduce((sum, h) => sum + convert(h.currentPrice * h.quantity, h.currency), 0);
  }

  /** 계좌 활성 여부 */
  function isActive(accountId: string): boolean {
    return isAllSelected || selectedAccountIds.includes(accountId);
  }

  /** 계좌 삭제 */
  async function handleDelete(accountId: string) {
    setDeletingId(accountId);
    try {
      await deleteAccountApi(accountId);
      removeAccount(accountId);
      onAccountDeleted?.();
    } catch {
      // 에러 무시 (GAS 새 배포 전이면 실패할 수 있음)
      // 로컬 상태만 삭제
      removeAccount(accountId);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  if (accountsWithHoldings.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-dark-text-secondary tracking-wide uppercase">계좌 선택</h3>
        {accountsWithHoldings.length > 1 && (
          <button
            onClick={selectAll}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              isAllSelected
                ? 'bg-accent text-white'
                : 'bg-dark-border text-dark-text-muted'
            }`}
          >
            전체
          </button>
        )}
      </div>

      {accountsWithHoldings.map((account) => {
        const active = isActive(account.accountId);
        const value = getAccountValue(account.accountId);
        const dotColor = BROKER_COLORS[account.broker] || 'bg-dark-text-muted';
        const isConfirming = confirmId === account.accountId;
        const isDeleting = deletingId === account.accountId;

        return (
          <Card key={account.accountId} className={`!p-3 transition-opacity ${active ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                <div>
                  <p className="text-sm font-medium text-dark-text">
                    {account.accountName}
                  </p>
                  <p className="text-xs text-dark-text-muted">
                    {account.broker} · {account.currency}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-dark-text-secondary">
                  {formatCurrency(value, currentCurrency)}
                </span>
                <Toggle
                  active={active}
                  onToggle={() => toggleAccount(account.accountId)}
                  size="sm"
                />
              </div>
            </div>

            {/* 삭제 영역 */}
            <div className="mt-2 pt-2 border-t border-dark-border/40 flex justify-end">
              {isConfirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-danger">삭제하시겠습니까?</span>
                  <button
                    onClick={() => handleDelete(account.accountId)}
                    disabled={isDeleting}
                    className="text-[11px] px-2 py-0.5 rounded bg-danger/20 text-danger font-medium hover:bg-danger/30 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? '삭제중...' : '확인'}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="text-[11px] px-2 py-0.5 rounded bg-dark-border/50 text-dark-text-muted font-medium hover:bg-dark-border transition-colors"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(account.accountId)}
                  className="text-[11px] text-dark-text-muted hover:text-danger transition-colors"
                >
                  계좌 삭제
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
