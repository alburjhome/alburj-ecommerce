'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  createAdminProduct,
  getAdminProductFormData,
  updateAdminProduct,
} from '@/app/actions/admin-products';
import type { ProductFormDataResult, ProductFormRecord } from '@/app/actions/admin-products';
import { supabase } from '@/lib/supabase';
import { normalizeSlug } from '@/lib/slug';
import { ProductFormInput, parseTags, productSchema, slugify, tagsToString } from '@/lib/product-validation';
import { INTENT_TAG_CONFIG } from '@/lib/product-intents';

interface ProductFormProps {
  mode: 'create' | 'edit';
  productId?: string;
}

const emptyProduct: ProductFormInput = {
  name: '',
  slug: '',
  slug_was_manual: false,
  description: null,
  short_description: null,
  price: 0,
  compare_price: null,
  sku: null,
  barcode: null,
  stock_quantity: 0,
  track_stock: true,
  allow_backorders: false,
  category_id: '',
  subcategory_id: null,
  brand: null,
  tags: [],
  intent_tags: [],
  marketing_tagline: null,
  key_features: [],
  product_badges: [],
  weight: null,
  dimensions: {
    length: null,
    width: null,
    height: null,
  },
  is_active: true,
  is_featured: false,
  meta_title: null,
  meta_description: null,
};

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

function asFormValue(product: ProductFormRecord | null): ProductFormInput {
  if (!product) return emptyProduct;

  const dimensions =
    product.dimensions && typeof product.dimensions === 'object' && !Array.isArray(product.dimensions)
      ? (product.dimensions as { length?: number | null; width?: number | null; height?: number | null })
      : null;

  return {
    name: product.name,
    slug: product.slug,
    slug_was_manual: true,
    description: product.description,
    short_description: product.short_description,
    price: Number(product.price),
    compare_price: product.compare_price === null ? null : Number(product.compare_price),
    sku: product.sku,
    barcode: product.barcode,
    stock_quantity: product.stock_quantity,
    track_stock: product.track_stock,
    allow_backorders: product.allow_backorders,
    category_id: product.category_id || '',
    subcategory_id: product.subcategory_id,
    brand: product.brand,
    tags: product.tags || [],
    intent_tags: (product.intent_tags || []) as ProductFormInput['intent_tags'],
    marketing_tagline: product.marketing_tagline,
    key_features: (product.key_features || []) as ProductFormInput['key_features'],
    product_badges: (product.product_badges || []) as ProductFormInput['product_badges'],
    weight: product.weight === null ? null : Number(product.weight),
    dimensions: {
      length: dimensions?.length ?? null,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    },
    is_active: product.is_active,
    is_featured: product.is_featured,
    meta_title: product.meta_title,
    meta_description: product.meta_description,
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function ProductForm({ mode, productId }: ProductFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProductFormDataResult>({
    categories: [],
    subcategories: [],
    product: null,
  });
  const [tagsText, setTagsText] = useState('');
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductFormInput>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyProduct,
  });

  const selectedCategoryId = watch('category_id');
  const name = watch('name');
  const currentSlug = watch('slug');
  const trackStock = watch('track_stock');
  const allowBackorders = watch('allow_backorders');
  const isActive = watch('is_active');
  const isFeatured = watch('is_featured');
  const selectedSubcategoryId = watch('subcategory_id');
  const intentTags = watch('intent_tags');
  const productBadges = watch('product_badges');
  const keyFeatures = watch('key_features');

  const filteredSubcategories = useMemo(() => {
    return formData.subcategories.filter((subcategory) => subcategory.category_id === selectedCategoryId);
  }, [formData.subcategories, selectedCategoryId]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setIsLoading(true);
      try {
        const token = await getAccessToken();
        const result = await getAdminProductFormData(token, productId);

        if (!mounted) return;

        if (!result.success || !result.data) {
          throw new Error(result.error || 'تعذر تحميل بيانات المنتج');
        }

        setFormData(result.data);
        const values = asFormValue(result.data.product);
        reset(values);
        setTagsText(tagsToString(values.tags));
      } catch (error) {
        toast({
          title: 'تعذر تحميل بيانات المنتج',
          description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
          variant: 'destructive',
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [productId, reset, toast]);

  useEffect(() => {
    if (mode === 'create' && !slugTouched) {
      const generated = slugify(name);
      setValue('slug', generated || `product-${Date.now()}`, { shouldValidate: true });
    }
  }, [mode, name, setValue, slugTouched]);

  async function onSubmit(values: ProductFormInput) {
    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      const payload: ProductFormInput = {
        ...values,
        slug_was_manual: slugTouched,
        description: values.description || null,
        short_description: values.short_description || null,
        compare_price: values.compare_price ?? null,
        sku: values.sku || null,
        barcode: values.barcode || null,
        subcategory_id: values.subcategory_id || null,
        brand: values.brand || null,
        tags: parseTags(tagsText),
        intent_tags: values.intent_tags,
        marketing_tagline: values.marketing_tagline || null,
        key_features: values.key_features,
        product_badges: values.product_badges,
        weight: values.weight ?? null,
        dimensions: values.dimensions || { length: null, width: null, height: null },
        meta_title: values.meta_title || null,
        meta_description: values.meta_description || null,
      };

      const result =
        mode === 'create'
          ? await createAdminProduct(token, payload)
          : await updateAdminProduct(token, productId!, payload);

      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ المنتج');
      }

      if (mode === 'create') {
        const created = (result as { success: boolean; data?: { id: string; slug: string } }).data;
        if (!created?.id) {
          throw new Error('تعذر إنشاء المنتج');
        }

        toast({
          title: 'تم إنشاء المنتج، يمكنك الآن رفع الصور.',
          description: values.name,
        });
        router.refresh();
        router.replace(`/admin/products/${created.id}/edit?focus=images`);
      } else {
        toast({
          title: 'تم حفظ التعديلات',
          description: values.name,
        });
        router.refresh();
        router.replace('/admin/products');
      }
    } catch (error) {
      toast({
        title: 'تعذر حفظ المنتج',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        جاري تحميل بيانات المنتج...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === 'create' ? 'إضافة منتج' : 'تعديل منتج'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            أدخل بيانات المنتج الأساسية، الأسعار، المخزون، وبيانات SEO.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild type="button" variant="outline">
            <Link href="/admin/products">
              <ArrowRight className="ml-2 h-4 w-4" />
              رجوع
            </Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="ml-2 h-4 w-4" />
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ المنتج'}
          </Button>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">البيانات الأساسية</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="name">اسم المنتج *</Label>
            <Input id="name" {...register('name')} />
            <FieldError message={errors.name?.message} />
          </div>

          <div>
            <Label htmlFor="slug">Slug *</Label>
            <div className="flex gap-2">
              <Input
                id="slug"
                dir="ltr"
                value={currentSlug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setValue('slug', normalizeSlug(event.target.value), { shouldDirty: true, shouldValidate: true });
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSlugTouched(true);
                  setValue('slug', slugify(name), { shouldDirty: true, shouldValidate: true });
                }}
              >
                إعادة توليد
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
              /product/{currentSlug || 'product-slug'}
            </p>
            <FieldError message={errors.slug?.message} />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="short_description">وصف قصير</Label>
            <Input id="short_description" {...register('short_description')} />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description">الوصف</Label>
            <textarea
              id="description"
              rows={5}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              {...register('description')}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">معلومات تسويقية</h2>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="marketing_tagline">عبارة تسويقية قصيرة</Label>
            <Input
              id="marketing_tagline"
              {...register('marketing_tagline')}
              placeholder="مثال: رغوة عالية لتنظيف أعمق للسجاد والموكيت"
            />
            <FieldError message={(errors as any).marketing_tagline?.message} />
          </div>

          <div>
            <Label htmlFor="key_features">مميزات المنتج</Label>
            <textarea
              id="key_features"
              rows={6}
              value={(keyFeatures || []).join('\n')}
              onChange={(event) => {
                const lines = event.target.value
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .slice(0, 6);
                setValue('key_features', lines as ProductFormInput['key_features'], { shouldDirty: true });
              }}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="كل سطر يمثل ميزة (حتى 6)"
            />
            <FieldError message={(errors as any).key_features?.message} />
          </div>

          <div>
            <Label>وسوم تسويقية</Label>
            <div className="mt-2 flex flex-wrap gap-3">
              {[
                { key: 'bestselling', label: 'الأكثر طلبًا' },
                { key: 'offer', label: 'عرض' },
                { key: 'new', label: 'جديد' },
                { key: 'wholesale', label: 'سعر جملة' },
                { key: 'limited', label: 'كمية محدودة' },
              ].map((badge) => (
                <label
                  key={badge.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2.5 text-sm transition-colors hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={productBadges?.includes(badge.key as any)}
                    onChange={(event) => {
                      const current = productBadges || [];
                      const next = event.target.checked
                        ? [...current, badge.key]
                        : current.filter((b) => b !== badge.key);
                      setValue('product_badges', next as ProductFormInput['product_badges'], { shouldDirty: true });
                    }}
                  />
                  {badge.label}
                </label>
              ))}
            </div>
            <FieldError message={(errors as any).product_badges?.message} />
          </div>
        </div>
      </section>

      {mode === 'create' && (
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">صور المنتج</h2>
          <p className="text-sm text-muted-foreground">احفظ المنتج أولًا حتى تتمكن من رفع الصور.</p>
        </section>
      )}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">التسعير والمخزون</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="price">السعر *</Label>
            <Input id="price" type="number" step="0.01" min="0" {...register('price')} />
            <FieldError message={errors.price?.message} />
          </div>
          <div>
            <Label htmlFor="compare_price">السعر قبل الخصم</Label>
            <Input id="compare_price" type="number" step="0.01" min="0" {...register('compare_price')} />
          </div>
          <div>
            <Label htmlFor="stock_quantity">المخزون</Label>
            <Input id="stock_quantity" type="number" min="0" {...register('stock_quantity')} />
            <FieldError message={errors.stock_quantity?.message} />
          </div>
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={trackStock}
              onChange={(event) => setValue('track_stock', event.target.checked)}
            />
            تتبع المخزون
          </label>
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={allowBackorders}
              onChange={(event) => setValue('allow_backorders', event.target.checked)}
            />
            السماح بالطلبات عند نفاد المخزون
          </label>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">التصنيف والتفاصيل</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>القسم *</Label>
            <Select
              value={selectedCategoryId || undefined}
              onValueChange={(value) => {
                setValue('category_id', value, { shouldValidate: true });
                setValue('subcategory_id', null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر القسم" />
              </SelectTrigger>
              <SelectContent>
                {formData.categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.category_id?.message} />
          </div>

          <div>
            <Label>الفئة</Label>
            <Select
              value={selectedSubcategoryId || 'none'}
              onValueChange={(value) => setValue('subcategory_id', value === 'none' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون فئة</SelectItem>
                {filteredSubcategories.map((subcategory) => (
                  <SelectItem key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" dir="ltr" {...register('sku')} />
          </div>
          <div>
            <Label htmlFor="barcode">Barcode</Label>
            <Input id="barcode" dir="ltr" {...register('barcode')} />
          </div>
          <div>
            <Label htmlFor="brand">العلامة التجارية</Label>
            <Input id="brand" {...register('brand')} />
          </div>
          <div>
            <Label htmlFor="tags">الوسوم</Label>
            <Input
              id="tags"
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="وسم 1, وسم 2"
            />
          </div>
          <div>
            <Label htmlFor="weight">الوزن</Label>
            <Input id="weight" type="number" step="0.01" min="0" {...register('weight')} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">مناسب لـ</h2>
        <div className="flex flex-wrap gap-3">
          {INTENT_TAG_CONFIG.map((tag) => (
            <label
              key={tag.key}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2.5 text-sm transition-colors hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={intentTags?.includes(tag.key)}
                onChange={(event) => {
                  const current = intentTags || [];
                  const next = event.target.checked
                    ? [...current, tag.key]
                    : current.filter((t) => t !== tag.key);
                  setValue('intent_tags', next as ProductFormInput['intent_tags'], { shouldDirty: true });
                }}
              />
              {tag.label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          حدد الاستخدامات التي يناسبها هذا المنتج لتظهر في فلاتر "تسوق حسب احتياجك".
        </p>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">الأبعاد والحالة</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="length">الطول</Label>
            <Input id="length" type="number" step="0.01" min="0" {...register('dimensions.length')} />
          </div>
          <div>
            <Label htmlFor="width">العرض</Label>
            <Input id="width" type="number" step="0.01" min="0" {...register('dimensions.width')} />
          </div>
          <div>
            <Label htmlFor="height">الارتفاع</Label>
            <Input id="height" type="number" step="0.01" min="0" {...register('dimensions.height')} />
          </div>
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setValue('is_active', event.target.checked)}
            />
            المنتج نشط
          </label>
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(event) => setValue('is_featured', event.target.checked)}
            />
            منتج مميز
          </label>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">SEO</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="meta_title">Meta title</Label>
            <Input id="meta_title" {...register('meta_title')} />
          </div>
          <div>
            <Label htmlFor="meta_description">Meta description</Label>
            <Input id="meta_description" {...register('meta_description')} />
          </div>
        </div>
      </section>
    </form>
  );
}
