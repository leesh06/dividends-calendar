import type { Dividend, DividendEventItem, Holding } from '../types';

const MONTHS_IN_YEAR = 12;

/** 전년도 동월 배당금으로 미발표 배당 추정 */
export function estimateDividend(
  ticker: string,
  targetMonth: number,
  targetYear: number,
  historicalDividends: Dividend[],
): number {
  // 전년도 동월 배당 찾기
  const lastYearDivs = historicalDividends.filter((d) => {
    if (d.ticker !== ticker) return false;
    const date = new Date(d.exDate);
    return (
      date.getMonth() + 1 === targetMonth &&
      date.getFullYear() === targetYear - 1 &&
      d.status === 'actual'
    );
  });

  if (lastYearDivs.length > 0) {
    return lastYearDivs.reduce((sum, d) => sum + d.amount, 0);
  }

  // 작년 동월 데이터가 없으면 배당 없는 달 → 0
  return 0;
}

/** 연간 배당 수익률 계산 */
export function calcAnnualYield(
  holding: Holding,
  dividends: Dividend[],
): number {
  const tickerDivs = dividends.filter(
    (d) => d.ticker === holding.ticker && d.status === 'actual',
  );

  if (tickerDivs.length === 0 || holding.currentPrice === 0) return 0;

  // 최근 12개월 배당 합산
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const recentDivs = tickerDivs.filter(
    (d) => new Date(d.exDate) >= oneYearAgo,
  );

  const annualDividend = recentDivs.reduce((sum, d) => sum + d.amount, 0);
  const PERCENT = 100;

  return (annualDividend / holding.currentPrice) * PERCENT;
}

/** 보유 종목 기반으로 월별 배당 이벤트 아이템 생성 */
export function buildDividendEventItems(
  dividends: Dividend[],
  holdings: Holding[],
  accountIds: string[],
): DividendEventItem[] {
  const holdingMap = new Map<string, Holding[]>();
  holdings
    .filter((h) => accountIds.length === 0 || accountIds.includes(h.accountId))
    .forEach((h) => {
      const list = holdingMap.get(h.ticker) || [];
      list.push(h);
      holdingMap.set(h.ticker, list);
    });

  const items: DividendEventItem[] = [];

  dividends.forEach((div) => {
    const hList = holdingMap.get(div.ticker);
    if (!hList) return;

    hList.forEach((h) => {
      items.push({
        ticker: div.ticker,
        name: div.name,
        amount: div.amount,
        totalAmount: div.amount * h.quantity,
        quantity: h.quantity,
        currency: div.currency,
        status: div.status,
        accountId: h.accountId,
      });
    });
  });

  return items;
}

/** 월별 예상 배당 생성 (미발표 월) - 단일 월 */
export function generateEstimatedDividends(
  holdings: Holding[],
  historicalDividends: Dividend[],
  year: number,
  month: number,
): Dividend[] {
  const estimated: Dividend[] = [];
  const existingTickers = new Set(
    historicalDividends
      .filter((d) => {
        const date = new Date(d.exDate);
        return date.getFullYear() === year && date.getMonth() + 1 === month;
      })
      .map((d) => d.ticker),
  );

  const uniqueTickers = [...new Set(holdings.map((h) => h.ticker))];

  uniqueTickers.forEach((ticker) => {
    if (existingTickers.has(ticker)) return;

    const amount = estimateDividend(ticker, month, year, historicalDividends);
    if (amount === 0) return;

    const holding = holdings.find((h) => h.ticker === ticker);
    if (!holding) return;

    const MID_MONTH = 15;
    estimated.push({
      dividendId: `est_${ticker}_${year}${String(month).padStart(2, '0')}`,
      ticker,
      name: holding.name,
      exDate: `${year}-${String(month).padStart(2, '0')}-${MID_MONTH}`,
      payDate: '',
      amount,
      currency: holding.currency,
      frequency: 'monthly',
      status: 'estimated',
      source: 'estimated',
      updatedAt: new Date().toISOString(),
    });
  });

  return estimated;
}

/**
 * 연간 예상 배당 생성
 * - 올해 이미 확정 데이터가 있는 월은 건너뜀
 * - 아직 데이터 없는 월은 작년 동월 기준으로 추정
 * @param currentMonth 현재 월 (참고용, 미래 월만 추정하는 게 아니라 데이터 없는 모든 월을 추정)
 */
export function generateEstimatedDividendsForYear(
  holdings: Holding[],
  historicalDividends: Dividend[],
  year: number,
  _currentMonth: number,
): Dividend[] {
  const allEstimated: Dividend[] = [];

  for (let m = 1; m <= MONTHS_IN_YEAR; m++) {
    const monthEstimates = generateEstimatedDividends(
      holdings, historicalDividends, year, m,
    );
    allEstimated.push(...monthEstimates);
  }

  return allEstimated;
}
