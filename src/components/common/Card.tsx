interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/** 다크 테마 카드 컨테이너 */
export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-dark-surface rounded-2xl p-4 border border-dark-border/70 shadow-sm shadow-black/10 ${
        onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
