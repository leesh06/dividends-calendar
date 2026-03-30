import { useState, useCallback } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { useCurrencyStore } from '../stores/currencyStore';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { addAccount, fetchDividends, updateQuotes, deleteAccount as deleteAccountApi } from '../services/sheetsApi';
import Card from '../components/common/Card';
import Toggle from '../components/common/Toggle';
import type { Broker, Currency } from '../types';

const BROKER_OPTIONS: Broker[] = ['키움증권', '삼성증권'];
const CURRENCY_OPTIONS: Currency[] = ['USD', 'KRW'];

export default function SettingsPage() {
  const { accounts, addAccount: addToStore, removeAccount } = useAccountStore();
  const { currentCurrency, toggleCurrency } = useCurrencyStore();
  const { rate, lastUpdated, refresh } = useExchangeRate();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBroker, setNewBroker] = useState<Broker>('키움증권');
  const [newCurrency, setNewCurrency] = useState<Currency>('USD');
  const [gasUrl, setGasUrl] = useState(
    import.meta.env.VITE_GAS_WEB_APP_URL || '',
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetchingDividends, setIsFetchingDividends] = useState(false);
  const [dividendMsg, setDividendMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddAccount = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      const account = await addAccount({
        accountName: newName.trim(),
        broker: newBroker,
        currency: newCurrency,
        isActive: true,
      });
      addToStore(account);
      setNewName('');
      setShowAddForm(false);
    } catch {
      // 오프라인 등 실패 시 로컬에만 추가
      addToStore({
        accountId: `acc_local_${Date.now()}`,
        accountName: newName.trim(),
        broker: newBroker,
        currency: newCurrency,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setNewName('');
      setShowAddForm(false);
    }
  }, [newName, newBroker, newCurrency, addToStore]);

  const handleDeleteAccount = useCallback(async (accountId: string) => {
    setDeletingId(accountId);
    try {
      await deleteAccountApi(accountId);
      removeAccount(accountId);
    } catch {
      removeAccount(accountId);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }, [removeAccount]);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await refresh();
    } finally {
      setIsSyncing(false);
    }
  }, [refresh]);

  const handleFetchDividends = useCallback(async () => {
    setIsFetchingDividends(true);
    setDividendMsg('');
    try {
      await updateQuotes();
      await fetchDividends();
      setDividendMsg('배당 수집 완료! 홈 탭에서 확인하세요.');
    } catch {
      setDividendMsg('배당 수집 실패. 다시 시도해주세요.');
    } finally {
      setIsFetchingDividends(false);
    }
  }, []);

  return (
    <div className="px-4 py-5 space-y-4">
      <h1 className="text-lg font-bold text-dark-text">설정</h1>

      {/* 계좌 관리 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-dark-text-secondary">계좌 관리</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs text-accent font-medium"
          >
            {showAddForm ? '취소' : '+ 추가'}
          </button>
        </div>

        {showAddForm && (
          <Card className="!p-3 space-y-3 mb-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="계좌 이름 (예: 키움 미국ETF)"
              className="w-full bg-dark-bg text-dark-text text-sm rounded-lg px-3 py-2 border border-dark-border focus:border-accent outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newBroker}
                onChange={(e) => setNewBroker(e.target.value as Broker)}
                className="bg-dark-bg text-dark-text text-sm rounded-lg px-3 py-2 border border-dark-border outline-none"
              >
                {BROKER_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <select
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value as Currency)}
                className="bg-dark-bg text-dark-text text-sm rounded-lg px-3 py-2 border border-dark-border outline-none"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddAccount}
              disabled={!newName.trim()}
              className="w-full py-2 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-50"
            >
              계좌 추가
            </button>
          </Card>
        )}

        {accounts.length === 0 ? (
          <Card className="!p-4 text-center">
            <p className="text-sm text-dark-text-muted">등록된 계좌가 없습니다</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {accounts.filter((acc) => acc.accountId && acc.accountName).map((acc) => (
              <Card key={acc.accountId} className="!p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${acc.broker === '키움증권' ? 'bg-us-stock' : 'bg-kr-stock'}`} />
                    <div>
                      <p className="text-sm font-medium text-dark-text">{acc.accountName}</p>
                      <p className="text-xs text-dark-text-muted">{acc.broker} · {acc.currency}</p>
                    </div>
                  </div>
                  {confirmDeleteId === acc.accountId ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteAccount(acc.accountId)}
                        disabled={deletingId === acc.accountId}
                        className="text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-medium disabled:opacity-50"
                      >
                        {deletingId === acc.accountId ? '삭제중...' : '확인'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[11px] px-2 py-0.5 rounded bg-dark-border/50 text-dark-text-muted font-medium"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(acc.accountId)}
                      className="text-[11px] text-dark-text-muted hover:text-red-400 transition-colors"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 통화 설정 */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-dark-text">표시 통화</p>
            <p className="text-xs text-dark-text-muted">
              현재: {currentCurrency === 'KRW' ? '원화 (KRW)' : '달러 (USD)'}
            </p>
          </div>
          <Toggle
            active={currentCurrency === 'USD'}
            onToggle={toggleCurrency}
            label="USD"
            size="sm"
          />
        </div>
      </Card>

      {/* 동기화 상태 */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-dark-text">동기화</p>
            <p className="text-xs text-dark-text-muted">
              환율: {rate > 0 ? `1 USD = ${rate.toFixed(2)} KRW` : '미동기화'}
            </p>
            {lastUpdated && (
              <p className="text-[10px] text-dark-text-muted mt-0.5">
                마지막 갱신: {lastUpdated}
              </p>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-lg bg-dark-border text-xs text-dark-text-secondary hover:text-dark-text transition-colors disabled:opacity-50"
          >
            {isSyncing ? '동기화 중...' : '새로고침'}
          </button>
        </div>
      </Card>

      {/* 배당 수집 */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-dark-text">배당 수집</p>
            <p className="text-xs text-dark-text-muted">
              Yahoo Finance에서 배당 데이터를 가져옵니다
            </p>
            {dividendMsg && (
              <p className={`text-xs mt-1 ${dividendMsg.includes('완료') ? 'text-green-400' : 'text-red-400'}`}>
                {dividendMsg}
              </p>
            )}
          </div>
          <button
            onClick={handleFetchDividends}
            disabled={isFetchingDividends}
            className="px-3 py-1.5 rounded-lg bg-dark-border text-xs text-dark-text-secondary hover:text-dark-text transition-colors disabled:opacity-50"
          >
            {isFetchingDividends ? '수집 중...' : '수집하기'}
          </button>
        </div>
      </Card>

      {/* GAS URL 설정 */}
      <Card>
        <p className="text-sm font-medium text-dark-text mb-2">GAS 웹앱 URL</p>
        <input
          value={gasUrl}
          onChange={(e) => setGasUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/..."
          className="w-full bg-dark-bg text-dark-text text-xs rounded-lg px-3 py-2 border border-dark-border focus:border-accent outline-none"
        />
        <p className="text-[10px] text-dark-text-muted mt-1.5">
          환경변수 VITE_GAS_WEB_APP_URL로 설정하거나 여기에 직접 입력하세요
        </p>
      </Card>

      {/* 앱 정보 */}
      <Card className="!p-3 text-center">
        <p className="text-xs text-dark-text-muted">배당 캘린더 v0.1.0</p>
      </Card>
    </div>
  );
}
