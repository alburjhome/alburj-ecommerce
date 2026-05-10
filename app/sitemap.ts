import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://alburj-ecommerce.vercel.app').replace(/\/$/, '');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return [
      {
        url: `${baseUrl}/`,
        changeFrequency: 'daily',
        priority: 1,
      },
    ];
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/products`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/offers`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/restaurants`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/packaging`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/quick-order`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from('categories')
      .select('slug, updated_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    (supabase.from('products') as any)
      .select('slug, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(5000),
  ]);

  const categoryRoutes: MetadataRoute.Sitemap = (categoriesResult.data || [])
    .filter((item: any) => item?.slug)
    .map((item: any) => ({
      url: `${baseUrl}/category/${item.slug}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

  const productRoutes: MetadataRoute.Sitemap = ((productsResult.data || []) as any[])
    .filter((item) => item?.slug)
    .map((item) => ({
      url: `${baseUrl}/product/${item.slug}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
