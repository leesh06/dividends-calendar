import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts';
import Card from '../common/Card';
import { MONTH_LABELS } from '../../utils/constants';
import { formatNumber } from '../../utils/formatters';
import type { Currency } from '../../types';

interface MonthlyChartProps {
  data: MonthlyDividendData[];
  currentMonth: number;
  currency: Currency;
}

export interface MonthlyDividendData {
  month: number;
  actual: number;
  estimated: number;
}

const BAR_RADIUS = 4;
const CHART_HEIGHT = 180;
const ACTUAL_COLOR = '#3B82F6';
const ESTIMATED_COLOR = 'rgba(59, 130, 246, 0.35)';

/** 커스텀 툴팁 */
function CustomTooltip({ active, payload, label, currencySymbol }: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
  currencySymbol: string;
}) {
  if (!active || !payload) return null;

  const actual = payload.find((p) => p.dataKey === 'actual')?.value || 0;
  const estimated = payload.find((p) => p.dataKey === 'estimated')?.value || 0;
  const total = actual + estimated;

  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-xs">
      <p className="text-white font-medium mb-1">{label}</p>
      {actual > 0 && (
        <p className="text-blue-400">확정: {currencySymbol}{formatNumber(actual)}</p>
      )}
      {estimated > 0 && (
        <p className="text-blue-300/60">예상: {currencySymbol}{formatNumber(estimated)}</p>
      )}
      <p className="text-white mt-1 font-medium">합계: {currencySymbol}{formatNumber(total)}</p>
    </div>
  );
}

export default function MonthlyChart({ data, currentMonth, currency }: MonthlyChartProps) {
  const chartData = data.map((d) => ({
    name: MONTH_LABELS[d.month - 1],
    actual: d.actual,
    estimated: d.estimated,
    total: d.actual + d.estimated,
    isCurrent: d.month === currentMonth,
  }));

  const currencySymbol = currency === 'KRW' ? '₩' : '$';

  return (
    <Card>
      <h3 className="text-sm font-medium text-dark-text-secondary mb-3">월별 배당금</h3>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={chartData} barCategoryGap="20%">
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#cbd5e1', fontSize: 10 }}
          />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            content={<CustomTooltip currencySymbol={currencySymbol} />}
          />
          <Bar dataKey="actual" stackId="div" radius={[0, 0, 0, 0]} name="확정">
            {chartData.map((_entry, idx) => (
              <Cell key={idx} fill={ACTUAL_COLOR} />
            ))}
          </Bar>
          <Bar dataKey="estimated" stackId="div" radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]} name="예상">
            {chartData.map((entry, idx) => (
              <Cell
                key={idx}
                fill={ESTIMATED_COLOR}
                stroke={entry.isCurrent ? ACTUAL_COLOR : 'none'}
                strokeWidth={entry.isCurrent ? 1 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
