import type { DividendStatus, Market } from '../../types';
import { BADGE_COLORS, STATUS_OPACITY } from '../../utils/constants';

interface BadgeProps {
  market: Market;
  status: DividendStatus;
  label: string;
  className?: string;
}

/** 배당 뱃지 (시장별 색상 + 확정/예상 투명도) */
export default function Badge({ market, status, label, className = '' }: BadgeProps) {
  const color = BADGE_COLORS[market];
  const opacity = STATUS_OPACITY[status];

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight ${className}`}
      style={{
        backgroundColor: color,
        opacity,
        color: '#ffffff',
      }}
    >
      {label}
    </span>
  );
}
