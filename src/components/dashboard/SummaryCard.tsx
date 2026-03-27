import Card from '../common/Card';
import { useCurrency } from '../../hooks/useCurrency';
import { formatPercent } from '../../utils/formatters';
import type { Currency } from '../../types';

interface SummaryCardProps {
  monthlyDividend: number;
  annualDividend: number;
  dividendYield: number;
  currency: Currency;
  monthLabel: string;
}

/** 배당 요약 카드 (이번 달, 연간, 배당률) */
export default function SummaryCard({
  monthlyDividend,
  annualDividend,
  dividendYield,
  currency,
  monthLabel,
}: SummaryCardProps) {
  const { format } = useCurrency();

  return (
    <div className="grid grid-cols-3 gap-2">
      <Card className="!p-3 text-center">
        <p className="text-[10px] text-dark-text-muted mb-1">{monthLabel} 배당</p>
        <p className="text-base font-bold text-accent">
          {format(monthlyDividend, currency)}
        </p>
      </Card>
      <Card className="!p-3 text-center">
        <p className="text-[10px] text-dark-text-muted mb-1">연간 배당</p>
        <p className="text-base font-bold text-dark-text">
          {format(annualDividend, currency)}
        </p>
      </Card>
      <Card className="!p-3 text-center">
        <p className="text-[10px] text-dark-text-muted mb-1">배당률</p>
        <p className={`text-base font-bold ${dividendYield >= 0 ? 'text-success' : 'text-danger'}`}>
          {formatPercent(dividendYield)}
        </p>
      </Card>
    </div>
  );
}
