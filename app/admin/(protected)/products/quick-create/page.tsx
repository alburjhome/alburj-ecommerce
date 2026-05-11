import { requireAdminServer } from '@/lib/admin-auth-server';
import { QuickProductCreator } from '@/features/admin/components/quick-product-creator';

export default async function QuickCreateProductPage() {
  await requireAdminServer();

  return <QuickProductCreator />;
}
