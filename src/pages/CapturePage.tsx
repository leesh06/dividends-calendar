import { useState, useCallback } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { parseCapture, upsertHoldings, addAccount, updateQuotes, fetchDividends } from '../services/sheetsApi';
import type { CaptureResult } from '../services/sheetsApi';
import type { Account } from '../types';
import ImageUploader from '../components/capture/ImageUploader';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';

type Status = 'idle' | 'analyzing' | 'analyzed' | 'saving' | 'saved' | 'error';
type CaptureHolding = CaptureResult['holdings'][number];

const UNKNOWN_BROKER = '알 수 없음';
const MIXED_BROKER_ERROR = '서로 다른 증권사 캡처가 섞여 있어요. 증권사별로 따로 올려주세요.';

/** 예수금(CASH_KRW / CASH_USD) 항목 여부 */
function isCashTicker(ticker: string): boolean {
  return ticker.startsWith('CASH');
}

/** 예수금은 수량 1 · 단가 = 금액으로 통일 (OCR이 단가 칸에 엉뚱한 값을 넣어도 화면에 보인 금액으로 저장) */
function normalizeCash(h: CaptureHolding): CaptureHolding {
  const amount = h.evalAmount || h.avgPrice || h.currentPrice || 0;
  return {
    ...h,
    quantity: 1,
    avgPrice: amount,
    currentPrice: amount,
    evalAmount: amount,
    purchaseAmount: amount,
    profitLoss: 0,
  };
}

/** 같은 종목의 수량/금액을 existing에 합산 */
function addInto(existing: CaptureHolding, h: CaptureHolding): void {
  existing.quantity += h.quantity;
  existing.evalAmount += h.evalAmount;
  existing.purchaseAmount += h.purchaseAmount;
  existing.profitLoss += h.profitLoss;
  if (existing.quantity > 0) {
    existing.avgPrice = existing.purchaseAmount / existing.quantity;
    existing.currentPrice = existing.evalAmount / existing.quantity;
  }
}

/** 판별된 증권사 목록 (중복 제거, '알 수 없음' 제외) */
function knownBrokers(results: CaptureResult[]): string[] {
  const brokers = results.map((r) => r.broker).filter((b) => b && b !== UNKNOWN_BROKER);
  return Array.from(new Set(brokers));
}

/** 복수 OCR 결과를 하나로 합치기 (같은 종목명은 합산, 예수금은 합산하지 않고 마지막 값 사용) */
function mergeResults(results: CaptureResult[]): CaptureResult {
  const broker = knownBrokers(results)[0] || UNKNOWN_BROKER;
  const holdingsMap = new Map<string, CaptureHolding>();

  results.forEach((r) => {
    r.holdings.forEach((h) => {
      // 예수금은 여러 장에 같은 금액이 반복 노출되므로 더하면 2배가 됨 → 덮어쓰기
      if (isCashTicker(h.ticker)) {
        holdingsMap.set(h.ticker, normalizeCash(h));
        return;
      }
      // 종목명 기준으로 합산 (GPT가 같은 종목에 다른 코드를 부여할 수 있으므로)
      const existing = holdingsMap.get(h.name);
      if (existing) addInto(existing, h);
      else holdingsMap.set(h.name, { ...h });
    });
  });

  return { broker, holdings: Array.from(holdingsMap.values()) };
}

/** 증권사명으로 계좌 자동 매칭 (없으면 '') */
function findAccountIdByBroker(accounts: Account[], broker: string): string {
  if (!broker || broker === UNKNOWN_BROKER) return '';
  const core = broker.replace('증권', '');
  const match = accounts.find(
    (a) => a.broker && (a.broker.includes(core) || broker.includes(a.broker.replace('증권', ''))),
  );
  return match?.accountId ?? '';
}

/** File → data URL(base64) */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('이미지 읽기 실패'));
    reader.readAsDataURL(file);
  });
}

/** 이미지를 순서대로 OCR 분석 (GAS 동시 호출 부담을 줄이려고 직렬 처리) */
async function analyzeAll(images: string[], onProgress: (done: number) => void): Promise<CaptureResult[]> {
  const results: CaptureResult[] = [];
  for (const image of images) {
    results.push(await parseCapture(image));
    onProgress(results.length);
  }
  return results;
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
  const [cashUsd, setCashUsd] = useState('');
  const [hasCashKrwInResult, setHasCashKrwInResult] = useState(false);
  const [hasCashUsdInResult, setHasCashUsdInResult] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ done: 0, total: 0 });

  /** 분석 결과 반영 + 예수금 인식 여부 + 계좌 자동 선택 (fresh = 새 계좌 작업 시작) */
  const applyResult = useCallback((merged: CaptureResult, fresh: boolean) => {
    const hasCashKrw = merged.holdings.some((h) => h.ticker === 'CASH_KRW');
    const hasCashUsd = merged.holdings.some((h) => h.ticker === 'CASH_USD');
    setResult(merged);
    setStatus('analyzed');
    setHasCashKrwInResult(hasCashKrw);
    setHasCashUsdInResult(hasCashUsd);
    // 새 계좌 작업이면 이전 계좌에 입력했던 수동 예수금이 따라오지 않도록 비움
    if (fresh || hasCashKrw) setCashKrw('');
    if (fresh || hasCashUsd) setCashUsd('');
    const keepAccount = !fresh && selectedAccountId;
    setSelectedAccountId(keepAccount ? selectedAccountId : findAccountIdByBroker(accounts, merged.broker));
  }, [accounts, selectedAccountId]);

  const handleImageSelect = useCallback(async (files: File[]) => {
    const images = await Promise.all(files.map(readAsDataUrl));
    // 저장을 마친 뒤 올린 캡처는 다음 계좌 작업 → 이전 결과와 합치지 않음
    const prev = status === 'saved' ? null : result;
    setPreviews((p) => (prev ? [...p, ...images] : images));
    setStatus('analyzing');
    setError(null);
    setAnalyzeProgress({ done: 0, total: images.length });

    try {
      const parsed = await analyzeAll(images, (done) => setAnalyzeProgress({ done, total: images.length }));
      if (knownBrokers(parsed).length > 1) {
        setPreviews((p) => p.slice(0, p.length - images.length));
        throw new Error(MIXED_BROKER_ERROR);
      }
      // 이전 결과와 증권사가 다르면 이어 붙이지 않고 새 계좌 작업으로 시작
      const keep = prev && knownBrokers([prev, ...parsed]).length <= 1 ? prev : null;
      if (!keep) setPreviews(images);
      applyResult(mergeResults(keep ? [keep, ...parsed] : parsed), !keep);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 분석 중 오류 발생');
      setStatus('error');
    }
  }, [status, result, applyResult]);

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
      const cashKrwAmount = Number(cashKrw.replace(/,/g, '')) || 0;
      if (cashKrwAmount > 0 && !hasCashKrwInResult) {
        mapped.push({
          ticker: 'CASH_KRW',
          name: '원화예수금',
          quantity: 1,
          avgPrice: cashKrwAmount,
          currentPrice: cashKrwAmount,
          currency: 'KRW',
          market: 'KR',
        });
      }
      const cashUsdAmount = Number(cashUsd.replace(/,/g, '')) || 0;
      if (cashUsdAmount > 0 && !hasCashUsdInResult) {
        mapped.push({
          ticker: 'CASH_USD',
          name: '달러예수금',
          quantity: 1,
          avgPrice: cashUsdAmount,
          currentPrice: cashUsdAmount,
          currency: 'USD',
          market: 'US',
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
  }, [selectedAccountId, result, cashKrw, cashUsd, hasCashKrwInResult, hasCashUsdInResult]);

  const handleAddAccount = useCallback(async () => {
    if (!newAccountName || !newBroker) return;
    // 같은 이름의 계좌가 이미 있으면 그걸 선택
    const existing = accounts.find((a) => a.accountName === newAccountName.trim());
    if (existing) {
      setSelectedAccountId(existing.accountId);
      setShowAddAccount(false);
      setNewAccountName('');
      setNewBroker('');
      return;
    }
    try {
      const created = await addAccount({
        accountName: newAccountName.trim(),
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
    setCashUsd('');
    setHasCashKrwInResult(false);
    setHasCashUsdInResult(false);
    setAnalyzeProgress({ done: 0, total: 0 });
  }, []);

  /** 숫자 포맷 (1000 → 1,000) */
  const fmt = (n: number) => (n ?? 0).toLocaleString();

  return (
    <div className="px-4 py-5 space-y-4">
      <div>
        <h1 className="text-page-title text-dark-text">캡처 업로드</h1>
        <p className="text-sm text-dark-text-muted mt-0.5">증권사 앱 스크린샷을 AI가 분석합니다</p>
      </div>

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
                      placeholder="6자리 (숫자·영문 혼합)"
                      maxLength={6}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(e) => {
                        // 국내 종목코드는 영숫자 혼합 가능 (KRX 2024 개편, I·O·U 제외)
                        const val = e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
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
                      className="flex-1 bg-dark-bg text-dark-text text-xs rounded-lg px-2 py-1.5 border border-yellow-500/50 focus:border-accent outline-none tabular-nums uppercase"
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
          {(!hasCashKrwInResult || !hasCashUsdInResult) && (
            <Card className="!p-3 space-y-2">
              {!hasCashKrwInResult && (
                <div>
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
                </div>
              )}
              {!hasCashUsdInResult && (
                <div>
                  <label className="text-xs text-dark-text-muted block mb-1.5">
                    달러예수금 (인식되지 않았다면 직접 입력)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-dark-text-muted">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={cashUsd}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, '');
                        setCashUsd(raw);
                      }}
                      className="flex-1 bg-dark-bg text-dark-text text-sm rounded-lg px-3 py-2 border border-dark-border focus:border-accent outline-none tabular-nums"
                    />
                  </div>
                </div>
              )}
            </Card>
          )}

          {hasCashKrwInResult && hasCashUsdInResult && (
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
                {accounts
                  .filter((acc) => acc.accountId && acc.accountName)
                  .map((acc) => (
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
