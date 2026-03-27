import { useMemo } from 'react';
import { useCurrency } from '../../hooks/useCurrency';
import { formatCurrency } from '../../utils/formatters';
import { AFTER_TAX_RATE } from '../../utils/constants';
import Card from '../common/Card';
import type { DividendEvent, Currency } from '../../types';

interface MonthlyDividendListProps {
  events: Map<string, DividendEvent>;
  year: number;
  month: number;
}

interface DayGroup {
  date: string;
  day: number;
  items: {
    ticker: string;
    name: string;
    quantity: number;
    amount: number;
    totalAmount: number;
    currency: Currency;
    status: 'actual' | 'estimated';
  }[];
}

/** 월간 배당 목록 (날짜별 그룹) */
export default function MonthlyDividendList({
  events,
  year,
  month,
}: MonthlyDividendListProps) {
  const { convert, currentCurrency } = useCurrency();

  /** 해당 월 이벤트만 필터 + 날짜순 정렬 */
  const dayGroups: DayGroup[] = useMemo(() => {
    const groups: DayGroup[] = [];

    events.forEach((event, date) => {
      const d = new Date(date);
      if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return;

      groups.push({
        date,
        day: d.getDate(),
        items: event.dividends.map((div) => ({
          ticker: div.ticker,
          name: div.name,
          quantity: div.quantity,
          amount: div.amount,
          totalAmount: div.totalAmount,
          currency: div.currency,
          status: div.status,
        })),
      });
    });

    groups.sort((a, b) => a.day - b.day);
    return groups;
  }, [events, year, month]);

  /** 월간 총 배당 (세후) */
  const monthlyTotal = useMemo(() => {
    return dayGroups.reduce((sum, group) => {
      return sum + group.items.reduce(
        (s, item) => s + convert(item.totalAmount * AFTER_TAX_RATE, item.currency), 0,
      );
    }, 0);
  }, [dayGroups, convert]);

  if (dayGroups.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-dark-text-muted">이 달에는 배당 내역이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-1">
      {/* 월간 요약 */}
      <div className="flex items-center justify-between px-1 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-dark-text">
            {month}월 예상 배당금
          </span>
          <span className="text-[10px] text-dark-text-muted bg-dark-surface px-2 py-0.5 rounded-full">
            세금 15% 적용
          </span>
        </div>
        <span className="text-base font-bold text-dark-text">
          {formatCurrency(monthlyTotal, currentCurrency)}
        </span>
      </div>

      {/* 날짜별 그룹 */}
      {dayGroups.map((group) => (
        <div key={group.date}>
          {/* 날짜 헤더 */}
          <div className="flex items-center gap-2 px-1 pt-3 pb-1">
            <span className="text-xs font-bold text-dark-text-secondary">
              {group.day}일
            </span>
            {group.items[0] && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                group.items[0].status === 'actual'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}>
                {group.items[0].status === 'actual' ? '확정' : '예상'}
              </span>
            )}
          </div>

          {/* 종목 카드 */}
          {group.items.map((item, idx) => (
            <Card key={idx} className="!p-3 !rounded-xl mb-1.5">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark-text">{item.ticker}</p>
                  <p className="text-[11px] text-dark-text-muted truncate">
                    {item.quantity}주 보유 · 주당 {formatCurrency(item.amount, item.currency)}
                  </p>
                </div>
                <p className="text-sm font-medium text-dark-text ml-3">
                  {formatCurrency(
                    convert(item.totalAmount * AFTER_TAX_RATE, item.currency),
                    currentCurrency,
                  )}
                </p>
              </div>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}
