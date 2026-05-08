'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, EyeOff, PackageOpen, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  deleteAdminProduct,
  getAdminProductFormData,
  getAdminProducts,
  toggleAdminProductActive,
} from '@/app/actions/admin-products';
import type { CategoryOption, ProductListFilters, ProductListRow } from '@/app/actions/admin-products';
import { supabase } from '@/lib/supabase';
import { PLACEHOLDER_PRODUCT } from '@/lib/image-utils';
import { getPrimaryProductImage } from '@/lib/product-image';
import { formatPrice } from '@/lib/utils';

const statusOptions = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'active', label: 'نشط' },
  { value: 'inactive', label: 'معطل' },
] as const;

const featuredOptions = [
  { value: 'all', label: 'الكل' },
  { value: 'featured', label: 'مميز' },
  { value: 'not_featured', label: 'غير مميز' },
] as const;

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

function getPrimaryImage(product: ProductListRow) {
  return getPrimaryProductImage(product);
}

export function ProductsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductListRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<ProductListFilters['status']>('all');
  const [featured, setFeatured] = useState<ProductListFilters['featured']>('all');

  const filters = useMemo<ProductListFilters>(
    () => ({
      page,
      search,
      category,
      status,
      featured,
    }),
    [category, featured, page, search, status]
  );

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const [listResult, formDataResult] = await Promise.all([
        getAdminProducts(token, filters),
        getAdminProductFormData(token),
      ]);

      if (!listResult.success || !listResult.data) {
        throw new Error(listResult.error || 'تعذر تحميل المنتجات');
      }

      if (!formDataResult.success || !formDataResult.data) {
        throw new Error(formDataResult.error || 'تعذر تحميل الفلاتر');
      }

      setProducts(listResult.data.products);
      setTotalPages(listResult.data.totalPages);
      setTotal(listResult.data.total);
      setCategories(formDataResult.data.categories);
    } catch (error) {
      toast({
        title: 'تعذر تحميل المنتجات',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function resetToFirstPage() {
    if (page !== 1) {
      setPage(1);
    }
  }

  async function handleToggle(product: ProductListRow) {
    const nextStatus = !product.is_active;
    setIsMutating(product.id);

    try {
      const token = await getAccessToken();
      const result = await toggleAdminProductActive(token, product.id, nextStatus);

      if (!result.success) {
        throw new Error(result.error || 'فشلت العملية');
      }

      toast({
        title: nextStatus ? 'تم تفعيل المنتج' : 'تم تعطيل المنتج',
        description: product.name,
      });
      await loadProducts();
      router.refresh();
    } catch (error) {
      toast({
        title: 'تعذر تغيير حالة المنتج',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsMutating(null);
    }
  }

  async function handleDelete(product: ProductListRow) {
    const confirmed = window.confirm(
      `حذف المنتج "${product.name}" نهائيًا؟\n\nهذا الإجراء لا يمكن التراجع عنه. الخيار الأفضل عادة هو تعطيل المنتج فقط.`
    );

    if (!confirmed) return;

    setIsMutating(product.id);
    try {
      const token = await getAccessToken();
      const result = await deleteAdminProduct(token, product.id);

      if (!result.success) {
        throw new Error(result.error || 'فشل حذف المنتج');
      }

      toast({ title: 'تم حذف المنتج', description: product.name });
      await loadProducts();
      router.refresh();
    } catch (error) {
      toast({
        title: 'تعذر حذف المنتج',
        description: error instanceof Error ? error.message : 'قد يكون المنتج مرتبطًا بطلبات أو عناصر أخرى',
        variant: 'destructive',
      });
    } finally {
      setIsMutating(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">المنتجات</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة كتالوج المنتجات والأسعار والمخزون.</p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="ml-2 h-4 w-4" />
            إضافة منتج
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetToFirstPage();
              }}
              className="pr-9"
              placeholder="بحث بالاسم أو SKU"
            />
          </div>

          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value);
              resetToFirstPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="القسم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأقسام</SelectItem>
              {categories.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as ProductListFilters['status']);
              resetToFirstPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={featured}
            onValueChange={(value) => {
              setFeatured(value as ProductListFilters['featured']);
              resetToFirstPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="مميز" />
            </SelectTrigger>
            <SelectContent>
              {featuredOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="button" variant="outline" onClick={loadProducts} disabled={isLoading}>
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-right font-medium">الصورة</th>
                <th className="px-4 py-3 text-right font-medium">الاسم</th>
                <th className="px-4 py-3 text-right font-medium">السعر</th>
                <th className="px-4 py-3 text-right font-medium">قبل الخصم</th>
                <th className="px-4 py-3 text-right font-medium">القسم</th>
                <th className="px-4 py-3 text-right font-medium">المخزون</th>
                <th className="px-4 py-3 text-right font-medium">الحالة</th>
                <th className="px-4 py-3 text-right font-medium">مميز</th>
                <th className="px-4 py-3 text-left font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="border-b">
                    {Array.from({ length: 9 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4">
                        <div className="h-5 w-full rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading &&
                products.map((product) => {
                  const image = getPrimaryImage(product);

                  return (
                    <tr key={product.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border bg-muted">
                          <img
                            src={image}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.src = PLACEHOLDER_PRODUCT;
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground">{product.sku || 'بدون SKU'}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">{formatPrice(Number(product.price))}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {product.compare_price ? formatPrice(Number(product.compare_price)) : '-'}
                      </td>
                      <td className="px-4 py-3">{product.category?.name || '-'}</td>
                      <td className="px-4 py-3">{product.track_stock ? product.stock_quantity : 'غير متتبع'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            product.is_active
                              ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700'
                              : 'rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700'
                          }
                        >
                          {product.is_active ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{product.is_featured ? 'نعم' : 'لا'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/products/${product.id}/edit`}>
                              <Edit className="ml-1 h-4 w-4" />
                              تعديل
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={isMutating === product.id}
                            onClick={() => handleToggle(product)}
                          >
                            <EyeOff className="ml-1 h-4 w-4" />
                            {product.is_active ? 'تعطيل' : 'تفعيل'}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={isMutating === product.id}
                            onClick={() => handleDelete(product)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {!isLoading && products.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <PackageOpen className="h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">لا توجد منتجات</h2>
            <p className="mt-1 text-sm text-muted-foreground">غيّر الفلاتر أو أضف أول منتج في الكتالوج.</p>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            إجمالي النتائج: <span className="font-medium text-foreground">{total}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              السابق
            </Button>
            <span>
              صفحة {page} من {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              التالي
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
