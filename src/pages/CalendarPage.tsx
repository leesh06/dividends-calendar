import { useState, useCallback } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { useHoldings } from '../hooks/useHoldings';
import { useDividends } from '../hooks/useDividends';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { useCurrency } from '../hooks/useCurrency';
import CalendarHeader from '../components/calendar/CalendarHeader';
import CalendarGrid from '../components/calendar/CalendarGrid';
import MonthlyDividendList from '../components/calendar/MonthlyDividendList';
import Spinner from '../components/common/Spinner';

export default function CalendarPage() {
  const { selectedAccountIds } = useAccountStore();
  const { rate } = useExchangeRate();
  const { currentCurrency, toggle } = useCurrency();

  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { holdings } = useHoldings(selectedAccountIds);
  const { calendarEvents, isLoading } = useDividends(
    selectedAccountIds, currentDate, holdings,
  );

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handlePrevMonth = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDate(null);
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDate(null);
  }, []);

  const handleDayClick = useCallback((date: string) => {
    setSelectedDate((prev) => prev === date ? null : date);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="px-4 py-5 pb-24">
      {/* 헤더 + 통화 토글 */}
      <div className="flex items-center justify-between mb-1">
        <CalendarHeader
          year={year}
          month={month}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />
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

      <CalendarGrid
        year={year}
        month={month}
        events={calendarEvents}
        selectedDate={selectedDate}
        onDayClick={handleDayClick}
      />

      {/* 구분선 */}
      <div className="border-t border-dark-border mt-3" />

      {/* 월간 배당 목록 */}
      <MonthlyDividendList
        events={calendarEvents}
        year={year}
        month={month}
      />
    </div>
  );
}
