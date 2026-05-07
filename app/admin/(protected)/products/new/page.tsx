import { ProductForm } from '@/features/admin/components/product-form';
import { requireAdminServer } from '@/lib/admin-auth-server';

export default async function NewProductPage() {
  await requireAdminServer();

  return <ProductForm mode="create" />;
}
