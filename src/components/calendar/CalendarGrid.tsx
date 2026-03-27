import { useMemo } from 'react';
import DayCell from './DayCell';
import { WEEKDAY_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/formatters';
import { useCurrency } from '../../hooks/useCurrency';
import type { DividendEvent } from '../../types';

interface CalendarGridProps {
  year: number;
  month: number;
  events: Map<string, DividendEvent>;
  selectedDate: string | null;
  onDayClick: (date: string) => void;
}

const DAYS_IN_WEEK = 7;

interface CalendarDay {
  day: number;
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
}

/** 7열 캘린더 그리드 (필요한 행만 렌더링) */
export default function CalendarGrid({
  year,
  month,
  events,
  selectedDate,
  onDayClick,
}: CalendarGridProps) {
  const today = formatDate(new Date());
  const { convert, currentCurrency } = useCurrency();

  const days: CalendarDay[] = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

    const result: CalendarDay[] = [];
    const totalDays = startDayOfWeek + daysInMonth;
    const totalCells = Math.ceil(totalDays / DAYS_IN_WEEK) * DAYS_IN_WEEK;

    for (let i = 0; i < totalCells; i++) {
      const dayOffset = i - startDayOfWeek;

      if (dayOffset < 0) {
        const day = daysInPrevMonth + dayOffset + 1;
        const m = month === 1 ? 12 : month - 1;
        const y = month === 1 ? year - 1 : year;
        result.push({
          day,
          date: formatDate(new Date(y, m - 1, day)),
          isCurrentMonth: false,
          isToday: false,
        });
      } else if (dayOffset >= daysInMonth) {
        const day = dayOffset - daysInMonth + 1;
        const m = month === 12 ? 1 : month + 1;
        const y = month === 12 ? year + 1 : year;
        result.push({
          day,
          date: formatDate(new Date(y, m - 1, day)),
          isCurrentMonth: false,
          isToday: false,
        });
      } else {
        const day = dayOffset + 1;
        const date = formatDate(new Date(year, month - 1, day));
        result.push({
          day,
          date,
          isCurrentMonth: true,
          isToday: date === today,
        });
      }
    }

    return result;
  }, [year, month, today]);

  /** 이벤트의 총 금액 계산 (현재 통화 기준) */
  function getEventTotal(event?: DividendEvent): number {
    if (!event) return 0;
    return event.dividends.reduce(
      (sum, d) => sum + convert(d.totalAmount, d.currency), 0,
    );
  }

  return (
    <div>
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={`text-center text-[11px] font-medium py-1.5 ${
              idx === 0 ? 'text-danger' : idx === 6 ? 'text-accent' : 'text-dark-text-muted'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7">
        {days.map((d, idx) => {
          const event = events.get(d.date);
          return (
            <DayCell
              key={idx}
              day={d.day}
              isCurrentMonth={d.isCurrentMonth}
              isToday={d.isToday}
              isSelected={selectedDate === d.date}
              event={event}
              totalAmount={getEventTotal(event)}
              currency={currentCurrency}
              onClick={() => onDayClick(d.date)}
            />
          );
        })}
      </div>
    </div>
  );
}
