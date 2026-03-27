import { useAccountStore } from '../../stores/accountStore';
import { useCurrency } from '../../hooks/useCurrency';
import { formatCurrency } from '../../utils/formatters';
import type { Holding } from '../../types';
import Card from '../common/Card';
import Toggle from '../common/Toggle';

interface AccountSelectorProps {
  holdings: Holding[];
}

const BROKER_COLORS: Record<string, string> = {
  '키움증권': 'bg-us-stock',
  '삼성증권': 'bg-kr-stock',
};

/** 계좌별 토글 카드 */
export default function AccountSelector({ holdings }: AccountSelectorProps) {
  const { accounts, selectedAccountIds, toggleAccount, selectAll } = useAccountStore();
  const { convert, currentCurrency } = useCurrency();
  const isAllSelected = selectedAccountIds.length === 0;

  /** 계좌별 총 평가금액 계산 (종목별 통화 기준으로 변환) */
  function getAccountValue(accountId: string): number {
    return holdings
      .filter((h) => h.accountId === accountId)
      .reduce((sum, h) => sum + convert(h.currentPrice * h.quantity, h.currency), 0);
  }

  /** 계좌 활성 여부 */
  function isActive(accountId: string): boolean {
    return isAllSelected || selectedAccountIds.includes(accountId);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-dark-text-secondary tracking-wide uppercase">계좌 선택</h3>
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
      </div>

      {accounts.map((account) => {
        const active = isActive(account.accountId);
        const value = getAccountValue(account.accountId);
        const dotColor = BROKER_COLORS[account.broker] || 'bg-dark-text-muted';

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
          </Card>
        );
      })}
    </div>
  );
}
