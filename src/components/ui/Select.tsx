import type { SelectHTMLAttributes } from "react";

/* Natywny <select> w brandzie: .input + appearance-none + własny chevron.
   Children = <option> (styl opcji globalnie w globals.css: .input option).
   Server-friendly — zero JS, focus ring dziedziczy z .input:focus. */
export function Select({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select {...rest} className={`input appearance-none pr-10 cursor-pointer ${className}`}>
        {children}
      </select>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-mute"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}
