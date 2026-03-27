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

  const { holdings, isLoading: holdingsLoading } = useHoldings(selectedAccountIds);
  const { dividends, totalAmount, isLoading: dividendsLoading } = useDividends(
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

  /** 월별 차트 데이터 (주당배당금 × 보유수량) */
  const monthlyData: MonthlyDividendData[] = useMemo(() => {
    const result: MonthlyDividendData[] = [];
    for (let m = 1; m <= MONTHS_IN_YEAR; m++) {
      let actual = 0;
      let estimated = 0;
      dividends.forEach((d) => {
        const date = new Date(d.exDate);
        if (date.getMonth() + 1 !== m) return;
        const holding = holdings.find((h) => h.ticker === d.ticker);
        const qty = holding ? holding.quantity : 0;
        const amount = convert(d.amount * qty * AFTER_TAX_RATE, d.currency);
        // 이미 지난 월은 모두 확정 처리, 미래 월만 예상
        if (m <= currentMonth) {
          actual += amount;
        } else {
          estimated += amount;
        }
      });
      result.push({ month: m, actual, estimated });
    }
    return result;
  }, [dividends, holdings, convert, currentMonth]);

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
    <div className="px-4 py-5 space-y-4">
      {/* 헤더: 총 자산 + 환율 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-dark-text-muted">총 자산</p>
          <p className="text-2xl font-bold text-dark-text">
            {formatCurrency(totalAsset, currentCurrency)}
          </p>
        </div>
        <div className="text-right">
          <button
            onClick={toggle}
            className="px-3 py-1.5 rounded-full bg-dark-surface border border-dark-border text-xs font-medium text-dark-text-secondary hover:text-dark-text transition-colors"
          >
            {currentCurrency}
          </button>
          {rate > 0 && (
            <p className="text-[10px] text-dark-text-muted mt-1">
              $1 = ₩{rate.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* 계좌 선택 */}
      <AccountSelector holdings={holdings} />

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
        holdings={[...holdings].sort((a, b) =>
          (b.currentPrice * b.quantity) - (a.currentPrice * a.quantity)
        )}
        dividends={dividends}
      />
    </div>
  );
}
