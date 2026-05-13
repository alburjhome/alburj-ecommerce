'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, PackagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SafeImage } from '@/components/ui/safe-image';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { PLACEHOLDER_PRODUCT, safeImageSrc } from '@/lib/image-utils';
import { formatPrice } from '@/lib/utils';
import {
  getAdminBundleEditorData,
  saveAdminBundleItems,
  type AdminBundleItemInput,
  type AdminBundleItemRow,
  type AdminBundleProductOption,
  type AdminBundleVariantOption,
} from '@/app/actions/admin-bundles';

export interface ProductBundleSummary {
  itemCount: number;
  retailTotal: number;
  hasInvalidItems: boolean;
}

interface ProductBundleItemsManagerProps {
  productId?: string;
  isBundle: boolean;
  basePrice: number;
  ensureProductId?: () => Promise<string>;
  onStateChange?: (summary: ProductBundleSummary) => void;
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

function getProductImage(product: AdminBundleProductOption | null | undefined) {
  const sorted = [...(product?.images || [])].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return a.sort_order - b.sort_order;
  });

  return safeImageSrc(sorted[0]?.url, PLACEHOLDER_PRODUCT);
}

function getVariantLabel(variant: AdminBundleVariantOption | null | undefined) {
  if (!variant) return '';
  const options = variant.options && Object.keys(variant.options).length > 0
    ? variant.options
    : null;

  if (options) {
    return Object.entries(options)
      .map(([name, value]) => `${name}: ${value}`)
      .join('، ');
  }

  return variant.name;
}

function getItemUnitPrice(item: AdminBundleItemRow) {
  if (item.item_variant) return Number(item.item_variant.price || 0);
  return Number(item.item_product?.price || 0);
}

function buildInputs(items: AdminBundleItemRow[]): AdminBundleItemInput[] {
  return items.map((item, index) => ({
    item_product_id: item.item_product_id,
    item_variant_id: item.item_variant_id,
    quantity: Math.max(1, Number(item.quantity) || 1),
    sort_order: (index + 1) * 10,
  }));
}

export function ProductBundleItemsManager({
  productId,
  isBundle,
  basePrice,
  ensureProductId,
  onStateChange,
}: ProductBundleItemsManagerProps) {
  const { toast } = useToast();
  const [resolvedProductId, setResolvedProductId] = useState(productId || '');
  const [products, setProducts] = useState<AdminBundleProductOption[]>([]);
  const [items, setItems] = useState<AdminBundleItemRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentProductId = productId || resolvedProductId;

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const selectedProductVariants = useMemo(
    () => (selectedProduct?.variants || []).filter((variant) => variant.is_active),
    [selectedProduct]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((product) => product.id !== currentProductId)
      .filter((product) => product.product_type !== 'bundle')
      .filter((product) => {
        if (!term) return true;
        return product.name.toLowerCase().includes(term) || product.slug.toLowerCase().includes(term);
      })
      .slice(0, 80);
  }, [currentProductId, products, search]);

  const retailTotal = useMemo(
    () => items.reduce((sum, item) => sum + getItemUnitPrice(item) * item.quantity, 0),
    [items]
  );

  useEffect(() => {
    setResolvedProductId(productId || '');
  }, [productId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const result = await getAdminBundleEditorData(token, currentProductId || undefined);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر تحميل بيانات الباكج');
      }

      setProducts(result.data.products);
      setItems(result.data.bundleItems);
    } catch (error) {
      toast({
        title: 'تعذر تحميل محتويات الباكج',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentProductId, toast]);

  useEffect(() => {
    if (!isBundle) return;
    loadData();
  }, [isBundle, loadData]);

  useEffect(() => {
    onStateChange?.({
      itemCount: items.length,
      retailTotal,
      hasInvalidItems: items.some((item) => item.quantity <= 0 || !item.item_product),
    });
  }, [items, onStateChange, retailTotal]);

  async function ensureBundleProductId() {
    if (currentProductId) return currentProductId;
    if (!ensureProductId) throw new Error('احفظ المنتج كمسودة أولًا');
    const id = await ensureProductId();
    setResolvedProductId(id);
    return id;
  }

  async function persist(nextItems: AdminBundleItemRow[], productIdOverride?: string) {
    const bundleId = productIdOverride || (await ensureBundleProductId());
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      const result = await saveAdminBundleItems(token, bundleId, buildInputs(nextItems));

      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ محتويات الباكج');
      }

      setItems(result.data || []);
      toast({ title: 'تم حفظ محتويات الباكج' });
    } catch (error) {
      toast({
        title: 'تعذر حفظ محتويات الباكج',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function addItem() {
    if (!selectedProduct) {
      toast({ title: 'اختر المنتج أولًا', variant: 'destructive' });
      return;
    }

    const bundleId = await ensureBundleProductId();
    if (selectedProduct.id === bundleId) {
      toast({ title: 'لا يمكن إضافة الباكج داخل نفسه', variant: 'destructive' });
      return;
    }

    if (selectedProductVariants.length > 0 && !selectedVariantId) {
      toast({
        title: 'اختر متغير المنتج',
        description: 'هذا المنتج يحتوي متغيرات، اختر متغيرًا محددًا داخل الباكج.',
        variant: 'destructive',
      });
      return;
    }

    const duplicate = items.some(
      (item) =>
        item.item_product_id === selectedProduct.id &&
        (item.item_variant_id || null) === (selectedVariantId || null)
    );

    if (duplicate) {
      toast({ title: 'هذا المنتج موجود داخل الباكج بالفعل', variant: 'destructive' });
      return;
    }

    const selectedVariant = selectedProductVariants.find((variant) => variant.id === selectedVariantId) || null;
    const nextItems: AdminBundleItemRow[] = [
      ...items,
      {
        id: `temp-${Date.now()}`,
        bundle_product_id: bundleId,
        item_product_id: selectedProduct.id,
        item_variant_id: selectedVariant?.id || null,
        quantity: Math.max(1, Number(quantity) || 1),
        sort_order: (items.length + 1) * 10,
        is_required: true,
        item_product: selectedProduct,
        item_variant: selectedVariant,
      },
    ];

    await persist(nextItems, bundleId);
    setSelectedProductId('');
    setSelectedVariantId('');
    setQuantity(1);
    setSearch('');
  }

  async function updateItemQuantity(itemId: string, nextQuantity: number) {
    const nextItems = items.map((item) =>
      item.id === itemId ? { ...item, quantity: Math.max(1, Math.trunc(nextQuantity) || 1) } : item
    );
    await persist(nextItems);
  }

  async function removeItem(itemId: string) {
    const nextItems = items.filter((item) => item.id !== itemId);
    await persist(nextItems);
  }

  async function moveItem(itemId: string, direction: -1 | 1) {
    const index = items.findIndex((item) => item.id === itemId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return;

    const nextItems = [...items];
    const [item] = nextItems.splice(index, 1);
    if (!item) return;
    nextItems.splice(targetIndex, 0, item);
    await persist(nextItems);
  }

  if (!isBundle) return null;

  const savings = retailTotal > 0 ? retailTotal - Number(basePrice || 0) : null;

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        هذا المنتج عبارة عن باكج يحتوي على عدة منتجات. سيظهر للعميل كبند واحد بسعر الباكج، مع عرض محتويات الباكج بوضوح.
      </div>

      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 lg:grid-cols-[1fr_1fr_120px_auto]">
        <div className="space-y-1">
          <Label>ابحث عن منتج داخل الباكج</Label>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="اسم المنتج أو الرابط"
          />
        </div>

        <div className="space-y-1">
          <Label>المنتج</Label>
          <Select
            value={selectedProductId || 'none'}
            onValueChange={(value) => {
              setSelectedProductId(value === 'none' ? '' : value);
              setSelectedVariantId('');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر المنتج" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">اختر المنتج</SelectItem>
              {filteredProducts.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProductVariants.length > 0 && (
          <div className="space-y-1 lg:col-span-2">
            <Label>المتغير</Label>
            <Select
              value={selectedVariantId || 'none'}
              onValueChange={(value) => setSelectedVariantId(value === 'none' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر المتغير" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">اختر المتغير</SelectItem>
                {selectedProductVariants.map((variant) => (
                  <SelectItem key={variant.id} value={variant.id}>
                    {getVariantLabel(variant) || variant.name} - {formatPrice(Number(variant.price))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <Label>الكمية</Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
          />
        </div>

        <div className="flex items-end">
          <Button type="button" onClick={addItem} disabled={isSaving || isLoading} className="w-full gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
            إضافة
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">قيمة المنتجات منفردة</p>
          <p className="text-lg font-semibold">{formatPrice(retailTotal)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">سعر الباكج</p>
          <p className="text-lg font-semibold">{formatPrice(Number(basePrice || 0))}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">وفّرت</p>
          <p className={savings !== null && savings < 0 ? 'text-lg font-semibold text-amber-700' : 'text-lg font-semibold text-green-700'}>
            {savings === null ? '—' : formatPrice(savings)}
          </p>
        </div>
      </div>

      {savings !== null && savings < 0 && (
        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          سعر الباكج أعلى من قيمة المنتجات منفردة. هذا تحذير فقط ولن يمنع الحفظ.
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">جاري تحميل محتويات الباكج...</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            لم تضف أي منتج داخل الباكج بعد.
          </div>
        ) : (
          items.map((item, index) => {
            const label = getVariantLabel(item.item_variant);
            return (
              <div key={item.id} className="rounded-lg border bg-card p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
                    <SafeImage
                      src={getProductImage(item.item_product)}
                      fallbackSrc={PLACEHOLDER_PRODUCT}
                      alt={item.item_product?.name || 'منتج داخل الباكج'}
                      fill
                      className="object-contain p-1"
                      sizes="64px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{item.item_product?.name || 'منتج غير متوفر'}</div>
                    {label && <div className="mt-1 text-xs text-muted-foreground">{label}</div>}
                    <div className="mt-1 text-xs text-muted-foreground">
                      سعر الوحدة: {formatPrice(getItemUnitPrice(item))}
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 sm:flex">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={item.quantity}
                      onChange={(event) => updateItemQuantity(item.id, Number(event.target.value))}
                      className="w-24"
                      aria-label="الكمية داخل الباكج"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={index === 0 || isSaving}
                      onClick={() => moveItem(item.id, -1)}
                      aria-label="رفع العنصر"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={index === items.length - 1 || isSaving}
                      onClick={() => moveItem(item.id, 1)}
                      aria-label="خفض العنصر"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      disabled={isSaving}
                      onClick={() => removeItem(item.id)}
                      aria-label="حذف العنصر"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
