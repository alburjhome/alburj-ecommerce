import { ProductsClient } from '@/features/admin/components/products-client';
import { requireAdminServer } from '@/lib/admin-auth-server';

export default async function AdminProductsPage() {
  await requireAdminServer();

  return <ProductsClient />;
}
