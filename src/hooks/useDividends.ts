import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getDividends } from '../services/sheetsApi';
import { GAS_WEB_APP_URL } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import {
  generateEstimatedDividendsForYear,
} from '../utils/dividendEstimator';
import type { Dividend, DividendEvent, DividendEventItem, Holding } from '../types';

interface UseDividendsReturn {
  /** 올해 전체 배당 (확정 + 추정) */
  dividends: Dividend[];
  /** 이번 달 총 배당액 */
  totalAmount: number;
  /** 캘린더 이벤트 (날짜별 그룹) */
  calendarEvents: Map<string, DividendEvent>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDividends(
  accountIds: string[],
  month: Date,
  holdings: Holding[],
): UseDividendsReturn {
  const [allDividends, setAllDividends] = useState<Dividend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const year = month.getFullYear();
  const currentMonth = month.getMonth() + 1;

  const fetchData = useCallback(async () => {
    if (!GAS_WEB_APP_URL) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDividends();
      setAllDividends(data);
      hasFetched.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '배당 데이터 로딩 실패');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFetched.current) fetchData();
  }, [fetchData]);

  // 올해 확정 배당 (1월~현재월)
  const thisYearActual = useMemo(() => {
    return allDividends.filter((d) => {
      const date = new Date(d.exDate);
      return date.getFullYear() === year;
    });
  }, [allDividends, year]);

  // 올해 전체 배당: 확정 + 미발표월은 작년 데이터로 추정 (중복 제거)
  const annualDividends = useMemo(() => {
    const estimated = generateEstimatedDividendsForYear(
      holdings, allDividends, year, currentMonth,
    );
    // 확정 데이터가 있는 종목+월 조합은 예상에서 제외
    const actualKeys = new Set(
      thisYearActual.map((d) => `${d.ticker}_${new Date(d.exDate).getMonth() + 1}`),
    );
    const filteredEstimated = estimated.filter((d) => {
      const key = `${d.ticker}_${new Date(d.exDate).getMonth() + 1}`;
      return !actualKeys.has(key);
    });
    return [...thisYearActual, ...filteredEstimated];
  }, [thisYearActual, allDividends, holdings, year, currentMonth]);

  // 캘린더 이벤트 (날짜별 그룹) — payDate 우선, 없으면 exDate
  const calendarEvents = useMemo(() => {
    // 계좌 필터링된 holdings를 ticker별로 매핑
    const holdingMap = new Map<string, Holding[]>();
    holdings
      .filter((h) => accountIds.length === 0 || accountIds.includes(h.accountId))
      .forEach((h) => {
        const list = holdingMap.get(h.ticker) || [];
        list.push(h);
        holdingMap.set(h.ticker, list);
      });

    const grouped = new Map<string, DividendEventItem[]>();

    annualDividends.forEach((div) => {
      const hList = holdingMap.get(div.ticker);
      if (!hList || !div.exDate) return;

      // payDate 우선, 없으면 exDate (YYYY-MM-DD 정규화)
      const rawDate = div.payDate || div.exDate;
      const dateKey = formatDate(new Date(rawDate));

      hList.forEach((h) => {
        const item: DividendEventItem = {
          ticker: div.ticker,
          name: div.name,
          amount: div.amount,
          totalAmount: div.amount * h.quantity,
          quantity: h.quantity,
          currency: div.currency,
          status: div.status,
          accountId: h.accountId,
        };
        const list = grouped.get(dateKey) || [];
        list.push(item);
        grouped.set(dateKey, list);
      });
    });

    const events = new Map<string, DividendEvent>();
    grouped.forEach((items, date) => {
      const totalAmount = items.reduce((sum, i) => sum + i.totalAmount, 0);
      const currency = items[0]?.currency || 'USD';
      events.set(date, { date, dividends: items, totalAmount, currency });
    });

    return events;
  }, [annualDividends, holdings, accountIds]);

  // 이번 달 배당 합계
  const totalAmount = useMemo(() => {
    let sum = 0;
    calendarEvents.forEach((event) => {
      const eventMonth = new Date(event.date).getMonth() + 1;
      if (eventMonth === currentMonth) {
        sum += event.totalAmount;
      }
    });
    return sum;
  }, [calendarEvents, currentMonth]);

  return {
    dividends: annualDividends,
    totalAmount,
    calendarEvents,
    isLoading,
    error,
    refetch: fetchData,
  };
}
