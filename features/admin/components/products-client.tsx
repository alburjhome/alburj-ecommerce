'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Edit,
  Eye,
  EyeOff,
  ExternalLink,
  PackageOpen,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Tag,
  Sparkles,
  TrendingUp,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Store,
  Filter,
  Layers,
} from 'lucide-react';
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
import { regenerateAllProductSearchFields } from '@/app/actions/admin-search-backfill';
import type { CategoryOption, ProductListFilters, ProductListRow } from '@/app/actions/admin-products';
import { supabase } from '@/lib/supabase';
import { PLACEHOLDER_PRODUCT } from '@/lib/image-utils';
import { getPrimaryProductImage } from '@/lib/product-image';
import { formatPrice } from '@/lib/utils';

const quickFilterOptions = [
  { value: 'all', label: 'كل المنتجات', icon: Layers },
  { value: 'active', label: 'النشطة', icon: CheckCircle2 },
  { value: 'inactive', label: 'غير النشطة', icon: XCircle },
  { value: 'offers', label: 'العروض', icon: Tag },
  { value: 'out_of_stock', label: 'نفد المخزون', icon: AlertTriangle },
  { value: 'featured', label: 'المميزة', icon: Sparkles },
  { value: 'wholesale', label: 'سعر الجملة', icon: Boxes },
] as const;

type QuickFilterValue = typeof quickFilterOptions[number]['value'];

const productBadgesMap: Record<string, { label: string; color: string; icon?: React.ComponentType<{ className?: string }> }> = {
  'offer': { label: 'عرض', color: 'bg-red-100 text-red-700', icon: Tag },
  'new': { label: 'جديد', color: 'bg-green-100 text-green-700', icon: Sparkles },
  'most-requested': { label: 'الأكثر طلبًا', color: 'bg-blue-100 text-blue-700', icon: TrendingUp },
  'wholesale': { label: 'جملة', color: 'bg-purple-100 text-purple-700', icon: Boxes },
  'limited-quantity': { label: 'كمية محدودة', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
};

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

function getPrimaryImage(product: ProductListRow) {
  return getPrimaryProductImage(product);
}

function getStockStatus(product: ProductListRow): { label: string; color: string } {
  if (!product.track_stock) {
    return { label: 'لا يتتبع', color: 'bg-slate-100 text-slate-600' };
  }
  if (product.stock_quantity <= 0) {
    return { label: 'نفد المخزون', color: 'bg-red-100 text-red-700' };
  }
  if (product.stock_quantity <= 5) {
    return { label: 'كمية محدودة', color: 'bg-amber-100 text-amber-700' };
  }
  return { label: 'متوفر', color: 'bg-green-100 text-green-700' };
}

function getActiveBadge(isActive: boolean) {
  return isActive
    ? { label: 'نشط', color: 'bg-green-100 text-green-700' }
    : { label: 'معطل', color: 'bg-slate-100 text-slate-600' };
}

function hasOffer(product: ProductListRow): boolean {
  return Boolean(product.compare_price && product.compare_price > product.price);
}

function productMatchesFilter(product: ProductListRow, filter: QuickFilterValue): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'active':
      return product.is_active;
    case 'inactive':
      return !product.is_active;
    case 'offers':
      return hasOffer(product);
    case 'out_of_stock':
      return product.track_stock && product.stock_quantity <= 0;
    case 'featured':
      return product.is_featured;
    case 'wholesale':
      // Check if product has wholesale badge
      return false; // Will be updated when we fetch product_badges
    default:
      return true;
  }
}

function calculateStats(products: ProductListRow[]) {
  return {
    total: products.length,
    active: products.filter(p => p.is_active).length,
    inactive: products.filter(p => !p.is_active).length,
    offers: products.filter(p => hasOffer(p)).length,
    outOfStock: products.filter(p => p.track_stock && p.stock_quantity <= 0).length,
    featured: products.filter(p => p.is_featured).length,
  };
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
  const [quickFilter, setQuickFilter] = useState<QuickFilterValue>('all');
  const [isBackfillingSearch, setIsBackfillingSearch] = useState(false);

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

  // Client-side filtering
  const filteredProducts = useMemo(() => {
    let result = products;

    // Quick filter
    if (quickFilter !== 'all') {
      result = result.filter(p => productMatchesFilter(p, quickFilter));
    }

    // Search filter (client-side enhancement)
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.category?.name && p.category.name.toLowerCase().includes(term))
      );
    }

    return result;
  }, [products, quickFilter, search]);

  const stats = useMemo(() => calculateStats(products), [products]);

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

  async function handleRegenerateSearchFields() {
    const confirmed = window.confirm(
      'تحديث بيانات البحث لكل المنتجات؟\n\nسيتم تحديث كلمات البحث والنص المطبّع فقط، دون تغيير الأسعار أو الصور أو المخزون أو المتغيرات أو الباكجات.'
    );
    if (!confirmed) return;

    setIsBackfillingSearch(true);
    try {
      const token = await getAccessToken();
      const result = await regenerateAllProductSearchFields(token);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'فشل تحديث بيانات البحث');
      }

      const { updated, total, failed } = result.data;
      toast({
        title: `تم تحديث ${updated} منتج بنجاح`,
        description:
          failed > 0
            ? `من أصل ${total} منتج. فشل ${failed} منتج — راجع السجلات.`
            : `من أصل ${total} منتج. يمكن للعملاء العثور على المنتجات القديمة في البحث الآن.`,
      });
      await loadProducts();
      router.refresh();
    } catch (error) {
      toast({
        title: 'تعذر تحديث بيانات البحث',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsBackfillingSearch(false);
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
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">المنتجات</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة كتالوج المنتجات والأسعار والمخزون.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isBackfillingSearch || isLoading}
            onClick={handleRegenerateSearchFields}
          >
            <RefreshCw className={`ml-2 h-4 w-4 ${isBackfillingSearch ? 'animate-spin' : ''}`} />
            {isBackfillingSearch ? 'جاري التحديث...' : 'تحديث بيانات البحث للمنتجات'}
          </Button>
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="ml-2 h-4 w-4" />
              إضافة منتج
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">الإجمالي</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground text-green-600">النشطة</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground text-slate-500">غير النشطة</p>
          <p className="text-2xl font-bold text-slate-500">{stats.inactive}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground text-red-600">العروض</p>
          <p className="text-2xl font-bold text-red-600">{stats.offers}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground text-amber-600">نفد المخزون</p>
          <p className="text-2xl font-bold text-amber-600">{stats.outOfStock}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground text-purple-600">المميزة</p>
          <p className="text-2xl font-bold text-purple-600">{stats.featured}</p>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        {quickFilterOptions.map((option) => {
          const Icon = option.icon;
          const isActive = quickFilter === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setQuickFilter(option.value);
                resetToFirstPage();
              }}
              className="gap-1.5"
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </Button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetToFirstPage();
              }}
              className="pr-9"
              placeholder="ابحث باسم المنتج أو SKU أو القسم"
            />
          </div>

          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value);
              resetToFirstPage();
            }}
          >
            <SelectTrigger className="w-[180px]">
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

          <Button type="button" variant="outline" onClick={loadProducts} disabled={isLoading}>
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث
          </Button>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          عرض <span className="font-medium text-foreground">{filteredProducts.length}</span> من{' '}
          <span className="font-medium text-foreground">{total}</span> منتج
        </p>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-right font-medium">المنتج</th>
                <th className="px-4 py-3 text-right font-medium">السعر</th>
                <th className="px-4 py-3 text-right font-medium">المخزون</th>
                <th className="px-4 py-3 text-right font-medium">الحالة</th>
                <th className="px-4 py-3 text-left font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="border-b">
                    {Array.from({ length: 5 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4">
                        <div className="h-5 w-full rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading &&
                filteredProducts.map((product) => {
                  const image = getPrimaryImage(product);
                  const stockStatus = getStockStatus(product);
                  const activeBadge = getActiveBadge(product.is_active);
                  const isOnSale = hasOffer(product);

                  return (
                    <tr key={product.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                            <img
                              src={image}
                              alt={product.name}
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.src = PLACEHOLDER_PRODUCT;
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{product.name}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {product.sku && <span className="font-mono">{product.sku}</span>}
                              {product.category?.name && (
                                <>
                                  <span>•</span>
                                  <span>{product.category.name}</span>
                                </>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {product.is_featured && (
                                <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700">
                                  <Sparkles className="h-3 w-3" />
                                  مميز
                                </span>
                              )}
                              {product.product_type === 'bundle' && (
                                <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700">
                                  <Boxes className="h-3 w-3" />
                                  باكج
                                </span>
                              )}
                              {isOnSale && (
                                <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs bg-red-100 text-red-700">
                                  <Tag className="h-3 w-3" />
                                  عرض
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{formatPrice(Number(product.price))}</div>
                        {product.compare_price && product.compare_price > 0 && (
                          <div className="text-xs text-muted-foreground line-through">
                            {formatPrice(Number(product.compare_price))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                        {product.track_stock && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {product.stock_quantity} قطعة
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${activeBadge.color}`}>
                          {product.is_active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {activeBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/products/${product.id}/edit`}>
                              <Edit className="ml-1 h-4 w-4" />
                              تعديل
                            </Link>
                          </Button>
                          {product.slug && (
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="عرض في المتجر">
                              <Link href={`/product/${product.slug}`} target="_blank">
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isMutating === product.id}
                            onClick={() => handleToggle(product)}
                            title={product.is_active ? 'تعطيل' : 'تفعيل'}
                          >
                            {product.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={isMutating === product.id}
                            onClick={() => handleDelete(product)}
                            title="حذف المنتج"
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

        {!isLoading && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <PackageOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              {search || quickFilter !== 'all' ? 'لا توجد منتجات مطابقة' : 'لا توجد منتجات حاليًا'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              {search || quickFilter !== 'all'
                ? 'جرب تغيير البحث أو إزالة الفلاتر'
                : 'أضف أول منتج في الكتالوج'}
            </p>
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus className="ml-2 h-4 w-4" />
                إضافة منتج جديد
              </Link>
            </Button>
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

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex gap-3">
                <div className="h-16 w-16 rounded bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-4 w-1/2 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}

        {!isLoading &&
          filteredProducts.map((product) => {
            const image = getPrimaryImage(product);
            const stockStatus = getStockStatus(product);
            const activeBadge = getActiveBadge(product.is_active);
            const isOnSale = hasOffer(product);

            return (
              <div key={product.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    <img
                      src={image}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = PLACEHOLDER_PRODUCT;
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.sku || 'بدون SKU'}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ${activeBadge.color}`}>
                        {activeBadge.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ${stockStatus.color}`}>
                        {stockStatus.label}
                      </span>
                      {isOnSale && (
                        <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs bg-red-100 text-red-700">
                          عرض
                        </span>
                      )}
                      {product.product_type === 'bundle' && (
                        <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700">
                          باكج
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <span className="font-semibold">{formatPrice(Number(product.price))}</span>
                    {product.compare_price && product.compare_price > 0 && (
                      <span className="text-xs text-muted-foreground line-through mr-2">
                        {formatPrice(Number(product.compare_price))}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                      <Link href={`/admin/products/${product.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    {product.slug && (
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <Link href={`/product/${product.slug}`} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={isMutating === product.id}
                      onClick={() => handleToggle(product)}
                    >
                      {product.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600"
                      disabled={isMutating === product.id}
                      onClick={() => handleDelete(product)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

        {!isLoading && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <PackageOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              {search || quickFilter !== 'all' ? 'لا توجد منتجات مطابقة' : 'لا توجد منتجات حاليًا'}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {search || quickFilter !== 'all'
                ? 'جرب تغيير البحث أو إزالة الفلاتر'
                : 'أضف أول منتج في الكتالوج'}
            </p>
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus className="ml-2 h-4 w-4" />
                إضافة منتج جديد
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
