import { ProductForm } from '@/features/admin/components/product-form';
import { ProductImagesManager } from '@/features/admin/components/product-images-manager';
import { requireAdminServer } from '@/lib/admin-auth-server';
import { getAdminProductFormData } from '@/app/actions/admin-products';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { focus?: string };
}) {
  await requireAdminServer();

  const focusImages = searchParams?.focus === 'images';

  // Fetch product data for AI alt text generation
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  const formDataResult = await getAdminProductFormData(session?.access_token ?? null, params.id);

  const product = formDataResult.success ? formDataResult.data?.product : null;
  const category = product?.category_id
    ? formDataResult.data?.categories.find((c) => c.id === product.category_id)
    : null;

  const productData = product
    ? {
        name: product.name,
        categoryName: category?.name,
        shortDescription: product.short_description ?? undefined,
        marketingTagline: product.marketing_tagline ?? undefined,
        keyFeatures: product.key_features ?? undefined,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <ProductForm mode="edit" productId={params.id} />
      <div id="product-images">
        <ProductImagesManager
          productId={params.id}
          focusOnMount={focusImages}
          productData={productData}
        />
      </div>
    </div>
  );
}
