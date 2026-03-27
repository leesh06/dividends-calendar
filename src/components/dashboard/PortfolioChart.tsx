import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Card from '../common/Card';
import { formatCurrency } from '../../utils/formatters';
import type { Currency } from '../../types';

interface PortfolioChartProps {
  data: PortfolioItem[];
  currency: Currency;
}

export interface PortfolioItem {
  name: string;
  ticker: string;
  value: number;
  color: string;
}

const CHART_SIZE = 160;
const INNER_RADIUS = 50;
const OUTER_RADIUS = 72;

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#6366F1',
];

/** 도넛 차트 (종목별 비중) */
export default function PortfolioChart({ data, currency }: PortfolioChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const PERCENT = 100;
  const chartData = data.map((item, idx) => ({
    ...item,
    color: item.color || COLORS[idx % COLORS.length],
    percent: total > 0 ? ((item.value / total) * PERCENT).toFixed(1) : '0',
  }));

  return (
    <Card>
      <h3 className="text-sm font-medium text-dark-text-secondary mb-3">포트폴리오</h3>
      <div className="flex items-center gap-4">
        {/* 도넛 차트 */}
        <div className="flex-shrink-0">
          <ResponsiveContainer width={CHART_SIZE} height={CHART_SIZE}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={INNER_RADIUS}
                outerRadius={OUTER_RADIUS}
                paddingAngle={2}
                strokeWidth={0}
              >
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#f1f5f9',
                  padding: '6px 10px',
                }}
                formatter={(value: number, _key: string, entry: { payload?: { name?: string } }) => {
                  const name = entry.payload?.name || '';
                  return [`${name}: ${formatCurrency(value, currency)}`, ''];
                }}
                separator=""
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 범례 */}
        <div className="flex-1 space-y-1.5 overflow-hidden">
          {chartData.slice(0, 6).map((item) => (
            <div key={item.ticker} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-dark-text truncate flex-1">{item.name}</span>
              <span className="text-xs text-dark-text-muted flex-shrink-0">{item.percent}%</span>
            </div>
          ))}
          {chartData.length > 6 && (
            <p className="text-[10px] text-dark-text-muted">
              외 {chartData.length - 6}개 종목
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
