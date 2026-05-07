import { CategoriesClient } from '@/features/admin/components/categories-client';
import { requireAdminServer } from '@/lib/admin-auth-server';

export default async function AdminCategoriesPage() {
  await requireAdminServer();

  return <CategoriesClient />;
}
