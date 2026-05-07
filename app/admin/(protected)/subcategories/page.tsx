import { SubcategoriesClient } from '@/features/admin/components/subcategories-client';
import { requireAdminServer } from '@/lib/admin-auth-server';

export default async function AdminSubcategoriesPage() {
  await requireAdminServer();

  return <SubcategoriesClient />;
}
