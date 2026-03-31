interface CalendarHeaderProps {
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

/** 캘린더 헤더: ◀ 2026.03 ▶ */
export default function CalendarHeader({
  year,
  month,
  onPrevMonth,
  onNextMonth,
}: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-start gap-3">
      <button
        onClick={onPrevMonth}
        className="w-8 h-8 flex items-center justify-center text-dark-text-secondary hover:text-dark-text transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <h2 className="text-page-title text-dark-text">
        {year}.{String(month).padStart(2, '0')}
      </h2>

      <button
        onClick={onNextMonth}
        className="w-8 h-8 flex items-center justify-center text-dark-text-secondary hover:text-dark-text transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
