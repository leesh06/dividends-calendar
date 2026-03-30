import { useState, useCallback } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { parseCapture, upsertHoldings, addAccount, updateQuotes, fetchDividends } from '../services/sheetsApi';
import type { CaptureResult } from '../services/sheetsApi';
import ImageUploader from '../components/capture/ImageUploader';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';

type Status = 'idle' | 'analyzing' | 'analyzed' | 'saving' | 'saved' | 'error';

/** 복수 OCR 결과를 하나로 합치기 (같은 종목명은 수량/금액 합산) */
function mergeResults(results: CaptureResult[]): CaptureResult {
  const broker = results[0]?.broker || '알 수 없음';
  const holdingsMap = new Map<string, CaptureResult['holdings'][number]>();

  results.forEach((r) => {
    r.holdings.forEach((h) => {
      // 종목명 기준으로 합산 (GPT가 같은 종목에 다른 코드를 부여할 수 있으므로)
      // CASH 항목은 ticker 기준 유지
      const key = h.ticker.startsWith('CASH') ? h.ticker : h.name;
      const existing = holdingsMap.get(key);
      if (existing) {
        existing.quantity += h.quantity;
        existing.evalAmount += h.evalAmount;
        existing.purchaseAmount += h.purchaseAmount;
        existing.profitLoss += h.profitLoss;
        if (existing.quantity > 0) {
          existing.avgPrice = existing.purchaseAmount / existing.quantity;
          existing.currentPrice = existing.evalAmount / existing.quantity;
        }
      } else {
        holdingsMap.set(key, { ...h });
      }
    });
  });

  return { broker, holdings: Array.from(holdingsMap.values()) };
}

export default function CapturePage() {
  const { accounts, addAccount: addAccountToStore } = useAccountStore();
  const [previews, setPreviews] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newBroker, setNewBroker] = useState('');
  const [newCurrency, setNewCurrency] = useState<'USD' | 'KRW'>('USD');
  const [cashKrw, setCashKrw] = useState('');
  const [hasCashInResult, setHasCashInResult] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ done: 0, total: 0 });

  const handleImageSelect = useCallback(async (files: File[]) => {
    // 기존 미리보기에 추가
    const newPreviews: string[] = [];
    const base64List: string[] = [];

    for (const file of files) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('이미지 읽기 실패'));
        reader.readAsDataURL(file);
      });
      newPreviews.push(base64);
      base64List.push(base64);
    }

    setPreviews((prev) => [...prev, ...newPreviews]);

    // 분석 시작
    setStatus('analyzing');
    setError(null);

    const total = base64List.length;
    setAnalyzeProgress({ done: 0, total });

    try {
      const ocrResults: CaptureResult[] = [];
      // 기존 결과가 있으면 포함
      if (result) ocrResults.push(result);

      for (let i = 0; i < base64List.length; i++) {
        const parsed = await parseCapture(base64List[i]);
        ocrResults.push(parsed);
        setAnalyzeProgress({ done: i + 1, total });
      }

      const merged = mergeResults(ocrResults);
      setResult(merged);
      setStatus('analyzed');

      const hasCash = merged.holdings.some((h) => h.ticker.startsWith('CASH'));
      setHasCashInResult(hasCash);
      if (hasCash) setCashKrw('');

      // 증권사에 맞는 계좌 자동 선택
      if (merged.broker && accounts.length > 0 && !selectedAccountId) {
        const match = accounts.find(
          (a) => a.broker.includes(merged.broker.replace('증권', '')) ||
                 merged.broker.includes(a.broker.replace('증권', ''))
        );
        if (match) setSelectedAccountId(match.accountId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 분석 중 오류 발생');
      setStatus('error');
    }
  }, [accounts, result, selectedAccountId]);

  const handleRemoveImage = useCallback((index: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedAccountId || !result) return;

    setStatus('saving');
    try {
      const mapped = result.holdings.map((h) => ({
        ticker: h.ticker,
        name: h.name,
        quantity: h.quantity,
        avgPrice: h.avgPrice || 0,
        currentPrice: h.currentPrice || h.evalAmount / (h.quantity || 1) || 0,
        currency: h.currency as 'USD' | 'KRW',
        market: h.market as 'US' | 'KR',
      }));

      // 수동 입력 예수금 추가 (OCR에서 인식 못했을 때)
      const cashAmount = Number(cashKrw.replace(/,/g, '')) || 0;
      if (cashAmount > 0 && !hasCashInResult) {
        mapped.push({
          ticker: 'CASH_KRW',
          name: '원화예수금',
          quantity: 1,
          avgPrice: cashAmount,
          currentPrice: cashAmount,
          currency: 'KRW',
          market: 'KR',
        });
      }

      await upsertHoldings(selectedAccountId, mapped);
      // 백그라운드로 현재가 + 배당 수집 (실패해도 무시)
      updateQuotes().catch(() => {});
      fetchDividends().catch(() => {});
      setStatus('saved');
    } catch {
      setError('저장 실패. 다시 시도해주세요.');
      setStatus('error');
    }
  }, [selectedAccountId, result, cashKrw, hasCashInResult]);

  const handleAddAccount = useCallback(async () => {
    if (!newAccountName || !newBroker) return;
    try {
      const created = await addAccount({
        accountName: newAccountName,
        broker: newBroker as '키움증권' | '삼성증권',
        currency: newCurrency,
        isActive: true,
      });
      addAccountToStore(created);
      setSelectedAccountId(created.accountId);
      setShowAddAccount(false);
      setNewAccountName('');
      setNewBroker('');
    } catch {
      setError('계좌 추가 실패');
    }
  }, [newAccountName, newBroker, newCurrency, addAccountToStore]);

  const handleReset = useCallback(() => {
    setPreviews([]);
    setStatus('idle');
    setError(null);
    setResult(null);
    setSelectedAccountId('');
    setCashKrw('');
    setHasCashInResult(false);
    setAnalyzeProgress({ done: 0, total: 0 });
  }, []);

  /** 숫자 포맷 (1000 → 1,000) */
  const fmt = (n: number) => (n ?? 0).toLocaleString();

  return (
    <div className="px-4 py-5 space-y-4">
      <h1 className="text-lg font-bold text-dark-text">캡처 업로드</h1>

      <ImageUploader
        onImageSelect={handleImageSelect}
        previews={previews}
        onRemove={handleRemoveImage}
      />

      {/* 분석 중 */}
      {status === 'analyzing' && (
        <Card className="!p-4 flex items-center justify-center gap-3">
          <Spinner />
          <span className="text-sm text-dark-text-secondary">
            AI가 이미지를 분석하고 있습니다...
            {analyzeProgress.total > 1 && (
              <span className="text-dark-text-muted ml-1">
                ({analyzeProgress.done}/{analyzeProgress.total})
              </span>
            )}
          </span>
        </Card>
      )}

      {/* 에러 */}
      {status === 'error' && error && (
        <Card className="!p-4">
          <p className="text-sm text-red-400 font-medium">⚠ {error}</p>
          <p className="text-xs text-dark-text-muted mt-1">
            GAS 배포를 업데이트했는지 확인하세요.
          </p>
        </Card>
      )}

      {/* 분석 결과 */}
      {result && result.holdings.length > 0 && (
        <>
          <Card className="!p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-dark-text">
                {result.broker} · {result.holdings.length}종목 인식
              </span>
              <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                {previews.length > 1 ? `${previews.length}장 합산` : 'AI 분석'}
              </span>
            </div>
          </Card>

          {/* 종목 목록 */}
          <div className="space-y-2">
            {result.holdings.map((h, i) => (
              <Card key={i} className={`!p-3 ${h.ticker === 'UNKNOWN' ? 'border-yellow-500/50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-text truncate">
                      {h.name}
                    </p>
                    <p className="text-xs text-dark-text-muted">
                      {h.ticker !== 'UNKNOWN' ? `${h.ticker} · ` : ''}{fmt(h.quantity)}주
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-medium text-dark-text">
                      {h.currency === 'USD' ? '$' : '₩'}{fmt(h.evalAmount)}
                    </p>
                    {h.profitLoss !== 0 && (
                      <p className={`text-xs ${h.profitLoss > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {h.profitLoss > 0 ? '+' : ''}{fmt(h.profitLoss)}
                      </p>
                    )}
                  </div>
                </div>
                {h.ticker === 'UNKNOWN' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-yellow-400 whitespace-nowrap">종목코드</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="6자리 숫자"
                      maxLength={6}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        e.target.value = val;
                        if (val.length === 6) {
                          setResult((prev) => {
                            if (!prev) return prev;
                            const updated = { ...prev, holdings: prev.holdings.map((item, idx) =>
                              idx === i ? { ...item, ticker: val } : item
                            )};
                            return updated;
                          });
                        }
                      }}
                      className="flex-1 bg-dark-bg text-dark-text text-xs rounded-lg px-2 py-1.5 border border-yellow-500/50 focus:border-accent outline-none tabular-nums"
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* UNKNOWN 종목이 있으면 안내 */}
          {result.holdings.some((h) => h.ticker === 'UNKNOWN') && (
            <Card className="!p-3 border-yellow-500/30">
              <p className="text-xs text-yellow-400">
                종목코드가 없는 항목이 있습니다. 6자리 코드를 입력해주세요.
              </p>
              <p className="text-xs text-dark-text-muted mt-1">
                입력한 코드는 저장되어 다음부터 자동 적용됩니다.
              </p>
            </Card>
          )}

          {/* 예수금 수동 입력 (인식 못했을 때) */}
          {!hasCashInResult && (
            <Card className="!p-3">
              <label className="text-xs text-dark-text-muted block mb-1.5">
                원화예수금 (인식되지 않았다면 직접 입력)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-dark-text-muted">₩</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={cashKrw}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setCashKrw(raw ? Number(raw).toLocaleString() : '');
                  }}
                  className="flex-1 bg-dark-bg text-dark-text text-sm rounded-lg px-3 py-2 border border-dark-border focus:border-accent outline-none tabular-nums"
                />
              </div>
            </Card>
          )}

          {hasCashInResult && (
            <Card className="!p-3 border-success/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-sm font-medium text-success">예수금이 자동 인식되었습니다</span>
              </div>
            </Card>
          )}

          {/* 계좌 선택 + 저장 */}
          <Card className="!p-3 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-dark-text-muted">저장할 계좌</label>
              <button
                onClick={() => setShowAddAccount(!showAddAccount)}
                className="text-xs text-accent font-medium"
              >
                {showAddAccount ? '취소' : '+ 새 계좌'}
              </button>
            </div>

            {showAddAccount ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="계좌 별명 (예: 키움 미국ETF)"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full bg-dark-bg text-dark-text text-sm rounded-lg px-3 py-2 border border-dark-border focus:border-accent outline-none"
                />
                <input
                  type="text"
                  placeholder="증권사 (예: 키움증권)"
                  value={newBroker}
                  onChange={(e) => setNewBroker(e.target.value)}
                  className="w-full bg-dark-bg text-dark-text text-sm rounded-lg px-3 py-2 border border-dark-border focus:border-accent outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewCurrency('USD')}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${newCurrency === 'USD' ? 'bg-accent text-white' : 'bg-dark-bg text-dark-text-muted border border-dark-border'}`}
                  >
                    USD (달러)
                  </button>
                  <button
                    onClick={() => setNewCurrency('KRW')}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${newCurrency === 'KRW' ? 'bg-accent text-white' : 'bg-dark-bg text-dark-text-muted border border-dark-border'}`}
                  >
                    KRW (원화)
                  </button>
                </div>
                <button
                  onClick={handleAddAccount}
                  disabled={!newAccountName || !newBroker}
                  className="w-full py-2 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-40"
                >
                  계좌 추가
                </button>
              </div>
            ) : (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full bg-dark-bg text-dark-text text-sm rounded-lg px-3 py-2 border border-dark-border focus:border-accent outline-none"
              >
                <option value="">계좌를 선택하세요</option>
                {accounts.map((acc) => (
                  <option key={acc.accountId} value={acc.accountId}>
                    {acc.accountName} ({acc.broker})
                  </option>
                ))}
              </select>
            )}

            {!showAddAccount && (
              <button
                onClick={handleSave}
                disabled={!selectedAccountId || status === 'saving' || (result?.holdings.some((h) => h.ticker === 'UNKNOWN') ?? false)}
                className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-40 hover:bg-accent/90 transition-colors"
              >
                {status === 'saving' ? '저장 중...' : result?.holdings.some((h) => h.ticker === 'UNKNOWN') ? '종목코드를 입력해주세요' : '시트에 저장'}
              </button>
            )}
          </Card>
        </>
      )}

      {/* 인식 못 한 경우 */}
      {result && result.holdings.length === 0 && (
        <Card className="!p-4 text-center">
          <p className="text-sm text-yellow-400 font-medium">종목을 인식하지 못했습니다</p>
          <p className="text-xs text-dark-text-muted mt-1">
            보유 종목 목록이 잘 보이도록 캡처해주세요.
          </p>
        </Card>
      )}

      {/* 저장 완료 */}
      {status === 'saved' && (
        <Card className="!p-4 text-center">
          <p className="text-sm text-green-400 font-medium">✓ 저장 완료!</p>
          <p className="text-xs text-dark-text-muted mt-1">
            홈 탭에서 포트폴리오를 확인하세요.
          </p>
        </Card>
      )}

      {/* 초기화 */}
      {previews.length > 0 && (
        <button
          onClick={handleReset}
          className="w-full py-2.5 rounded-xl bg-dark-border text-dark-text-secondary text-sm font-medium hover:bg-dark-text-muted/30 transition-colors"
        >
          초기화
        </button>
      )}
    </div>
  );
}
