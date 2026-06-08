/**
 * Root loading screen. Renderowane przez Next.js router podczas nawigacji
 * (np. po kliknięciu "Sprzedaj z nami" albo przejściu z /panel do /admin).
 *
 * Branding-focused — duże Kickback logo wycentrowane na ekranie, delikatny
 * gradient glow w tle, miękki pulse + top progress bar. Bez placeholderów
 * (shimmer cards rozpraszały). Respektuje theme via --logo-filter.
 */
export default function Loading() {
  return (
    <>
      <div className="kb-top-progress" aria-hidden />

      <div className="kb-loader">
        <div className="kb-glow" aria-hidden />

        <div className="kb-content">
          <div className="kb-logo-wrap">
            <img
              src="/brand_assets/kickback_logo.svg"
              alt="Kickback"
              className="logo-img kb-logo"
            />
          </div>

          <div className="kb-dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>

          <p className="kb-label">Ładowanie</p>
        </div>
      </div>

      <style>{`
        /* Top progress bar — thin, indeterminate */
        .kb-top-progress {
          position: fixed; top: 0; left: 0; right: 0;
          height: 2px; z-index: 100; overflow: hidden;
          background: color-mix(in oklab, var(--color-blue) 12%, transparent);
        }
        .kb-top-progress::after {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(90deg,
            transparent,
            var(--color-blue) 30%,
            var(--color-purple) 50%,
            var(--color-pink) 70%,
            transparent
          );
          transform: translateX(-100%);
          animation: kb-progress 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes kb-progress {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        /* Full-viewport loader container */
        .kb-loader {
          position: relative;
          min-height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-bg);
          overflow: hidden;
        }

        /* Soft brand gradient glow behind the logo */
        .kb-glow {
          position: absolute;
          left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          width: 480px; height: 480px;
          pointer-events: none;
          background:
            radial-gradient(closest-side,
              color-mix(in oklab, var(--color-blue)   22%, transparent),
              transparent 70%
            ),
            radial-gradient(closest-side at 70% 30%,
              color-mix(in oklab, var(--color-purple) 18%, transparent),
              transparent 70%
            ),
            radial-gradient(closest-side at 30% 70%,
              color-mix(in oklab, var(--color-pink)   14%, transparent),
              transparent 70%
            );
          filter: blur(40px);
          animation: kb-glow-drift 6s ease-in-out infinite alternate;
        }
        @keyframes kb-glow-drift {
          0%   { transform: translate(-50%, -50%) scale(1);    opacity: 0.85; }
          100% { transform: translate(-48%, -52%) scale(1.08); opacity: 1; }
        }

        /* Content stack */
        .kb-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
          padding: 24px;
        }

        /* Logo wrapper — keeps SVG inside a soft rounded chip,
           softly breathes via scale animation */
        .kb-logo-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 14px 28px;
          animation: kb-breathe 2.4s ease-in-out infinite;
        }
        @keyframes kb-breathe {
          0%, 100% { transform: scale(1);     opacity: 1; }
          50%      { transform: scale(1.04);  opacity: 0.92; }
        }
        .kb-logo {
          height: 36px;
          width: auto;
          user-select: none;
        }
        @media (min-width: 768px) {
          .kb-logo { height: 48px; }
        }

        /* Three pulsing dots — Apple/Linear-style */
        .kb-dots {
          display: inline-flex;
          gap: 8px;
        }
        .kb-dots span {
          display: inline-block;
          width: 7px; height: 7px;
          border-radius: 999px;
          background: var(--color-text-mute);
          animation: kb-dot 1.2s ease-in-out infinite;
        }
        .kb-dots span:nth-child(2) { animation-delay: 0.15s; }
        .kb-dots span:nth-child(3) { animation-delay: 0.30s; }
        @keyframes kb-dot {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
          40%           { opacity: 1;    transform: translateY(-3px); background: var(--color-blue); }
        }

        .kb-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--color-text-mute);
          margin: 0;
        }
      `}</style>
    </>
  );
}
