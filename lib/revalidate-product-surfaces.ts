'use server';

import { revalidatePath } from 'next/cache';
import { createAdminActionClient } from '@/lib/admin-auth';

type ProductSurfaceRecord = {
  id: string;
  slug: string;
  category_id: string | null;
  subcategory_id: string | null;
  is_featured: boolean;
  category: { slug: string } | null;
  subcategory: { slug: string } | null;
};

export async function getProductSurfaceRecord(accessToken: string | null, productId: string) {
  const adminClient = await createAdminActionClient(accessToken);

  const { data, error } = await (adminClient.from('products') as any)
    .select(
      'id, slug, category_id, subcategory_id, is_featured, category:categories(slug), subcategory:subcategories(slug)'
    )
    .eq('id', productId)
    .maybeSingle();

  if (error) throw error;
  return (data as ProductSurfaceRecord | null) ?? null;
}

function safeRevalidate(path: string | null | undefined) {
  if (!path) return;
  revalidatePath(path);
}

export async function revalidateProductSurfaces(params: {
  accessToken: string | null;
  productId: string;
  before?: ProductSurfaceRecord | null;
  after?: ProductSurfaceRecord | null;
}) {
  const { accessToken, productId } = params;

  const before = params.before ?? (await getProductSurfaceRecord(accessToken, productId));
  const after = params.after ?? (await getProductSurfaceRecord(accessToken, productId));

  // Global catalog surfaces
  safeRevalidate('/');
  safeRevalidate('/products');
  safeRevalidate('/categories');

  // Admin surfaces
  safeRevalidate('/admin/products');
  safeRevalidate(`/admin/products/${productId}/edit`);

  // Product surfaces (old/new slug)
  safeRevalidate(before?.slug ? `/product/${before.slug}` : null);
  safeRevalidate(after?.slug ? `/product/${after.slug}` : null);

  // Category surfaces (old/new category)
  safeRevalidate(before?.category?.slug ? `/category/${before.category.slug}` : null);
  safeRevalidate(after?.category?.slug ? `/category/${after.category.slug}` : null);

  // Home depends on featured products; keep it simple and always revalidate '/', but also explicitly if featured.
  if (before?.is_featured || after?.is_featured) {
    safeRevalidate('/');
  }
}
