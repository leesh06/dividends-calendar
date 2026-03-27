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

  const items = [
    {
      label: `${monthLabel} 배당`,
      value: format(monthlyDividend, currency),
      accent: true,
      icon: '📅',
    },
    {
      label: '연간 배당',
      value: format(annualDividend, currency),
      accent: false,
      icon: '💰',
    },
    {
      label: '배당률',
      value: formatPercent(dividendYield),
      accent: dividendYield >= 0,
      icon: '📈',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <Card key={item.label} className="!p-3 text-center relative overflow-hidden">
          <p className="text-xs text-dark-text-muted mb-1.5 font-semibold">{item.label}</p>
          <p className={`text-base font-extrabold tabular-nums ${
            item.accent ? 'text-accent-light' : 'text-dark-text'
          }`}>
            {item.value}
          </p>
        </Card>
      ))}
    </div>
  );
}
