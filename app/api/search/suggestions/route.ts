import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { filterProductsBySearch } from '@/lib/product-search';
import { getPrimaryProductImage } from '@/lib/product-image';
import type { ProductWithDetails } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const { data, error } = await (supabase.from('products') as any)
    .select('*, images:product_images(*), variants:product_variants(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(250);

  if (error) {
    return NextResponse.json({ results: [] });
  }

  const products = ((data || []) as ProductWithDetails[]).map((product) => ({
    ...product,
    variants: product.variants || [],
    images: [...(product.images || [])].sort((a, b) => a.sort_order - b.sort_order),
  }));

  const matched = filterProductsBySearch(products, q, { minScore: 35, limit: 8 });

  const results = matched.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    image: getPrimaryProductImage(product),
    isBundle: (product.product_type || 'single') === 'bundle',
  }));

  return NextResponse.json({ results });
}
