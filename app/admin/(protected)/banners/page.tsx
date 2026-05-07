import { BannersClient } from '@/features/admin/components/banners-client';
import { requireAdminServer } from '@/lib/admin-auth-server';

export default async function AdminBannersPage() {
  await requireAdminServer();

  return <BannersClient />;
}
