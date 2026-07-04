"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { breadcrumbLabelFromPath } from "./nav-config";

/**
 * Breadcrumb topbara liczony z pathname (layout-mode: strony nie przekazują
 * breadcrumbów). Sekcja z nav-config; dla tras szczegółowych (produkt,
 * oferta) kontekst daje PageHeader strony.
 * ponytail: bez custom breadcrumbów per strona — sekcja + PageHeader wystarczą.
 */
export function TopbarBreadcrumb({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  const root = admin ? "/admin" : "/panel";
  const rootLabel = admin ? "Admin" : "Panel";
  const label = pathname === root ? undefined : breadcrumbLabelFromPath(pathname, admin);

  return (
    <div className="flex items-center gap-2 text-[13px] text-text-soft overflow-x-auto no-scrollbar">
      <Link href={root} className="hover:text-text whitespace-nowrap">
        {rootLabel}
      </Link>
      {label && (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-text-faint">/</span>
          <span className="text-text">{label}</span>
        </span>
      )}
    </div>
  );
}
