import { ProductForm } from '@/features/admin/components/product-form';
import { ProductImagesManager } from '@/features/admin/components/product-images-manager';
import { requireAdminServer } from '@/lib/admin-auth-server';

export default async function EditProductPage({ params }: { params: { id: string } }) {
  await requireAdminServer();

  return (
    <div className="space-y-6">
      <ProductForm mode="edit" productId={params.id} />
      <ProductImagesManager productId={params.id} />
    </div>
  );
}
