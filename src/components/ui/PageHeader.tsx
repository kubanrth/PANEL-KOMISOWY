/**
 * Nagłówek strony wg Design Systemu:
 * uppercase label → H1 z kropką → sub-line, opcjonalny CTA po prawej.
 * Kropkę dokleja komponent — podawaj title bez niej.
 */
export function PageHeader({
  label,
  title,
  sub,
  action,
}: {
  label?: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {label && <div className="label">{label}</div>}
        <h1 className="mt-3 font-light text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.02em]">
          {title.replace(/\.$/, "")}.
        </h1>
        {sub && <p className="mt-3 text-[15px] leading-[1.55] text-text-soft max-w-[60ch]">{sub}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </section>
  );
}
