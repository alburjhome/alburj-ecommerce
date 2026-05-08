import { ProductForm } from '@/features/admin/components/product-form';
import { ProductImagesManager } from '@/features/admin/components/product-images-manager';
import { requireAdminServer } from '@/lib/admin-auth-server';

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { focus?: string };
}) {
  await requireAdminServer();

  const focusImages = searchParams?.focus === 'images';

  return (
    <div className="space-y-6">
      <ProductForm mode="edit" productId={params.id} />
      <div id="product-images">
        <ProductImagesManager productId={params.id} focusOnMount={focusImages} />
      </div>
    </div>
  );
}
