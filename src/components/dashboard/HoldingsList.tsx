import Card from '../common/Card';
import { useCurrency } from '../../hooks/useCurrency';
import { formatPercent } from '../../utils/formatters';
import type { Holding, Dividend } from '../../types';
import { calcAnnualYield } from '../../utils/dividendEstimator';

interface HoldingsListProps {
  holdings: Holding[];
  dividends: Dividend[];
}

const MARKET_DOT_COLORS: Record<string, string> = {
  US: 'bg-us-stock',
  KR: 'bg-kr-stock',
};

/** 보유 종목 리스트 카드 */
export default function HoldingsList({ holdings, dividends }: HoldingsListProps) {
  const { format } = useCurrency();

  if (holdings.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-dark-text-secondary mb-2">보유 종목</h3>
      <div className="space-y-2">
        {holdings.map((holding) => {
          const evalAmount = holding.currentPrice * holding.quantity;
          const yieldRate = calcAnnualYield(holding, dividends);
          const dotColor = MARKET_DOT_COLORS[holding.market] || 'bg-dark-text-muted';

          return (
            <Card key={holding.holdingId} className="!p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                  <div>
                    <p className="text-sm font-medium text-dark-text">
                      {holding.name}
                    </p>
                    <p className="text-xs text-dark-text-muted">
                      {holding.ticker} · {holding.quantity}주
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-dark-text">
                    {format(evalAmount, holding.currency)}
                  </p>
                  {yieldRate > 0 && (
                    <p className="text-xs text-success">
                      배당 {formatPercent(yieldRate)}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
