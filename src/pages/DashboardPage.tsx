import { useMemo } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { useCurrency } from '../hooks/useCurrency';
import { useHoldings } from '../hooks/useHoldings';
import { useDividends } from '../hooks/useDividends';
import { useExchangeRate } from '../hooks/useExchangeRate';
import AccountSelector from '../components/dashboard/AccountSelector';
import SummaryCard from '../components/dashboard/SummaryCard';
import MonthlyChart from '../components/dashboard/MonthlyChart';
import type { MonthlyDividendData } from '../components/dashboard/MonthlyChart';
import PortfolioChart from '../components/dashboard/PortfolioChart';
import type { PortfolioItem } from '../components/dashboard/PortfolioChart';
import HoldingsList from '../components/dashboard/HoldingsList';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency } from '../utils/formatters';
import { MONTH_LABELS, AFTER_TAX_RATE } from '../utils/constants';

const MONTHS_IN_YEAR = 12;
const PERCENT = 100;

const PORTFOLIO_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#6366F1',
];

export default function DashboardPage() {
  const { selectedAccountIds } = useAccountStore();
  const { currentCurrency, toggle, convert } = useCurrency();
  const { rate } = useExchangeRate();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  const { holdings, allHoldings: allHoldingsData, isLoading: holdingsLoading, refetch: refetchHoldings } = useHoldings(selectedAccountIds);
  const { dividends, allDividends, isLoading: dividendsLoading } = useDividends(
    selectedAccountIds, now, holdings,
  );

  const isLoading = holdingsLoading || dividendsLoading;

  /** 총 자산 계산 */
  const totalAsset = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const val = h.currentPrice * h.quantity;
      return sum + convert(val, h.currency);
    }, 0);
  }, [holdings, convert]);

  const lastYear = now.getFullYear() - 1;

  /** 월별 차트 데이터 (주당배당금 × 보유수량) + 작년 동월 비교 */
  const monthlyData: MonthlyDividendData[] = useMemo(() => {
    const result: MonthlyDividendData[] = [];
    for (let m = 1; m <= MONTHS_IN_YEAR; m++) {
      let actual = 0;
      let estimated = 0;
      // 올해 배당
      dividends.forEach((d) => {
        const date = new Date(d.exDate);
        if (date.getMonth() + 1 !== m) return;
        const holding = holdings.find((h) => h.ticker === d.ticker);
        const qty = holding ? holding.quantity : 0;
        const amount = convert(d.amount * qty * AFTER_TAX_RATE, d.currency);
        if (m <= currentMonth) {
          actual += amount;
        } else {
          estimated += amount;
        }
      });
      // 작년 동월 배당 (현재 보유수량 기준)
      let lastYearAmount = 0;
      allDividends
        .filter((d) => {
          const date = new Date(d.exDate);
          return date.getFullYear() === lastYear
            && date.getMonth() + 1 === m
            && d.status === 'actual';
        })
        .forEach((d) => {
          const holding = holdings.find((h) => h.ticker === d.ticker);
          const qty = holding ? holding.quantity : 0;
          lastYearAmount += convert(d.amount * qty * AFTER_TAX_RATE, d.currency);
        });
      result.push({ month: m, actual, estimated, lastYear: lastYearAmount });
    }
    return result;
  }, [dividends, allDividends, holdings, convert, currentMonth, lastYear]);

  /** 연간 배당금 합계 (월별 차트와 동일 데이터 사용) */
  const annualDividend = useMemo(() => {
    return monthlyData.reduce((sum, m) => sum + m.actual + m.estimated, 0);
  }, [monthlyData]);

  /** 배당률 */
  const dividendYield = totalAsset > 0 ? (annualDividend / totalAsset) * PERCENT : 0;

  /** 포트폴리오 차트 데이터 (비중 높은 순 정렬) */
  const portfolioData: PortfolioItem[] = useMemo(() => {
    return holdings
      .map((h) => ({
        name: h.name,
        ticker: h.ticker,
        value: convert(h.currentPrice * h.quantity, h.currency),
        color: '',
      }))
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((p, idx) => ({
        ...p,
        color: PORTFOLIO_COLORS[idx % PORTFOLIO_COLORS.length],
      }));
  }, [holdings, convert]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5">
      {/* 헤더: 총 자산 + 환율 토글 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-warm/10 via-dark-surface to-dark-surface border border-warm/10 p-4 shadow-lg shadow-black/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-warm/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-section-heading mb-1">총 자산</p>
            <p className="text-money-lg text-warm">
              {formatCurrency(totalAsset, currentCurrency)}
            </p>
            {rate > 0 && (
              <p className="text-xs text-dark-text-muted mt-1.5">
                $1 = ₩{rate.toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={toggle}
            className="px-4 py-2 rounded-xl bg-dark-bg/60 border border-dark-border/60 text-xs font-bold text-dark-text-secondary hover:text-dark-text hover:border-blue-500/30 transition-all duration-200 backdrop-blur-sm"
          >
            {currentCurrency}
          </button>
        </div>
      </div>

      {/* 계좌 선택 */}
      <AccountSelector allHoldings={allHoldingsData} onAccountDeleted={refetchHoldings} />

      {/* 배당 요약 */}
      <SummaryCard
        monthlyDividend={monthlyData[currentMonth - 1]
          ? monthlyData[currentMonth - 1].actual + monthlyData[currentMonth - 1].estimated
          : 0}
        annualDividend={annualDividend}
        dividendYield={dividendYield}
        currency={currentCurrency}
        monthLabel={MONTH_LABELS[currentMonth - 1]}
      />

      {/* 월별 배당 차트 */}
      <MonthlyChart
        data={monthlyData}
        currentMonth={currentMonth}
        currency={currentCurrency}
      />

      {/* 포트폴리오 도넛 차트 */}
      {portfolioData.length > 0 ? (
        <PortfolioChart data={portfolioData} currency={currentCurrency} />
      ) : (
        <EmptyState
          title="보유 종목이 없습니다"
          description="캡처 탭에서 증권사 스크린샷을 업로드하세요"
        />
      )}

      {/* 보유 종목 리스트 */}
      <HoldingsList
        holdings={holdings}
        dividends={allDividends}
      />
    </div>
  );
}
