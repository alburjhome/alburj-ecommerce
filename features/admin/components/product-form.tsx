'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Sparkles, AlertCircle, Package, Tag, CheckCircle2, EyeOff, ImageIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  createAdminProduct,
  createAdminProductDraft,
  getAdminProductFormData,
  updateAdminProduct,
} from '@/app/actions/admin-products';
import type { ProductFormDataResult, ProductFormRecord } from '@/app/actions/admin-products';
import { supabase } from '@/lib/supabase';
import { normalizeSlug } from '@/lib/slug';
import { ProductFormInput, parseTags, productSchema, slugify, tagsToString } from '@/lib/product-validation';
import { INTENT_TAG_CONFIG } from '@/lib/product-intents';
import { formatPrice } from '@/lib/utils';
import { ProductVariantsManager } from './product-variants-manager';

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

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border bg-card p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

const badgeOptions = [
  { key: 'bestselling', label: 'الأكثر طلبًا', description: 'يظهر في قائمة الأكثر مبيعًا' },
  { key: 'offer', label: 'عرض', description: 'يظهر شارة العروض الخاصة' },
  { key: 'new', label: 'جديد', description: 'يظهر شارة جديد للمنتجات الجديدة' },
  { key: 'wholesale', label: 'سعر جملة', description: 'يظهر للمنتجات بأسعار الجملة' },
  { key: 'limited', label: 'كمية محدودة', description: 'يظهر للمنتجات ذات الكمية المحدودة' },
] as const;

export function ProductForm({ mode, productId }: ProductFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<ProductFormDataResult | null>(null);
  const [product, setProduct] = useState<ProductFormRecord | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagsText, setTagsText] = useState('');
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [hasAiSuggestedTaxonomy, setHasAiSuggestedTaxonomy] = useState(false);
  const [aiTaxonomyWarning, setAiTaxonomyWarning] = useState<string | null>(null);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [isOpeningAdvanced, setIsOpeningAdvanced] = useState(false);
  const [createVariantsIntent, setCreateVariantsIntent] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    getValues,
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
  const price = watch('price');
  const comparePrice = watch('compare_price');
  const stockQuantity = watch('stock_quantity');
  const metaTitle = watch('meta_title');
  const metaDescription = watch('meta_description');
  const shortDescription = watch('short_description');
  const fullDescription = watch('description');
  const focusTarget = searchParams.get('focus');

  const normalizeForSimilarity = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[\u064B-\u065F]/g, '')
      .replace(/[\.\,\!\?\:\;\-\_\(\)\[\]\{\}\"\'\<\>\|\+\=\*\/\\%\$\#\@\^\&\~\`\u060C\u061B\u061F\u2026]/g, '')
      .trim();

  const descriptionSimilarityWarning = useMemo(() => {
    if (!shortDescription || !fullDescription) return null;
    const a = normalizeForSimilarity(shortDescription);
    const b = normalizeForSimilarity(fullDescription);
    if (!a || !b) return null;
    if (a === b) return 'الوصف الكامل مشابه للوصف القصير. يفضل تعديله لتجنب التكرار.';
    const aTokens = new Set(a.split(' ').filter(Boolean));
    const bTokens = new Set(b.split(' ').filter(Boolean));
    if (aTokens.size < 6 || bTokens.size < 6) return null;
    let intersection = 0;
    aTokens.forEach((t) => {
      if (bTokens.has(t)) intersection += 1;
    });
    const similarity = intersection / Math.max(1, Math.min(aTokens.size, bTokens.size));
    if (similarity >= 0.8) return 'الوصف الكامل مشابه للوصف القصير. يفضل تعديله لتجنب التكرار.';
    return null;
  }, [fullDescription, shortDescription]);

  // Price validation warning
  const hasInvalidComparePrice = useMemo(() => {
    if (!comparePrice || comparePrice <= 0) return false;
    return comparePrice <= price;
  }, [comparePrice, price]);

  async function handleGenerateAi({ replace }: { replace: boolean }) {
    if (!formData) return;

    const currentValues = getValues();

    setIsGeneratingAi(true);
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/ai/product-copy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: currentValues.name,
          price: currentValues.price,
          comparePrice: currentValues.compare_price,
          existingDescription: currentValues.description,
          existingShortDescription: currentValues.short_description,
          existingMarketingTagline: currentValues.marketing_tagline,
          existingKeyFeatures: currentValues.key_features,
          existingProductBadges: currentValues.product_badges,
          existingIntentTags: currentValues.intent_tags,
          sku: currentValues.sku,
          metaTitle: currentValues.meta_title,
          metaDescription: currentValues.meta_description,
          currentCategoryId: currentValues.category_id,
          currentSubcategoryId: currentValues.subcategory_id,
          categories: formData.categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
          subcategories: formData.subcategories.map((s) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
            category_id: s.category_id,
          })),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage = data?.error || 'فشل توليد المحتوى';
        if (errorMessage === 'AI service is not configured') {
          toast({
            title: 'خدمة الذكاء الاصطناعي غير مفعلة',
            description: 'أضف GEMINI_API_KEY.',
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'فشل توليد المحتوى',
          description: String(errorMessage),
          variant: 'destructive',
        });
        return;
      }

      const shouldSet = (field: keyof ProductFormInput) => {
        if (replace) return true;
        const value = (currentValues as any)[field];
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'string') return value.trim().length === 0;
        return value === null || value === undefined;
      };

      const shouldSetCategory = () => {
        if (replace) return true;
        return !currentValues.category_id;
      };

      const shouldSetSubcategory = () => {
        if (replace) return true;
        return !currentValues.subcategory_id;
      };

      if (shouldSet('marketing_tagline') && data?.marketing_tagline) {
        setValue('marketing_tagline', data.marketing_tagline, { shouldDirty: true });
      }

      if (shouldSet('key_features') && Array.isArray(data?.key_features)) {
        setValue('key_features', data.key_features, { shouldDirty: true });
      }

      if (shouldSet('product_badges') && Array.isArray(data?.product_badges)) {
        setValue('product_badges', data.product_badges, { shouldDirty: true });
      }

      if (shouldSet('intent_tags') && Array.isArray(data?.intent_tags)) {
        setValue('intent_tags', data.intent_tags, { shouldDirty: true });
      }

      if (shouldSet('description') && data?.description) {
        setValue('description', data.description, { shouldDirty: true });
      }

      if (shouldSet('short_description') && data?.short_description) {
        setValue('short_description', data.short_description, { shouldDirty: true });
      }

      if (shouldSet('meta_title') && data?.meta_title) {
        setValue('meta_title', data.meta_title, { shouldDirty: true });
      }

      if (shouldSet('meta_description') && data?.meta_description) {
        setValue('meta_description', data.meta_description, { shouldDirty: true });
      }

      if (shouldSet('sku') && data?.suggested_sku) {
        setValue('sku', data.suggested_sku, { shouldDirty: true });
      }

      const aiSuggestedCategoryId = typeof data?.category_id === 'string' ? data.category_id : null;
      const aiSuggestedSubcategoryId = typeof data?.subcategory_id === 'string' ? data.subcategory_id : null;

      const categoryConfidence = (data?.category_confidence ?? 'low') as 'high' | 'medium' | 'low';
      const subcategoryConfidence = (data?.subcategory_confidence ?? 'low') as 'high' | 'medium' | 'low';

      if (aiSuggestedCategoryId || aiSuggestedSubcategoryId) {
        setHasAiSuggestedTaxonomy(true);
      }

      if ((categoryConfidence === 'high' || categoryConfidence === 'medium') && aiSuggestedCategoryId && !aiSuggestedSubcategoryId) {
        setAiTaxonomyWarning('تم اختيار القسم، لكن الفئة تحتاج مراجعة.');
      } else {
        setAiTaxonomyWarning(null);
      }

      if (shouldSetCategory() && (categoryConfidence === 'high' || categoryConfidence === 'medium') && aiSuggestedCategoryId) {
        setValue('category_id', aiSuggestedCategoryId, { shouldDirty: true, shouldValidate: true });
      }

      if (shouldSetSubcategory() && categoryConfidence === 'high' && subcategoryConfidence === 'high' && aiSuggestedSubcategoryId) {
        setValue('subcategory_id', aiSuggestedSubcategoryId, { shouldDirty: true });
      }

      toast({
        title: 'تم توليد المحتوى واقتراح التصنيف وSEO، راجعه قبل الحفظ.',
      });
    } catch {
      toast({
        title: 'فشل توليد المحتوى',
        description: 'تعذر الاتصال بخدمة الذكاء الاصطناعي.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAi(false);
    }
  }

  const filteredSubcategories = useMemo(() => {
    return (formData?.subcategories || []).filter(
      (subcategory) => subcategory.category_id === selectedCategoryId
    );
  }, [formData, selectedCategoryId]);

  useEffect(() => {
    if (!selectedCategoryId) return;
    if (selectedSubcategoryId) return;
    if (filteredSubcategories.length === 1) {
      setValue('subcategory_id', filteredSubcategories[0]!.id, { shouldDirty: true });
    }
  }, [filteredSubcategories, selectedCategoryId, selectedSubcategoryId, setValue]);

  // SEO helpers
  const getCharCountStatus = (count: number, min: number, max: number) => {
    if (count === 0) return { label: '', color: '' };
    if (count < min) return { label: 'قصير جدًا', color: 'text-amber-600' };
    if (count > max) return { label: 'طويل', color: 'text-red-600' };
    return { label: 'ممتاز', color: 'text-green-600' };
  };

  const metaTitleCount = (metaTitle || '').length;
  const metaDescriptionCount = (metaDescription || '').length;
  const metaTitleStatus = getCharCountStatus(metaTitleCount, 30, 60);
  const metaDescriptionStatus = getCharCountStatus(metaDescriptionCount, 80, 155);

  const displayTitle = metaTitle || name || 'عنوان المنتج';
  const displayDescription = metaDescription || shortDescription || 'وصف المنتج';
  const displaySlug = currentSlug || 'product-slug';

  function handleCopyTitleFromName() {
    if (!name) {
      toast({
        title: 'أدخل اسم المنتج أولًا',
        variant: 'destructive',
      });
      return;
    }
    if (metaTitle && metaTitle.trim()) {
      const confirmed = window.confirm('حقل عنوان SEO يحتوي على نص. هل تريد استبداله باسم المنتج؟');
      if (!confirmed) return;
    }
    setValue('meta_title', name, { shouldDirty: true });
    toast({
      title: 'تم نسخ عنوان SEO',
      description: 'تم نسخ اسم المنتج إلى حقل عنوان SEO.',
    });
  }

  function handleCopyDescFromShort() {
    if (!shortDescription) {
      toast({
        title: 'أدخل وصف مختصر أولًا',
        description: 'يجب إدخال الوصف المختصر في قسم المعلومات الأساسية.',
        variant: 'destructive',
      });
      return;
    }
    if (metaDescription && metaDescription.trim()) {
      const confirmed = window.confirm('حقل وصف SEO يحتوي على نص. هل تريد استبداله بالوصف المختصر؟');
      if (!confirmed) return;
    }
    setValue('meta_description', shortDescription, { shouldDirty: true });
    toast({
      title: 'تم نسخ وصف SEO',
      description: 'تم نسخ الوصف المختصر إلى حقل وصف SEO.',
    });
  }

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

  useEffect(() => {
    if (isLoading || mode !== 'edit') return;
    const targetId =
      focusTarget === 'variants'
        ? 'product-variants-section'
        : focusTarget === 'images'
          ? 'product-images'
          : null;

    if (!targetId) return;
    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [focusTarget, isLoading, mode]);

  function scrollToField(fieldId: string | undefined) {
    if (!fieldId) return;
    requestAnimationFrame(() => {
      const element = document.getElementById(fieldId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.focus();
      }
    });
  }

  function showValidationSummary(items: Array<{ field?: string; message: string }>) {
    const messages = items.map((item) => item.message);
    setValidationMessages(messages);
    toast({
      title: 'لم يتم حفظ المنتج، يرجى إكمال الحقول المطلوبة.',
      description: messages[0],
      variant: 'destructive',
    });
    scrollToField(items[0]?.field);
  }

  function buildProductPayload(values: ProductFormInput, isActiveOverride?: boolean): ProductFormInput {
    return {
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
      is_active: isActiveOverride ?? values.is_active,
      meta_title: values.meta_title || null,
      meta_description: values.meta_description || null,
    };
  }

  function validatePublishValues(values: ProductFormInput) {
    clearErrors();
    const items: Array<{ field?: string; message: string }> = [];
    const priceValue = Number(values.price);
    const stockValue = Number(values.stock_quantity);

    if (!values.name?.trim()) {
      setError('name', { type: 'manual', message: 'اسم المنتج مطلوب' });
      items.push({ field: 'name', message: 'اسم المنتج مطلوب' });
    }

    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      setError('price', { type: 'manual', message: 'السعر مطلوب ويجب أن يكون أكبر من 0' });
      items.push({ field: 'price', message: 'السعر مطلوب ويجب أن يكون أكبر من 0' });
    }

    if (!values.category_id) {
      setError('category_id', { type: 'manual', message: 'يرجى اختيار القسم الرئيسي' });
      items.push({ field: 'category_id', message: 'يرجى اختيار القسم الرئيسي' });
    }

    if (!values.subcategory_id) {
      setError('subcategory_id', {
        type: 'manual',
        message: 'يرجى اختيار الفئة الفرعية حتى يظهر المنتج في المكان الصحيح',
      });
      items.push({
        field: 'subcategory_id',
        message: 'يرجى اختيار الفئة الفرعية حتى يظهر المنتج في المكان الصحيح',
      });
    }

    if (values.track_stock && (!Number.isFinite(stockValue) || stockValue < 0)) {
      setError('stock_quantity', { type: 'manual', message: 'المخزون مطلوب ولا يمكن أن يكون أقل من صفر' });
      items.push({ field: 'stock_quantity', message: 'المخزون مطلوب ولا يمكن أن يكون أقل من صفر' });
    }

    if (values.track_stock && stockValue === 0 && !values.allow_backorders) {
      setError('stock_quantity', { type: 'manual', message: 'المخزون 0؛ سيظهر المنتج غير متوفر للعملاء.' });
      items.push({ field: 'stock_quantity', message: 'المخزون 0؛ سيظهر المنتج غير متوفر للعملاء.' });
    }

    if (createVariantsIntent) {
      items.push({
        field: 'variants-intent',
        message: 'فعّلت المتغيرات لكن لم تنشئ أي خيار قابل للبيع.',
      });
    }

    return items;
  }

  function handlePublishInvalid(formErrors: typeof errors) {
    const manualItems = validatePublishValues(getValues());
    if (manualItems.length > 0) {
      showValidationSummary(manualItems);
      return;
    }

    const items: Array<{ field?: string; message: string }> = [];
    if (formErrors.name) items.push({ field: 'name', message: 'اسم المنتج مطلوب' });
    if (formErrors.price) items.push({ field: 'price', message: 'السعر مطلوب ويجب أن يكون أكبر من 0' });
    if (formErrors.category_id) items.push({ field: 'category_id', message: 'يرجى اختيار القسم الرئيسي' });
    if (formErrors.subcategory_id) {
      items.push({
        field: 'subcategory_id',
        message: 'يرجى اختيار الفئة الفرعية حتى يظهر المنتج في المكان الصحيح',
      });
    }
    if (formErrors.stock_quantity) {
      items.push({ field: 'stock_quantity', message: 'المخزون مطلوب ولا يمكن أن يكون أقل من صفر' });
    }

    showValidationSummary(items.length ? items : [{ message: 'يرجى مراجعة البيانات التالية قبل الحفظ' }]);
  }

  async function publishNewProduct(values: ProductFormInput) {
    const validationItems = validatePublishValues(values);
    if (validationItems.length > 0) {
      showValidationSummary(validationItems);
      return;
    }

    setValidationMessages([]);
    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      const result = await createAdminProduct(token, buildProductPayload(values, true));

      if (!result.success) {
        throw new Error(result.error || 'فشل حفظ المنتج');
      }

      const created = (result as { success: boolean; data?: { id: string; slug: string } }).data;
      if (!created?.id) {
        throw new Error('تعذر إنشاء المنتج');
      }

      toast({
        title: 'تم نشر المنتج بنجاح.',
        description: 'يفضل إضافة صورة رئيسية قبل الاعتماد النهائي للمنتج.',
      });
      router.refresh();
      router.replace(`/admin/products/${created.id}/edit?focus=images`);
    } catch (error) {
      toast({
        title: 'فشل حفظ المنتج',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveDraftFromCreate({ openAdvanced }: { openAdvanced: boolean }) {
    const values = getValues();
    const savingState = openAdvanced ? setIsOpeningAdvanced : setIsDraftSaving;
    savingState(true);
    setValidationMessages([]);

    try {
      const token = await getAccessToken();
      const result = await createAdminProductDraft(token, buildProductPayload(values, false));

      if (!result.success || !result.data?.id) {
        throw new Error(result.error || 'فشل حفظ المنتج كمسودة');
      }

      toast({
        title: openAdvanced ? 'تم حفظ المنتج كمسودة.' : 'تم حفظ المنتج كمسودة.',
        description: 'تم حفظ المنتج كمسودة، لكنه غير جاهز للنشر.',
      });
      router.refresh();
      const advancedFocus = createVariantsIntent ? 'variants' : 'images';
      router.replace(openAdvanced ? `/admin/products/${result.data.id}/edit?focus=${advancedFocus}` : '/admin/products');
    } catch (error) {
      toast({
        title: 'فشل حفظ المنتج',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      savingState(false);
    }
  }

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

  if (mode === 'create') {
    const publishDisabled = isSubmitting || isDraftSaving || isOpeningAdvanced;

    return (
      <div className="mx-auto max-w-5xl pb-28 lg:pb-0">
        {validationMessages.length > 0 && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="font-semibold">يرجى مراجعة البيانات التالية قبل الحفظ</h2>
                <ul className="mt-2 list-disc space-y-1 pr-5 text-sm">
                  {validationMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <form className="min-w-0 space-y-5" onSubmit={(event) => event.preventDefault()}>
            <Card>
              <SectionHeader
                title="توليد المحتوى بالذكاء الاصطناعي"
                description="اكتب اسم المنتج أو استخدم البيانات الحالية لتوليد وصف ومميزات وSEO."
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isGeneratingAi || !name}
                  onClick={() => handleGenerateAi({ replace: false })}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGeneratingAi ? 'جاري التوليد...' : 'ولّد بالذكاء الاصطناعي'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGeneratingAi || !name}
                  onClick={() => {
                    const ok = window.confirm('هل تريد استبدال الحقول التسويقية وSEO والتصنيف بالمقترح؟');
                    if (!ok) return;
                    handleGenerateAi({ replace: true });
                  }}
                >
                  استبدال بالمقترح
                </Button>
              </div>
              {aiTaxonomyWarning && (
                <p className="mt-2 text-xs text-amber-700 break-words whitespace-normal">{aiTaxonomyWarning}</p>
              )}
            </Card>

            <Card>
              <SectionHeader title="1. الأساسيات" description="الحقول التي لا يكتمل نشر المنتج بدونها." />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="name">اسم المنتج *</Label>
                  <Input id="name" {...register('name')} placeholder="مثال: شامبو فاتيكا بالثوم" />
                  <FieldError message={errors.name?.message} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="slug">الرابط المختصر *</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="slug"
                      dir="ltr"
                      value={currentSlug}
                      onChange={(event) => {
                        setSlugTouched(true);
                        setValue('slug', normalizeSlug(event.target.value), { shouldDirty: true, shouldValidate: true });
                      }}
                      placeholder="vatika-garlic-shampoo"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSlugTouched(true);
                        setValue('slug', slugify(name), { shouldDirty: true, shouldValidate: true });
                      }}
                      className="w-full sm:w-auto"
                    >
                      إعادة توليد الرابط
                    </Button>
                  </div>
                  <p className="mt-1 break-words text-xs text-muted-foreground" dir="ltr">
                    /product/{currentSlug || 'product-slug'}
                  </p>
                  <FieldError message={errors.slug?.message} />
                </div>
                <div>
                  <Label htmlFor="price">السعر الحالي *</Label>
                  <Input id="price" type="number" step="0.01" min="0" {...register('price')} />
                  <FieldError message={errors.price?.message} />
                </div>
                <div id="stock_quantity">
                  <Label htmlFor="stock_quantity_input">الكمية المتاحة *</Label>
                  <Input id="stock_quantity_input" type="number" min="0" step="1" {...register('stock_quantity')} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    إذا بقيت 0 سيظهر المنتج غير متوفر، ويمكنك حفظه كمسودة ثم تعديلها لاحقًا.
                  </p>
                  <FieldError message={errors.stock_quantity?.message} />
                </div>
                <div>
                  <Label htmlFor="compare_price">السعر قبل الخصم</Label>
                  <Input id="compare_price" type="number" step="0.01" min="0" {...register('compare_price')} />
                  {hasInvalidComparePrice && (
                    <p className="mt-1 text-xs text-amber-600">السعر قبل الخصم يجب أن يكون أعلى من السعر الحالي.</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" dir="ltr" {...register('sku')} placeholder="BUR-12345" />
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader title="2. التصنيف" description="اختيار القسم والفئة يساعد ظهور المنتج في المكان الصحيح." />
              <div className="grid gap-4 md:grid-cols-2">
                <div id="category_id">
                  <Label>القسم الرئيسي *</Label>
                  <Select
                    value={selectedCategoryId || 'none'}
                    onValueChange={(value) => {
                      setValue('category_id', value === 'none' ? '' : value, { shouldValidate: true });
                      setValue('subcategory_id', null, { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">اختر القسم</SelectItem>
                      {(formData?.categories || []).map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.category_id?.message} />
                </div>
                <div id="subcategory_id">
                  <Label>الفئة الفرعية *</Label>
                  <Select
                    value={selectedSubcategoryId || 'none'}
                    onValueChange={(value) => setValue('subcategory_id', value === 'none' ? null : value, { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">اختر الفئة</SelectItem>
                      {filteredSubcategories.map((subcategory) => (
                        <SelectItem key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.subcategory_id?.message} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    يرجى اختيار الفئة الفرعية حتى يظهر المنتج في المكان الصحيح.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Label className="mb-2 block">Intent Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {INTENT_TAG_CONFIG.map((tag) => (
                    <label key={tag.key} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={intentTags?.includes(tag.key)}
                        onChange={(event) => {
                          const current = intentTags || [];
                          const next = event.target.checked ? [...current, tag.key] : current.filter((item) => item !== tag.key);
                          setValue('intent_tags', next as ProductFormInput['intent_tags'], { shouldDirty: true });
                        }}
                      />
                      {tag.label}
                    </label>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader title="3. الصور" description="الصور ترفع بعد إنشاء مسودة المنتج حتى ترتبط بسجل المنتج بأمان." />
              <div className="rounded-md border border-dashed p-6 text-center">
                <ImageIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">احفظ كمسودة أو انشر المنتج، ثم ارفع الصورة الرئيسية والصور الإضافية من صفحة التعديل.</p>
                <p className="mt-1 text-xs text-muted-foreground">الصورة لا تمنع النشر، لكن يفضل إضافة صورة رئيسية قبل اعتماد المنتج للعملاء.</p>
              </div>
            </Card>

            <Card className="scroll-mt-24" >
              <SectionHeader title="4. متغيرات المنتج" description="فعّلها للنكهة أو الحجم أو اللون. الإدارة الكاملة تتم بعد إنشاء المسودة." />
              <label id="variants-intent" className="flex scroll-mt-24 items-center gap-2 rounded-md border p-3 text-sm">
                <input type="checkbox" checked={createVariantsIntent} onChange={(event) => setCreateVariantsIntent(event.target.checked)} />
                <span>هذا المنتج له متغيرات مثل نكهة / حجم / لون / مقاس</span>
              </label>
              {createVariantsIntent && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  فعّلت المتغيرات لكن لم تنشئ أي خيار قابل للبيع بعد. احفظ كمسودة وافتح التعديل المتقدم لإضافة variants قبل النشر النهائي.
                </div>
              )}
            </Card>

            <Card>
              <SectionHeader title="5. الوصف والتسويق" description="نصوص تساعد العميل على فهم المنتج بسرعة." />
              <div className="space-y-4">
                <div>
                  <Label htmlFor="short_description">وصف قصير</Label>
                  <Input id="short_description" {...register('short_description')} />
                </div>
                <div>
                  <Label htmlFor="description">وصف كامل</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    استخدم الوصف الكامل فقط لإضافة تفاصيل لا تظهر في الوصف القصير أو المميزات.
                  </p>
                  <textarea
                    id="description"
                    rows={5}
                    className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    {...register('description')}
                  />
                  {descriptionSimilarityWarning && (
                    <p className="mt-2 text-xs text-amber-700 break-words whitespace-normal">
                      {descriptionSimilarityWarning}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="key_features">المميزات</Label>
                  <textarea
                    id="key_features"
                    rows={5}
                    value={(keyFeatures || []).join('\n')}
                    onChange={(event) => {
                      const lines = event.target.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 6);
                      setValue('key_features', lines as ProductFormInput['key_features'], { shouldDirty: true });
                    }}
                    className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="كل ميزة في سطر"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Badges</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {badgeOptions.map((badge) => (
                      <label key={badge.key} className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                        <input
                          type="checkbox"
                          checked={productBadges?.includes(badge.key as any)}
                          onChange={(event) => {
                            const current = productBadges || [];
                            const next = event.target.checked ? [...current, badge.key] : current.filter((item) => item !== badge.key);
                            setValue('product_badges', next as ProductFormInput['product_badges'], { shouldDirty: true });
                          }}
                        />
                        <div>
                          <span className="text-sm font-medium">{badge.label}</span>
                          <p className="text-xs text-muted-foreground">{badge.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <details className="rounded-lg border bg-card p-5 shadow-sm">
              <summary className="cursor-pointer text-lg font-semibold">6. SEO المتقدم</summary>
              <div className="mt-4 space-y-4">
                <Input id="meta_title" {...register('meta_title')} placeholder="Meta Title" />
                <Input id="meta_description" {...register('meta_description')} placeholder="Meta Description" />
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Google Preview</h3>
                  <div className="rounded-lg bg-white p-4 shadow-sm">
                    <div className="break-words text-base font-medium text-blue-600">{displayTitle}</div>
                    <div className="mt-0.5 break-words text-sm text-green-700" dir="ltr">
                      alburj-ecommerce.vercel.app/product/{displaySlug}
                    </div>
                    <div className="mt-1 break-words text-sm text-gray-600">{displayDescription}</div>
                  </div>
                </div>
              </div>
            </details>

            <details className="rounded-lg border bg-card p-5 shadow-sm">
              <summary className="cursor-pointer text-lg font-semibold">تفاصيل إضافية اختيارية</summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input id="barcode" dir="ltr" {...register('barcode')} placeholder="Barcode" />
                <Input id="brand" {...register('brand')} placeholder="العلامة التجارية" />
                <Input id="tags" value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="الوسوم" />
                <Input id="weight" type="number" step="0.01" min="0" {...register('weight')} placeholder="الوزن" />
                <div className="md:col-span-2 grid gap-3 sm:grid-cols-3">
                  <Input type="number" step="0.01" min="0" {...register('dimensions.length')} placeholder="الطول" />
                  <Input type="number" step="0.01" min="0" {...register('dimensions.width')} placeholder="العرض" />
                  <Input type="number" step="0.01" min="0" {...register('dimensions.height')} placeholder="الارتفاع" />
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                    <input type="checkbox" checked={trackStock} onChange={(event) => setValue('track_stock', event.target.checked)} />
                    تتبع المخزون
                  </label>
                  <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                    <input type="checkbox" checked={allowBackorders} disabled={!trackStock} onChange={(event) => setValue('allow_backorders', event.target.checked)} />
                    السماح بالطلب عند نفاد المخزون
                  </label>
                  <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                    <input type="checkbox" checked={isFeatured} onChange={(event) => setValue('is_featured', event.target.checked)} />
                    منتج مميز
                  </label>
                </div>
              </div>
            </details>
          </form>

          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-3 rounded-lg border bg-card p-4 shadow-sm">
              <h2 className="font-semibold">إجراءات المنتج</h2>
              <p className="text-sm text-muted-foreground">المسودة لا تظهر للعملاء. النشر فقط يجعل المنتج ظاهرًا.</p>
              <Button type="button" variant="outline" className="w-full" disabled={publishDisabled} onClick={() => saveDraftFromCreate({ openAdvanced: false })}>
                {isDraftSaving ? 'جاري الحفظ...' : 'حفظ كمسودة'}
              </Button>
              <Button type="button" className="w-full" disabled={publishDisabled} onClick={() => handleSubmit(publishNewProduct, handlePublishInvalid)()}>
                {isSubmitting ? 'جاري النشر...' : 'نشر المنتج'}
              </Button>
              <Button type="button" variant="secondary" className="w-full" disabled={publishDisabled} onClick={() => saveDraftFromCreate({ openAdvanced: true })}>
                {isOpeningAdvanced ? 'جاري الحفظ...' : createVariantsIntent ? 'حفظ وفتح إدارة المتغيرات' : 'حفظ وفتح التعديل المتقدم'}
              </Button>
            </div>
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-lg backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={publishDisabled} onClick={() => saveDraftFromCreate({ openAdvanced: false })}>
              {isDraftSaving ? 'حفظ...' : 'حفظ كمسودة'}
            </Button>
            <Button type="button" disabled={publishDisabled} onClick={() => handleSubmit(publishNewProduct, handlePublishInvalid)()}>
              {isSubmitting ? 'نشر...' : 'نشر'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px] max-w-full overflow-x-hidden">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-full min-w-0">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between min-w-0 max-w-full">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight min-w-0 break-words whitespace-normal">
              تعديل المنتج
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              أدخل بيانات المنتج الأساسية، الأسعار، المخزون، والتسويق.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-row sm:justify-end min-w-0 max-w-full">
            <Button asChild type="button" variant="outline">
              <Link href="/admin/products">
                <ArrowLeft className="ml-2 h-4 w-4" />
                العودة للمنتجات
              </Link>
            </Button>
            <Button type="submit" disabled={isSubmitting} size="lg">
              <Save className="ml-2 h-4 w-4" />
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ المنتج'}
            </Button>
          </div>
        </div>

        {/* Inactive Warning */}
        {!isActive && mode === 'edit' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">هذا المنتج غير ظاهر للعملاء</p>
                <p className="text-sm text-amber-700">
                  المنتج معطل حاليًا. تفعيله سيجعله يظهر في المتجر للعملاء.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI Generator */}
        <Card>
          <SectionHeader
            title="توليد المحتوى بالذكاء الاصطناعي"
            description="سيتم اقتراح وصف ومميزات وSEO دون الحفظ التلقائي. راجع المقترحات قبل الحفظ."
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isGeneratingAi || !name}
              onClick={() => handleGenerateAi({ replace: false })}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isGeneratingAi ? 'جاري التوليد...' : 'ولّد بالذكاء الاصطناعي'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isGeneratingAi || !name}
              onClick={() => {
                const ok = window.confirm('هل تريد استبدال الحقول التسويقية وSEO والتصنيف بالمقترح؟');
                if (!ok) return;
                handleGenerateAi({ replace: true });
              }}
            >
              استبدال بالمقترح
            </Button>
          </div>
          {hasAiSuggestedTaxonomy && (
            <p className="mt-3 text-xs text-muted-foreground">
              تم اقتراح القسم والفئة بناءً على اسم المنتج، تأكد منها قبل الحفظ.
            </p>
          )}
        </Card>

        {/* Section 1: Basic Info */}
        <Card>
          <SectionHeader
            title="معلومات المنتج الأساسية"
            description="أدخل البيانات التي تظهر للعميل في صفحة المنتج."
          />
          <div className="grid gap-4 md:grid-cols-2 max-w-full">
            <div className="min-w-0">
              <Label htmlFor="name">اسم المنتج *</Label>
              <Input id="name" {...register('name')} placeholder="مثال: سجاد تنظيف احترافي" className="w-full min-w-0" />
              <FieldError message={errors.name?.message} />
            </div>

            <div className="min-w-0">
              <Label htmlFor="slug">الرابط المختصر (Slug) *</Label>
              <div className="flex gap-2 min-w-0 max-w-full">
                <Input
                  id="slug"
                  dir="ltr"
                  value={currentSlug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setValue('slug', normalizeSlug(event.target.value), { shouldDirty: true, shouldValidate: true });
                  }}
                  placeholder="professional-cleaning-carpet"
                  className="w-full min-w-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSlugTouched(true);
                    setValue('slug', slugify(name), { shouldDirty: true, shouldValidate: true });
                  }}
                  className="flex-shrink-0"
                >
                  توليد
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground break-words whitespace-normal" dir="ltr">
                /product/{currentSlug || 'product-slug'}
              </p>
              <FieldError message={errors.slug?.message} />
            </div>

            <div className="md:col-span-2 min-w-0">
              <Label htmlFor="short_description">وصف قصير</Label>
              <Input
                id="short_description"
                {...register('short_description')}
                placeholder="وصف مختصر يظهر في صفحات القوائم (يُفضّل أقل من 100 حرف)"
                className="w-full min-w-0"
              />
            </div>

            <div className="md:col-span-2 min-w-0">
              <Label htmlFor="description">الوصف الكامل</Label>
              <textarea
                id="description"
                rows={5}
                className="mt-1 flex w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                {...register('description')}
                placeholder="اكتب وصفًا تفصيليًا للمنتج يظهر في صفحة المنتج..."
              />
            </div>

            <div className="min-w-0">
              <Label htmlFor="sku">رمز المنتج (SKU)</Label>
              <Input id="sku" dir="ltr" {...register('sku')} placeholder="مثال: BUR-12345" className="w-full min-w-0" />
            </div>

            <div className="min-w-0">
              <Label htmlFor="brand">العلامة التجارية</Label>
              <Input id="brand" {...register('brand')} placeholder="مثال: البرج" className="w-full min-w-0" />
            </div>
          </div>
        </Card>

        {/* Section 2: Classification */}
        <Card>
          <SectionHeader
            title="التصنيف"
            description="حدد القسم والفئة المناسبين للمنتج."
          />
          <div className="grid gap-4 md:grid-cols-2 max-w-full">
            <div className="min-w-0">
              <Label>القسم الرئيسي *</Label>
              <Select
                value={selectedCategoryId || 'none'}
                onValueChange={(value) => {
                  setValue('category_id', value === 'none' ? '' : value, { shouldValidate: true });
                  setValue('subcategory_id', null);
                }}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">اختر القسم</SelectItem>
                  {(formData?.categories || []).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.category_id?.message} />
            </div>

            <div className="min-w-0">
              <Label>الفئة الفرعية</Label>
              <Select
                value={selectedSubcategoryId || 'none'}
                onValueChange={(value) => setValue('subcategory_id', value === 'none' ? null : value)}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="اختر الفئة (اختياري)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون فئة فرعية</SelectItem>
                  {filteredSubcategories.map((subcategory) => (
                    <SelectItem key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedSubcategoryId && Boolean(selectedCategoryId) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  اختر الفئة الفرعية لتسهيل ظهور المنتج في المكان الصحيح.
                </p>
              )}
              {aiTaxonomyWarning && (
                <p className="mt-1 text-xs text-amber-700">
                  {aiTaxonomyWarning}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 max-w-full">
            <Label className="mb-2 block">مناسب لـ (Intent Tags)</Label>
            <div className="flex flex-wrap gap-2">
              {INTENT_TAG_CONFIG.map((tag) => (
                <label
                  key={tag.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
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
          </div>
        </Card>

        {/* Section 3: Price & Stock */}
        <Card>
          <SectionHeader
            title="السعر والمخزون"
            description="حدد الأسعار بالدينار الأردني، وإعدادات تتبع المخزون."
          />
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="price">السعر الحالي (دينار) *</Label>
              <Input id="price" type="number" step="0.01" min="0" {...register('price')} placeholder="0.00" />
              <FieldError message={errors.price?.message} />
            </div>
            <div>
              <Label htmlFor="compare_price">السعر قبل الخصم (دينار)</Label>
              <Input
                id="compare_price"
                type="number"
                step="0.01"
                min="0"
                {...register('compare_price')}
                placeholder="اتركه فارغًا إذا لا يوجد خصم"
              />
              {hasInvalidComparePrice && (
                <p className="mt-1 text-xs text-amber-600">
                  السعر القديم يجب أن يكون أعلى من السعر الحالي لاحتساب الخصم.
                </p>
              )}
            </div>
            <div className={trackStock ? '' : 'opacity-50 pointer-events-none'}>
              <Label htmlFor="stock_quantity">الكمية المتاحة</Label>
              <Input id="stock_quantity" type="number" min="0" {...register('stock_quantity')} />
              <FieldError message={errors.stock_quantity?.message} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={trackStock}
                onChange={(event) => setValue('track_stock', event.target.checked)}
              />
              <span>تتبع المخزون</span>
            </label>
            <label className={`flex items-center gap-2 rounded-md border p-3 text-sm cursor-pointer transition-colors ${trackStock ? 'hover:bg-muted/50' : 'opacity-50 pointer-events-none'}`}>
              <input
                type="checkbox"
                checked={allowBackorders}
                disabled={!trackStock}
                onChange={(event) => setValue('allow_backorders', event.target.checked)}
              />
              <span>السماح بالطلب عند نفاد المخزون</span>
            </label>
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(event) => setValue('is_featured', event.target.checked)}
              />
              <span>منتج مميز</span>
            </label>
          </div>

          {/* Stock tracking notes */}
          <div className="mt-4 space-y-2">
            {!trackStock && (
              <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                لن يتم احتساب نفاد المخزون لهذا المنتج. العملاء سيمكنهم الطلب دائمًا.
              </p>
            )}
            {allowBackorders && trackStock && (
              <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                يمكن طلب المنتج حتى لو نفدت الكمية. سيتم تنفيذ الطلب لاحقًا عند توفر الكمية.
              </p>
            )}
          </div>
        </Card>

        {/* Section 4: Marketing */}
        <Card>
          <SectionHeader
            title="التسويق والمميزات"
            description="أضف عبارة تسويقية ومميزات المنتج والشارات."
          />
          <div className="space-y-4">
            <div>
              <Label htmlFor="marketing_tagline">العبارة التسويقية</Label>
              <Input
                id="marketing_tagline"
                {...register('marketing_tagline')}
                placeholder="مثال: رغوة عالية لتنظيف أعمق للسجاد والموكيت"
              />
              <FieldError message={(errors as any).marketing_tagline?.message} />
            </div>

            <div>
              <Label htmlFor="key_features">مميزات المنتج الرئيسية</Label>
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
                placeholder="اكتب كل ميزة في سطر منفصل. مثال:&#10;مناسب للمطاعم والكافيهات&#10;جودة عالية ومتانة&#10;سهل الاستخدام والتنظيف"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                اكتب كل ميزة في سطر منفصل (حتى 6 مميزات). تظهر في صفحة المنتج كنقاط مرقمة.
              </p>
              <FieldError message={(errors as any).key_features?.message} />
            </div>

            <div>
              <Label className="mb-2 block">شارات المنتج (Badges)</Label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {badgeOptions.map((badge) => (
                  <label
                    key={badge.key}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted"
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
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-sm">{badge.label}</span>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <FieldError message={(errors as any).product_badges?.message} />
            </div>
          </div>
        </Card>

        <div id="product-variants-section" className="scroll-mt-24">
          <ProductVariantsManager
            productId={productId}
            basePrice={Number(price) || 0}
            baseComparePrice={comparePrice ? Number(comparePrice) : null}
            baseStockQuantity={Number(stockQuantity) || 0}
            baseTrackStock={Boolean(trackStock)}
          />
        </div>

        {/* Section 6: Additional Details */}
        <Card>
          <SectionHeader
            title="تفاصيل إضافية"
            description="بيانات إضافية للمنتج (اختياري)."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="barcode">الباركود</Label>
              <Input id="barcode" dir="ltr" {...register('barcode')} placeholder=" barcode number" />
            </div>
            <div>
              <Label htmlFor="tags">الوسوم</Label>
              <Input
                id="tags"
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                placeholder="وسم 1, وسم 2, وسم 3"
              />
              <p className="mt-1 text-xs text-muted-foreground">افصل بين الوسوم بفاصلة (,)</p>
            </div>
            <div>
              <Label htmlFor="weight">الوزن (كغ)</Label>
              <Input id="weight" type="number" step="0.01" min="0" {...register('weight')} placeholder="0.00" />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-2 block">الأبعاد (سم)</Label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="length" className="text-xs text-muted-foreground">الطول</Label>
                  <Input id="length" type="number" step="0.01" min="0" {...register('dimensions.length')} placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="width" className="text-xs text-muted-foreground">العرض</Label>
                  <Input id="width" type="number" step="0.01" min="0" {...register('dimensions.width')} placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="height" className="text-xs text-muted-foreground">الارتفاع</Label>
                  <Input id="height" type="number" step="0.01" min="0" {...register('dimensions.height')} placeholder="0" />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Section 7: SEO */}
        <Card>
          <SectionHeader
            title="SEO"
            description="تحسين الظهور في محركات البحث والمشاركات (اختياري)."
          />

          {/* Meta Title */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="meta_title">عنوان الصفحة (Meta Title)</Label>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${metaTitleStatus.color}`}>{metaTitleStatus.label}</span>
                <span className="text-xs text-muted-foreground">{metaTitleCount} / 60</span>
              </div>
            </div>
            <Input
              id="meta_title"
              {...register('meta_title')}
              placeholder="يظهر في نتائج البحث"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">يفضل أن يكون بين 30 و60 حرفًا.</p>
          </div>

          {/* Meta Description */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="meta_description">وصف الصفحة (Meta Description)</Label>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${metaDescriptionStatus.color}`}>{metaDescriptionStatus.label}</span>
                <span className="text-xs text-muted-foreground">{metaDescriptionCount} / 155</span>
              </div>
            </div>
            <Input
              id="meta_description"
              {...register('meta_description')}
              placeholder="وصف مختصر يظهر تحت العنوان في البحث"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">يفضل أن يكون بين 80 و155 حرفًا.</p>
          </div>

          {/* Copy Buttons */}
          <div className="mb-6 flex flex-wrap gap-2 max-w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyTitleFromName}
              disabled={!name}
            >
              نسخ عنوان SEO من اسم المنتج
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyDescFromShort}
              disabled={!shortDescription}
            >
              نسخ وصف SEO من الوصف المختصر
            </Button>
          </div>

          {/* Google Search Preview */}
          <div className="mb-6 rounded-lg border bg-muted/30 p-4 max-w-full overflow-hidden">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">معاينة Google</h3>
            <div className="rounded-lg bg-white p-4 shadow-sm max-w-full overflow-hidden">
              <div className="text-base font-medium text-blue-600 hover:underline break-words whitespace-normal">
                {displayTitle.slice(0, 60)}
                {displayTitle.length > 60 ? '...' : ''}
              </div>
              <div className="mt-0.5 text-sm text-green-700 break-words whitespace-normal" dir="ltr">
                alburj-ecommerce.vercel.app/product/{displaySlug}
              </div>
              <div className="mt-1 text-sm text-gray-600 break-words whitespace-normal">
                {displayDescription.slice(0, 155)}
                {displayDescription.length > 155 ? '...' : ''}
              </div>
            </div>
          </div>

          {/* Social Sharing Preview */}
          <div className="rounded-lg border bg-muted/30 p-4 max-w-full overflow-hidden">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">معاينة المشاركة</h3>
            <div className="flex gap-3 rounded-lg bg-white p-3 shadow-sm max-w-full overflow-hidden">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              </div>
              <div className="flex min-w-0 flex-col justify-center">
                <div className="truncate text-sm font-semibold text-gray-900">
                  {displayTitle.slice(0, 80)}
                  {displayTitle.length > 80 ? '...' : ''}
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-gray-600">
                  {displayDescription.slice(0, 150)}
                  {displayDescription.length > 150 ? '...' : ''}
                </div>
                <div className="mt-1 text-xs text-gray-500">alburj-ecommerce.vercel.app</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Save Button at bottom */}
        <div className="flex justify-end pt-4 border-t max-w-full">
          <Button type="submit" disabled={isSubmitting} size="lg">
            <Save className="ml-2 h-4 w-4" />
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ المنتج'}
          </Button>
        </div>
      </form>

      {/* Sticky Summary Sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-6 space-y-4">
          <Card className="bg-muted/50">
            <SectionHeader title="ملخص المنتج" />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate" title={name || 'â€”'}>
                  {name || 'â€”'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">السعر:</span>
                <span className="font-semibold">{price ? formatPrice(Number(price)) : 'â€”'}</span>
              </div>
              {comparePrice && comparePrice > price && (
                <div className="flex items-center justify-between text-red-600">
                  <span className="text-sm">السعر القديم:</span>
                  <span className="line-through">{formatPrice(Number(comparePrice))}</span>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 border-t">
                {isActive ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">المنتج نشط</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-500">المنتج معطل</span>
                  </>
                )}
              </div>
              {isFeatured && (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-sm text-purple-600">منتج مميز</span>
                </div>
              )}
              {comparePrice && comparePrice > price && (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-600">عليه عرض</span>
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-muted/50">
            <SectionHeader title="حالة المخزون" />
            <div className="space-y-2">
              {!trackStock ? (
                <p className="text-sm text-muted-foreground">لا يتم تتبع المخزون</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">الكمية:</span>
                    <span className="font-medium">{stockQuantity || 0} قطعة</span>
                  </div>
                  {allowBackorders && (
                    <p className="text-xs text-muted-foreground">السماح بالطلب عند النفاد مفعل</p>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      </aside>
    </div>
  );
}
