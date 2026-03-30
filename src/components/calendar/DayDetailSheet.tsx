import { useCurrency } from '../../hooks/useCurrency';
import Badge from '../common/Badge';
import type { DividendEvent } from '../../types';

interface DayDetailSheetProps {
  date: string;
  event: DividendEvent;
  onClose: () => void;
}

/** 날짜 터치 시 바텀시트: 해당일 배당 상세 */
export default function DayDetailSheet({ date, event, onClose }: DayDetailSheetProps) {
  const { format } = useCurrency();

  // 날짜 포맷 (3월 15일 토요일)
  const d = new Date(date);
  const dateLabel = `${d.getMonth() + 1}월 ${d.getDate()}일`;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* 바텀시트 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-dark-surface rounded-t-2xl z-50 pb-20 animate-slide-up">
        {/* 핸들 바 */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 rounded-full bg-dark-border" />
        </div>

        <div className="px-5 pb-4">
          {/* 날짜 + 총액 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-dark-text">{dateLabel}</h3>
            <p className="text-base font-bold text-accent">
              {format(event.totalAmount, event.currency)}
            </p>
          </div>

          {/* 배당 목록 */}
          <div className="space-y-3">
            {event.dividends.map((item, idx) => {
              const market = item.currency === 'USD' ? 'US' : 'KR';

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 border-b border-dark-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Badge market={market} status={item.status} label={/^\d+$/.test(item.ticker) ? item.name : item.ticker} />
                    <div>
                      <p className="text-sm font-medium text-dark-text">{item.name}</p>
                      <p className="text-xs text-dark-text-muted">
                        {item.quantity}주 x {format(item.amount, item.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-dark-text">
                      {format(item.totalAmount, item.currency)}
                    </p>
                    <p className="text-[10px] text-dark-text-muted">
                      {item.status === 'actual' ? '확정' : '예상'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
