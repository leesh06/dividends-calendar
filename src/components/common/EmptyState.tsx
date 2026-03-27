interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

/** 데이터 없음 안내 */
export default function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="text-dark-text-muted mb-3">{icon}</div>}
      <p className="text-dark-text-secondary font-medium">{title}</p>
      {description && (
        <p className="text-dark-text-muted text-sm mt-1">{description}</p>
      )}
    </div>
  );
}
