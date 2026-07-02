/**
 * Empty state wg Design Systemu: dashed border, ikona w ramce,
 * nagłówek, 1-2 zdania, opcjonalny CTA.
 */
export function EmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-border rounded-[20px] px-8 py-12 flex flex-col items-center text-center">
      {icon && (
        <div className="h-12 w-12 rounded-[14px] bg-surface-2 border border-border-soft flex items-center justify-center text-text-mute [&>svg]:h-6 [&>svg]:w-6">
          {icon}
        </div>
      )}
      <div className={`${icon ? "mt-4" : ""} font-medium text-[17px] tracking-[-0.015em]`}>{title}</div>
      {sub && <p className="mt-2 text-[13px] leading-[1.55] text-text-soft max-w-[44ch]">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
