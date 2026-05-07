import { AdminShell } from '@/features/admin/components/admin-shell';
import { requireAdminServer } from '@/lib/admin-auth-server';

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminServer();

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
