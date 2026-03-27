interface ToggleProps {
  active: boolean;
  onToggle: () => void;
  label?: string;
  size?: 'sm' | 'md';
}

const SIZE_MAP = {
  sm: { track: 'w-9 h-5', thumb: 'w-4 h-4', translate: 'translateX(16px)' },
  md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translateX(20px)' },
} as const;

/** 토글 스위치 컴포넌트 */
export default function Toggle({ active, onToggle, label, size = 'md' }: ToggleProps) {
  const s = SIZE_MAP[size];

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2"
      role="switch"
      aria-checked={active}
    >
      {label && <span className="text-sm text-dark-text-secondary">{label}</span>}
      <div
        className={`${s.track} rounded-full relative transition-colors duration-200 ${
          active ? 'bg-accent' : 'bg-dark-border'
        }`}
      >
        <div
          className={`${s.thumb} rounded-full bg-white absolute top-0.5 left-0.5 transition-transform duration-200`}
          style={{ transform: active ? s.translate : 'translateX(0)' }}
        />
      </div>
    </button>
  );
}
