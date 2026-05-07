import { SettingsClient } from '@/features/admin/components/settings-client';
import { requireAdminServer } from '@/lib/admin-auth-server';

export default async function AdminSettingsPage() {
  await requireAdminServer();

  return <SettingsClient />;
}
