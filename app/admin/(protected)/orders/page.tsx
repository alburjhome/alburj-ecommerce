import { OrdersClient } from '@/features/admin/components/orders-client';
import { requireAdminServer } from '@/lib/admin-auth-server';

export default async function AdminOrdersPage() {
  await requireAdminServer();

  return <OrdersClient />;
}
