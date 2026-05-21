/**
 * Root loading skeleton. Shown by the Next.js router during navigation
 * (e.g. clicking "Sprzedaj z nami" from the landing). Mimics the header +
 * a content shimmer so the user sees motion immediately, not a black void.
 */
export default function Loading() {
  return (
    <>
      <div className="top-progress" aria-hidden />

      <div className="min-h-screen flex flex-col">
        <header className="border-b border-border-soft">
          <div className="mx-auto max-w-[1240px] px-6 lg:px-10 h-[68px] flex items-center justify-between">
            <div className="shimmer h-5 w-28 rounded-md" />
            <div className="shimmer h-4 w-40 rounded-md hidden sm:block" />
          </div>
        </header>

        <main className="flex-1 px-6 py-16 lg:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="flex flex-col items-center text-center gap-5">
              <div className="h-10 w-10 rounded-full border-2 border-blue/25 border-t-blue animate-[spin_0.9s_linear_infinite]" />
              <div className="shimmer h-8 w-64 rounded-md" />
              <div className="shimmer h-4 w-80 rounded-md" />
              <p className="text-[13px] text-text-mute mt-2">Ładujemy formularz…</p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-[920px] mx-auto">
              <div className="card p-7 space-y-4">
                <div className="shimmer h-3 w-16 rounded" />
                <div className="shimmer h-12 w-full rounded-[12px]" />
                <div className="shimmer h-12 w-full rounded-[12px]" />
                <div className="shimmer h-12 w-2/3 rounded-[12px]" />
              </div>
              <div className="card p-7 space-y-4">
                <div className="shimmer h-3 w-20 rounded" />
                <div className="shimmer h-12 w-full rounded-[12px]" />
                <div className="shimmer h-12 w-full rounded-[12px]" />
                <div className="shimmer h-12 w-1/2 rounded-[12px]" />
              </div>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        .top-progress {
          position: fixed; top: 0; left: 0; right: 0;
          height: 2px; z-index: 100; overflow: hidden;
          background: rgba(0,102,255,0.15);
        }
        .top-progress::after {
          content: ""; position: absolute; inset: 0;
          background: var(--color-blue);
          transform: translateX(-100%);
          animation: top-progress 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes top-progress {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(20%); }
          100% { transform: translateX(120%); }
        }
        .shimmer {
          background: linear-gradient(
            90deg,
            var(--color-surface) 0%,
            var(--color-surface-2) 40%,
            var(--color-surface-2) 60%,
            var(--color-surface) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
}
