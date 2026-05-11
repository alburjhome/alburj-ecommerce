'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  Save,
  Globe,
  Package,
  Plus,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_PRODUCT } from '@/lib/image-utils';
import {
  createQuickDraftProduct,
  publishQuickProduct,
  saveQuickDraft,
} from '@/app/actions/admin-quick-create';
import { getAdminProductFormData } from '@/app/actions/admin-products';
import type { CategoryOption, SubcategoryOption } from '@/app/actions/admin-products';
import {
  uploadAdminProductImage,
  getAdminProductImages,
  deleteAdminProductImage,
  setAdminProductPrimaryImage,
} from '@/app/actions/admin-product-images';
import type { ProductImageRecord } from '@/app/actions/admin-product-images';

// Local Card component (same as product-form.tsx)
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border bg-card p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>;
}

interface AiProductSuggestion {
  name: string | null;
  short_description: string | null;
  description: string | null;
  brand: string | null;
  sku: string | null;
  key_features: string[];
  meta_title: string | null;
  meta_description: string | null;
  suggested_category_id: string | null;
  suggested_subcategory_id: string | null;
  has_variants: boolean;
  variant_types: string[];
  image_alt_texts: Record<string, string>;
  detected_product_type: string | null;
  visible_text: string[];
  confidence: 'high' | 'medium' | 'low';
  uncertainty_reason: string | null;
  category_confidence: 'high' | 'medium' | 'low';
  subcategory_confidence?: 'high' | 'medium' | 'low';
}

type QuickTemplateKey =
  | 'cleaning'
  | 'personal_care'
  | 'plastics'
  | 'kitchen'
  | 'packaging'
  | 'furnishings'
  | 'appliances'
  | 'paper'
  | 'restaurants_shops';

const QUICK_TEMPLATES: { key: QuickTemplateKey; label: string; aiContext: string }[] = [
  { key: 'cleaning', label: 'منظفات', aiContext: 'قالب: منظفات' },
  { key: 'personal_care', label: 'عناية شخصية', aiContext: 'قالب: عناية شخصية' },
  { key: 'plastics', label: 'بلاستيك', aiContext: 'قالب: بلاستيكيات' },
  { key: 'kitchen', label: 'مطبخ', aiContext: 'قالب: أدوات مطبخ' },
  { key: 'packaging', label: 'تغليف', aiContext: 'قالب: تغليف وعبوات' },
  { key: 'furnishings', label: 'مفروشات', aiContext: 'قالب: مفروشات ومناشف' },
  { key: 'appliances', label: 'أجهزة كهربائية', aiContext: 'قالب: أجهزة كهربائية' },
  { key: 'paper', label: 'ورقيات', aiContext: 'قالب: ورقيات' },
  { key: 'restaurants_shops', label: 'مستلزمات مطاعم ومحلات', aiContext: 'قالب: مستلزمات مطاعم ومحلات' },
];

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export function QuickProductCreator() {
  const router = useRouter();
  const { toast } = useToast();

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<'initial' | 'review' | 'saved'>('initial');
  const [productId, setProductId] = useState<string | null>(null);
  const [productSlug, setProductSlug] = useState<string | null>(null);
  const [images, setImages] = useState<ProductImageRecord[]>([]);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isGeneratingFromName, setIsGeneratingFromName] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);

  const [aiSuggestion, setAiSuggestion] = useState<AiProductSuggestion | null>(null);
  const [aiTaxonomyWarning, setAiTaxonomyWarning] = useState<string | null>(null);
  const [showVariantWarning, setShowVariantWarning] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [showImageAiSection, setShowImageAiSection] = useState(false);

  const [nameSeed, setNameSeed] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<QuickTemplateKey | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    short_description: '',
    description: '',
    brand: '',
    sku: '',
    price: 0,
    compare_price: null as number | null,
    stock_quantity: 0,
    category_id: '',
    subcategory_id: '',
    meta_title: '',
    meta_description: '',
    marketing_tagline: '',
    key_features: [] as string[],
    product_badges: [] as string[],
  });

  useEffect(() => {
    async function loadCategories() {
      const token = await getAccessToken();
      const result = await getAdminProductFormData(token);
      if (result.success && result.data) {
        setCategories(result.data.categories);
        setSubcategories(result.data.subcategories);
      }
    }
    loadCategories();
  }, []);

  const availableSubcategories = useMemo(() => {
    if (!formData.category_id) return [];
    return subcategories.filter((s) => s.category_id === formData.category_id);
  }, [formData.category_id, subcategories]);

  useEffect(() => {
    if (!formData.category_id) return;
    if (formData.subcategory_id) return;
    if (availableSubcategories.length === 1) {
      setFormData((prev) => ({ ...prev, subcategory_id: availableSubcategories[0]!.id }));
    }
  }, [availableSubcategories, formData.category_id, formData.subcategory_id]);

  const ensureDraftProduct = useCallback(async (): Promise<{ id: string; slug: string } | null> => {
    if (productId && productSlug) return { id: productId, slug: productSlug };

    setIsCreatingDraft(true);
    try {
      const token = await getAccessToken();
      const draftName = formData.name?.trim() || nameSeed.trim() || null;
      const result = await createQuickDraftProduct(token, draftName);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر إنشاء المنتج');
      }

      setProductId(result.data.id);
      setProductSlug(result.data.slug);
      return result.data;
    } catch (error) {
      toast({
        title: 'تعذر إنشاء المنتج',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsCreatingDraft(false);
    }
  }, [productId, productSlug, toast]);

  const handleGenerateFromName = async () => {
    const trimmed = nameSeed.trim();
    if (!trimmed) {
      toast({
        title: 'اسم المنتج مطلوب',
        description: 'اكتب اسم المنتج أولًا ثم اضغط توليد البيانات',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingFromName(true);
    try {
      const draft = await ensureDraftProduct();
      if (!draft) return;

      const token = await getAccessToken();
      const templateContext = selectedTemplate
        ? QUICK_TEMPLATES.find((t) => t.key === selectedTemplate)?.aiContext || ''
        : '';

      const response = await fetch('/api/admin/ai/product-copy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: trimmed,
          notes: aiNotes.trim() || null,
          template: templateContext || null,
          price: null,
          comparePrice: null,
          existingDescription: null,
          existingShortDescription: null,
          existingMarketingTagline: null,
          existingKeyFeatures: [],
          existingProductBadges: [],
          existingIntentTags: [],
          sku: null,
          metaTitle: null,
          metaDescription: null,
          currentCategoryId: null,
          currentSubcategoryId: null,
          categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
          subcategories: subcategories.map((s) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
            category_id: s.category_id,
          })),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'فشل توليد بيانات المنتج');
      }

      const categoryConfidence = (data?.category_confidence ?? 'low') as 'high' | 'medium' | 'low';
      const subcategoryConfidence = (data?.subcategory_confidence ?? 'low') as 'high' | 'medium' | 'low';
      const suggestedCategoryId = typeof data?.category_id === 'string' ? data.category_id : '';
      const suggestedSubcategoryId = typeof data?.subcategory_id === 'string' ? data.subcategory_id : '';

      if (categoryConfidence === 'low') {
        toast({
          title: 'تنبيه التصنيف',
          description: 'لم يتمكن الذكاء الاصطناعي من تحديد القسم بثقة. يرجى اختيار القسم يدويًا.',
          variant: 'destructive',
        });
      }

      setAiSuggestion({
        name: data?.name ?? null,
        short_description: data?.short_description ?? null,
        description: data?.description ?? null,
        brand: null,
        sku: data?.suggested_sku ?? null,
        key_features: Array.isArray(data?.key_features) ? data.key_features : [],
        meta_title: data?.meta_title ?? null,
        meta_description: data?.meta_description ?? null,
        suggested_category_id: suggestedCategoryId || null,
        suggested_subcategory_id: suggestedSubcategoryId || null,
        has_variants: false,
        variant_types: [],
        image_alt_texts: {},
        detected_product_type: null,
        visible_text: [],
        confidence: 'high',
        uncertainty_reason: null,
        category_confidence: categoryConfidence,
        subcategory_confidence: subcategoryConfidence,
      });

      if ((categoryConfidence === 'high' || categoryConfidence === 'medium') && suggestedCategoryId && !suggestedSubcategoryId) {
        setAiTaxonomyWarning('تم اختيار القسم، لكن الفئة تحتاج مراجعة.');
      } else {
        setAiTaxonomyWarning(null);
      }

      setFormData((prev) => {
        const nextCategoryId =
          categoryConfidence === 'high' || categoryConfidence === 'medium' ? suggestedCategoryId : '';
        const nextSubcategoryId =
          categoryConfidence === 'high' && subcategoryConfidence === 'high' ? suggestedSubcategoryId : '';

        return {
          ...prev,
          name: (data?.name || trimmed) as string,
          short_description: data?.short_description || '',
          description: data?.description || '',
          sku: data?.suggested_sku || '',
          meta_title: data?.meta_title || '',
          meta_description: data?.meta_description || '',
          key_features: Array.isArray(data?.key_features) ? data.key_features : [],
          category_id: nextCategoryId || prev.category_id,
          subcategory_id: nextSubcategoryId || '',
        };
      });

      setStep('review');
      toast({
        title: 'تم توليد بيانات المنتج',
        description: 'راجع البيانات، أضف السعر والصور، ثم انشر',
      });
    } catch (error) {
      toast({
        title: 'فشل توليد البيانات',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingFromName(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !files.length) return;

    const draft = await ensureDraftProduct();
    if (!draft) return;

    const token = await getAccessToken();

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('alt_text', '');
        formData.append('sort_order', '0');

        const result = await uploadAdminProductImage(token, draft.id, formData);
        if (!result.success) {
          toast({
            title: 'تعذر رفع الصورة',
            description: result.error || 'حدث خطأ أثناء رفع الصورة',
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'تعذر رفع الصورة',
          description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
          variant: 'destructive',
        });
      }
    }

    loadImages();
  };

  const loadImages = useCallback(async () => {
    if (!productId) return;
    const token = await getAccessToken();
    const result = await getAdminProductImages(token, productId);
    if (result.success && result.data) {
      setImages(result.data);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) {
      loadImages();
    }
  }, [productId, loadImages]);

  const handleDeleteImage = async (imageId: string) => {
    const token = await getAccessToken();
    const result = await deleteAdminProductImage(token, imageId);
    if (result.success) {
      loadImages();
    } else {
      toast({
        title: 'تعذر حذف الصورة',
        description: result.error || 'حدث خطأ',
        variant: 'destructive',
      });
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    if (!productId) return;
    const token = await getAccessToken();
    const result = await setAdminProductPrimaryImage(token, imageId);
    if (result.success) {
      loadImages();
    }
  };

  const handleAnalyzeImages = async () => {
    if (!productId || images.length === 0) return;

    setIsAnalyzing(true);
    try {
      const token = await getAccessToken();

      const response = await fetch('/api/admin/ai/product-from-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId,
          imageUrls: images.map((img) => img.url),
          categories: categories.map((c) => ({ id: c.id, name: c.name })),
          subcategories: subcategories.map((s) => ({ id: s.id, name: s.name, category_id: s.category_id })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'تعذر تحليل الصور');
      }

      const data = await response.json();
      setAiSuggestion(data);

      const isLowConfidence = data?.confidence === 'low';

      setFormData({
        name: isLowConfidence ? '' : (data.name || ''),
        short_description: data.short_description || '',
        description: data.description || '',
        brand: data.brand || '',
        sku: data.sku || '',
        price: 0,
        compare_price: null,
        stock_quantity: 0,
        category_id: isLowConfidence ? '' : (data.suggested_category_id || ''),
        subcategory_id: isLowConfidence ? '' : (data.suggested_subcategory_id || ''),
        meta_title: data.meta_title || '',
        meta_description: data.meta_description || '',
        marketing_tagline: '',
        key_features: data.key_features || [],
        product_badges: [],
      });

      if (data.has_variants) {
        setShowVariantWarning(true);
      }

      setStep('review');

      toast({
        title: 'تم تحليل الصور',
        description: 'راجع البيانات المقترحة قبل الحفظ',
      });
    } catch (error) {
      toast({
        title: 'تعذر تحليل الصور',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!productId) return;
    setIsSaving(true);

    try {
      const token = await getAccessToken();
      const result = await saveQuickDraft(token, productId, {
        ...formData,
        is_active: false,
      });

      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ المسودة');
      }

      setStep('saved');
      toast({
        title: 'تم حفظ المسودة',
        description: 'يمكنك العودة لاحقًا لإكمال المنتج',
      });
    } catch (error) {
      toast({
        title: 'تعذر الحفظ',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!productId) return;
    setIsPublishing(true);

    try {
      const token = await getAccessToken();
      const result = await publishQuickProduct(token, productId, {
        ...formData,
        is_active: true,
      });

      if (!result.success) {
        throw new Error(result.error || 'تعذر نشر المنتج');
      }

      setStep('saved');
      toast({
        title: 'تم نشر المنتج',
        description: 'المنتج متاح الآن للعملاء',
      });
    } catch (error) {
      toast({
        title: 'تعذر النشر',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const resetForNewProduct = useCallback(() => {
    setProductId(null);
    setProductSlug(null);
    setImages([]);
    setAiSuggestion(null);
    setNameSeed('');
    setAiNotes('');
    setSelectedTemplate(null);
    setStep('initial');
    setFormData({
      name: '',
      short_description: '',
      description: '',
      brand: '',
      sku: '',
      price: 0,
      compare_price: null,
      stock_quantity: 0,
      category_id: '',
      subcategory_id: '',
      meta_title: '',
      meta_description: '',
      marketing_tagline: '',
      key_features: [],
      product_badges: [],
    });
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
  }, []);

  const handlePublishAndNew = async () => {
    if (!productId) return;

    if (!formData.name.trim() || !formData.price || formData.price <= 0 || !formData.category_id) {
      toast({
        title: 'تعذر النشر',
        description: 'تأكد من إدخال الاسم والسعر والقسم قبل النشر',
        variant: 'destructive',
      });
      return;
    }

    const hasPrimaryImage = images.some((img) => img.is_primary);
    if (!hasPrimaryImage) {
      toast({
        title: 'تنبيه',
        description: 'يفضل إضافة صورة رئيسية قبل النشر',
      });
    }

    setIsPublishing(true);
    try {
      const token = await getAccessToken();
      const result = await publishQuickProduct(token, productId, {
        ...formData,
        is_active: true,
      });

      if (!result.success) {
        throw new Error(result.error || 'تعذر نشر المنتج');
      }

      toast({
        title: 'تم نشر المنتج',
        description: 'يمكنك الآن إضافة منتج جديد بسرعة',
      });

      resetForNewProduct();
    } catch (error) {
      toast({
        title: 'تعذر النشر',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveAndOpenAdvanced = async () => {
    if (!productId) return;
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      const result = await saveQuickDraft(token, productId, {
        ...formData,
        is_active: false,
      });

      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ المسودة');
      }

      router.push(`/admin/products/${productId}/edit`);
    } catch (error) {
      toast({
        title: 'تعذر الحفظ',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (step === 'initial') {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 overflow-x-hidden">
        <div className="mb-6 flex min-w-0 items-center gap-4">
          <Link href="/admin/products">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="min-w-0 break-words text-2xl font-bold whitespace-normal">إضافة منتج سريعة بالاسم</h1>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name_seed" className="mb-2 block text-lg font-medium">
                اكتب اسم المنتج
              </Label>
              <Input
                id="name_seed"
                ref={nameInputRef}
                value={nameSeed}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNameSeed(e.target.value)}
                placeholder="مثال: شامبو أطفال برائحة اللافندر 500 مل"
                className="w-full min-w-0"
              />
            </div>

            <div>
              <Label htmlFor="ai_notes" className="mb-2 block font-medium">
                ملاحظات تساعد الذكاء الاصطناعي
              </Label>
              <textarea
                id="ai_notes"
                value={aiNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAiNotes(e.target.value)}
                placeholder="مثال: هذا المنتج للعناية بالشعر وليس منظف"
                rows={3}
                className="mt-1 flex w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-muted-foreground">قوالب سريعة</div>
              <div className="flex flex-wrap gap-2">
                {QUICK_TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSelectedTemplate((prev) => (prev === t.key ? null : t.key))}
                    className={`rounded-full border px-3 py-1 text-sm whitespace-normal break-words max-w-full ${
                      selectedTemplate === t.key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-start">
              <Button
                size="lg"
                onClick={handleGenerateFromName}
                disabled={isCreatingDraft || isGeneratingFromName}
                className="w-full sm:w-auto"
              >
                {isCreatingDraft || isGeneratingFromName ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    جاري التوليد...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    ولّد بيانات المنتج من الاسم
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 overflow-x-hidden">
        <div className="mb-6 flex min-w-0 items-center gap-4">
          <Link href="/admin/products">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="min-w-0 break-words text-2xl font-bold whitespace-normal">مراجعة بيانات المنتج</h1>
        </div>

        {showVariantWarning && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">يبدو أن هذا المنتج يحتوي على متغيرات</h3>
                <p className="text-sm">
                  مثل النكهة أو الحجم أو اللون. سيتم دعم المتغيرات في مرحلة مستقبلية. حاليًا سيتم
                  إضافة المنتج كمنتج واحد.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI Analysis Info */}
        {aiSuggestion && (
          <Card className="mb-6 p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                نتائج تحليل الذكاء الاصطناعي
              </CardTitle>
            </CardHeader>

            <div className="space-y-4">
              {/* Confidence Badge */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">درجة الثقة:</span>
                {aiSuggestion.confidence === 'high' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                    <CheckCircle2 className="h-4 w-4" />
                    عالية
                  </span>
                )}
                {aiSuggestion.confidence === 'medium' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
                    <AlertCircle className="h-4 w-4" />
                    متوسطة
                  </span>
                )}
                {aiSuggestion.confidence === 'low' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
                    <AlertCircle className="h-4 w-4" />
                    منخفضة - يرجى المراجعة
                  </span>
                )}
              </div>

              {/* Detected Product Type */}
              {aiSuggestion.detected_product_type && (
                <div className="rounded-lg bg-muted p-3">
                  <span className="text-sm font-medium text-muted-foreground">نوع المنتج المكتشف:</span>
                  <p className="mt-1 font-medium">{aiSuggestion.detected_product_type}</p>
                </div>
              )}

              {/* Visible Text */}
              {aiSuggestion.visible_text && aiSuggestion.visible_text.length > 0 && (
                <div className="rounded-lg bg-muted p-3">
                  <span className="text-sm font-medium text-muted-foreground">النصوص الظاهرة على العبوة:</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {aiSuggestion.visible_text.map((text, i) => (
                      <span key={i} className="inline-block rounded bg-background px-2 py-1 text-sm">
                        {text}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Uncertainty Reason */}
              {aiSuggestion.uncertainty_reason && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800">
                  <span className="text-sm font-medium">سبب عدم التأكد:</span>
                  <p className="mt-1 text-sm">{aiSuggestion.uncertainty_reason}</p>
                </div>
              )}

              {/* Low Confidence Warning */}
              {aiSuggestion.confidence === 'low' && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">لم يتمكن الذكاء الاصطناعي من تحديد المنتج بثقة</h4>
                      <p className="mt-1 text-sm">
                        راجع البيانات المقترحة وعدّلها يدويًا قبل الحفظ. لا تعتمد فقط على ما اقترحه AI.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}


        <div className="grid gap-6">
          {/* Card 1: Basics */}
          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex min-w-0 items-center gap-2 whitespace-normal break-words">
                <Package className="h-5 w-5 flex-shrink-0" />
                الأساسيات
              </CardTitle>
            </CardHeader>

            <div className="grid gap-4">
              <div className="min-w-0">
                <Label htmlFor="name">اسم المنتج *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="اسم المنتج"
                  className="w-full min-w-0"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <Label htmlFor="price">السعر *</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, price: Number(e.target.value) }))
                    }
                    placeholder="0.00"
                    className="w-full min-w-0"
                  />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="compare_price">السعر قبل الخصم</Label>
                  <Input
                    id="compare_price"
                    type="number"
                    value={formData.compare_price || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({
                        ...prev,
                        compare_price: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    placeholder="0.00"
                    className="w-full min-w-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, sku: e.target.value }))
                    }
                    placeholder="كود المنتج"
                    className="w-full min-w-0"
                  />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="status">الحالة</Label>
                  <div className="mt-2 text-sm text-muted-foreground">مسودة / نشر</div>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedDetails((v) => !v)}
                  className="text-sm font-medium text-primary whitespace-normal break-words"
                >
                  {showAdvancedDetails ? 'إخفاء التفاصيل المتقدمة' : 'إظهار التفاصيل المتقدمة'}
                </button>

                {showAdvancedDetails && (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <Label htmlFor="stock_quantity">الكمية المتوفرة</Label>
                      <Input
                        id="stock_quantity"
                        type="number"
                        value={formData.stock_quantity}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData((prev) => ({ ...prev, stock_quantity: Number(e.target.value) }))
                        }
                        className="w-full min-w-0"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Card 2: Classification */}
          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex min-w-0 items-center gap-2 whitespace-normal break-words">
                <Package className="h-5 w-5 flex-shrink-0" />
                التصنيف
              </CardTitle>
            </CardHeader>

            <div className="grid gap-4">
              <div className="min-w-0">
                <Label htmlFor="category">القسم *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value: string) =>
                    setFormData((prev) => ({
                      ...prev,
                      category_id: value,
                      subcategory_id: '',
                    }))
                  }
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {availableSubcategories.length > 0 && (
                <div className="min-w-0">
                  <Label htmlFor="subcategory">الفئة</Label>
                  <Select
                    value={formData.subcategory_id}
                    onValueChange={(value: string) =>
                      setFormData((prev) => ({ ...prev, subcategory_id: value }))
                    }
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSubcategories.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!formData.subcategory_id && Boolean(formData.category_id) && (
                    <p className="mt-1 text-xs text-muted-foreground break-words whitespace-normal">
                      اختر الفئة الفرعية لتسهيل ظهور المنتج في المكان الصحيح.
                    </p>
                  )}
                  {aiTaxonomyWarning && (
                    <p className="mt-1 text-xs text-amber-700 break-words whitespace-normal">
                      {aiTaxonomyWarning}
                    </p>
                  )}
                </div>
              )}

              <div className="min-w-0">
                <Label htmlFor="product_badges">وسوم المنتج</Label>
                <Input
                  id="product_badges"
                  value={formData.product_badges.join(', ')}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev) => ({
                      ...prev,
                      product_badges: e.target.value
                        .split(',')
                        .map((v) => v.trim())
                        .filter((v) => v.length > 0),
                    }))
                  }
                  placeholder="مثال: new, offer"
                  className="w-full min-w-0"
                />
              </div>
            </div>
          </Card>

          {/* Card 3: Images */}
          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex min-w-0 items-center gap-2 whitespace-normal break-words">
                <ImageIcon className="h-5 w-5 flex-shrink-0" />
                الصور
              </CardTitle>
            </CardHeader>

            <div className="space-y-4">
              <div className="min-w-0">
                <Label htmlFor="images" className="mb-2 block font-medium">
                  رفع صورة رئيسية / صور إضافية
                </Label>
                <Input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="cursor-pointer w-full min-w-0"
                />
              </div>

              {images.length > 0 && (
                <div>
                  <div className="mb-3 font-medium">الصور المرفوعة ({images.length})</div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {images.map((image) => (
                      <div
                        key={image.id}
                        className={`relative aspect-square max-w-full overflow-hidden rounded-lg border-2 ${
                          image.is_primary ? 'border-primary' : 'border-transparent'
                        }`}
                      >
                        <SafeImage
                          src={image.url}
                          alt={image.alt_text || ''}
                          fill
                          className="rounded-lg object-cover"
                          fallbackSrc={PLACEHOLDER_PRODUCT}
                        />
                        {image.is_primary && (
                          <span className="absolute left-2 top-2 rounded bg-primary px-2 py-1 text-xs text-white">
                            رئيسية
                          </span>
                        )}

                        <div className="absolute bottom-2 right-2 flex gap-1">
                          {!image.is_primary && (
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8"
                              onClick={() => handleSetPrimary(image.id)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-8 w-8"
                            onClick={() => handleDeleteImage(image.id)}
                          >
                            <span className="text-lg leading-none">×</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowImageAiSection((v) => !v)}
                  className="text-sm font-medium text-primary whitespace-normal break-words"
                >
                  {showImageAiSection
                    ? 'إخفاء تحليل الصور بالذكاء الاصطناعي'
                    : 'تحليل الصور بالذكاء الاصطناعي - يتطلب رصيد/مزود يدعم الصور'}
                </button>

                {showImageAiSection && (
                  <div className="mt-4 rounded-lg border bg-muted/30 p-4">
                    <div className="text-sm text-muted-foreground whitespace-normal break-words">
                      هذا الخيار اختياري ومغلق افتراضيًا.
                    </div>
                    <div className="mt-3">
                      <Button
                        onClick={handleAnalyzeImages}
                        disabled={isAnalyzing || images.length === 0}
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            جاري تحليل الصور...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            حلّل الصور (اختياري)
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Card 4: Description & SEO */}
          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex min-w-0 items-center gap-2 whitespace-normal break-words">
                <Globe className="h-5 w-5 flex-shrink-0" />
                الوصف و SEO
              </CardTitle>
            </CardHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="short_description">الوصف القصير</Label>
                <textarea
                  id="short_description"
                  value={formData.short_description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((prev) => ({ ...prev, short_description: e.target.value }))
                  }
                  placeholder="جملتان فقط"
                  rows={2}
                  className="mt-1 flex w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div>
                <Label htmlFor="description">الوصف الكامل</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="مقدمة قصيرة ثم أهم الميزات..."
                  rows={5}
                  className="mt-1 flex w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div>
                <Label htmlFor="key_features">المميزات (4 إلى 6 نقاط)</Label>
                <textarea
                  id="key_features"
                  value={formData.key_features.join('\n')}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((prev) => ({
                      ...prev,
                      key_features: e.target.value
                        .split('\n')
                        .map((v) => v.trim())
                        .filter((v) => v.length > 0)
                        .slice(0, 6),
                    }))
                  }
                  placeholder="- ميزة\n- ميزة\n- ميزة"
                  rows={5}
                  className="mt-1 flex w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <Label htmlFor="meta_title">Meta Title</Label>
                  <Input
                    id="meta_title"
                    value={formData.meta_title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, meta_title: e.target.value }))
                    }
                    placeholder="50-60 حرفًا"
                    className="w-full min-w-0"
                  />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="meta_description">Meta Description</Label>
                  <textarea
                    id="meta_description"
                    value={formData.meta_description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData((prev) => ({ ...prev, meta_description: e.target.value }))
                    }
                    placeholder="120-155 حرفًا"
                    rows={2}
                    className="mt-1 flex w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 mt-8 border-t bg-background/95 py-4 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSaving || isPublishing}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  حفظ كمسودة
                </>
              )}
            </Button>

            <Button
              onClick={handlePublish}
              disabled={isSaving || isPublishing}
              variant="default"
              className="w-full sm:w-auto"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  جاري النشر...
                </>
              ) : (
                <>
                  <Globe className="mr-2 h-4 w-4" />
                  نشر المنتج
                </>
              )}
            </Button>

            <Button
              onClick={handlePublishAndNew}
              disabled={isSaving || isPublishing}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              نشر وإضافة منتج جديد
            </Button>

            <Button
              onClick={handleSaveAndOpenAdvanced}
              disabled={isSaving || isPublishing}
              variant="outline"
              className="w-full sm:w-auto"
            >
              حفظ وفتح التعديل المتقدم
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'saved' && productId && productSlug) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin/products">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">تم حفظ المنتج</h1>
        </div>

        <Card className="p-12 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="mb-4 text-xl font-semibold">تم حفظ المنتج بنجاح</h2>
          <p className="mb-8 text-muted-foreground">
            يمكنك الآن إضافة منتج آخر أو تعديل المنتج أو مشاهدته في المتجر
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/admin/products/quick-create">
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                إضافة منتج آخر بالصور
              </Button>
            </Link>

            <Link href={`/admin/products/${productId}/edit`}>
              <Button variant="outline">
                <Package className="mr-2 h-4 w-4" />
                تعديل متقدم
              </Button>
            </Link>

            <Link href={`/product/${productSlug}`} target="_blank">
              <Button>
                <ExternalLink className="mr-2 h-4 w-4" />
                فتح المنتج في المتجر
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
