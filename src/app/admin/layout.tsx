import { AdminShell } from "@/components/admin/AdminShell";

/** Layout back-office — patrz app/panel/layout.tsx. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
