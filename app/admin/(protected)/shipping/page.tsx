import { ShippingClient } from '@/features/admin/components/shipping-client';
import { requireAdminServer } from '@/lib/admin-auth-server';

export default async function AdminShippingPage() {
  await requireAdminServer();

  return <ShippingClient />;
}
