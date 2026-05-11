'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
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
  name: string;
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
}

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export function QuickProductCreator() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<'initial' | 'uploading' | 'analyzing' | 'review' | 'saved'>('initial');
  const [productId, setProductId] = useState<string | null>(null);
  const [productSlug, setProductSlug] = useState<string | null>(null);
  const [images, setImages] = useState<ProductImageRecord[]>([]);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);

  const [aiSuggestion, setAiSuggestion] = useState<AiProductSuggestion | null>(null);
  const [showVariantWarning, setShowVariantWarning] = useState(false);

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

  const handleStartQuickCreate = async () => {
    setIsCreatingDraft(true);
    try {
      const token = await getAccessToken();
      const result = await createQuickDraftProduct(token);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر إنشاء المنتج');
      }

      setProductId(result.data.id);
      setProductSlug(result.data.slug);
      setStep('uploading');

      toast({
        title: 'تم إنشاء مسودة المنتج',
        description: 'يمكنك الآن رفع صور المنتج',
      });
    } catch (error) {
      toast({
        title: 'تعذر إنشاء المنتج',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !files.length || !productId) return;

    const token = await getAccessToken();

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('alt_text', '');
        formData.append('sort_order', '0');

        const result = await uploadAdminProductImage(token, productId, formData);
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
    if (productId && step === 'uploading') {
      loadImages();
    }
  }, [productId, step, loadImages]);

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

      setFormData({
        name: data.name || '',
        short_description: data.short_description || '',
        description: data.description || '',
        brand: data.brand || '',
        sku: data.sku || '',
        price: 0,
        compare_price: null,
        stock_quantity: 0,
        category_id: data.suggested_category_id || '',
        subcategory_id: data.suggested_subcategory_id || '',
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

  if (step === 'initial') {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin/products">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">إضافة منتج سريعة بالصور</h1>
        </div>

        <Card className="p-12 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Upload className="h-10 w-10 text-primary" />
          </div>
          <h2 className="mb-4 text-xl font-semibold">ابدأ برفع صور المنتج</h2>
          <p className="mb-8 text-muted-foreground">
            سيتم إنشاء منتج مسودة تلقائيًا، ثم رفع الصور، ثم تحليلها بالذكاء الاصطناعي لاقتراح البيانات
          </p>
          <Button size="lg" onClick={handleStartQuickCreate} disabled={isCreatingDraft}>
            {isCreatingDraft ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                جاري إنشاء المسودة...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                بدء الإضافة السريعة
              </>
            )}
          </Button>
        </Card>
      </div>
    );
  }

  if (step === 'uploading') {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin/products">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">رفع صور المنتج</h1>
        </div>

        <Card className="mb-6 p-6">
          <div className="mb-6">
            <Label htmlFor="images" className="mb-2 block text-lg font-medium">
              اختر صور المنتج
            </Label>
            <Input
              id="images"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="cursor-pointer"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              يمكنك رفع عدة صور دفعة واحدة. الحد الأقصى لكل صورة 5MB.
            </p>
          </div>

          {images.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-4 font-medium">الصور المرفوعة ({images.length})</h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className={`relative aspect-square rounded-lg border-2 ${
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

              {images.length >= 1 && (
                <div className="mt-6 flex justify-center">
                  <Button size="lg" onClick={handleAnalyzeImages} disabled={isAnalyzing}>
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        جاري تحليل الصور...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        حلّل الصور وولّد بيانات المنتج
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin/products">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">مراجعة بيانات المنتج</h1>
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

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                صور المنتج
              </CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3">
              {images.map((image) => (
                <div
                  key={image.id}
                  className={`relative aspect-square rounded-lg border-2 ${
                    image.is_primary ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <SafeImage
                    src={image.url}
                    alt={aiSuggestion?.image_alt_texts?.[image.id] || image.alt_text || ''}
                    fill
                    className="rounded-lg object-cover"
                    fallbackSrc={PLACEHOLDER_PRODUCT}
                  />
                  {image.is_primary && (
                    <span className="absolute left-2 top-2 rounded bg-primary px-2 py-1 text-xs text-white">
                      رئيسية
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  معلومات أساسية
                </CardTitle>
              </CardHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">اسم المنتج *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="اسم المنتج"
                  />
                </div>

                <div>
                  <Label htmlFor="brand">العلامة التجارية</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, brand: e.target.value }))
                    }
                    placeholder="العلامة التجارية"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">السعر *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev) => ({ ...prev, price: Number(e.target.value) }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div>
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
                    />
                  </div>
                </div>

                <div>
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
                    <SelectTrigger>
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
                  <div>
                    <Label htmlFor="subcategory">الفئة</Label>
                    <Select
                      value={formData.subcategory_id}
                      onValueChange={(value: string) =>
                        setFormData((prev) => ({ ...prev, subcategory_id: value }))
                      }
                    >
                      <SelectTrigger>
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
                  </div>
                )}

                <div>
                  <Label htmlFor="short_description">وصف مختصر</Label>
                  <textarea
                    id="short_description"
                    value={formData.short_description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData((prev) => ({ ...prev, short_description: e.target.value }))
                    }
                    placeholder="وصف مختصر للمنتج"
                    rows={2}
                    className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                    placeholder="وصف تفصيلي للمنتج"
                    rows={4}
                    className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, sku: e.target.value }))
                    }
                    placeholder="كود المنتج"
                  />
                </div>

                <div>
                  <Label htmlFor="stock_quantity">الكمية المتوفرة</Label>
                  <Input
                    id="stock_quantity"
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, stock_quantity: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  SEO
                </CardTitle>
              </CardHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="meta_title">عنوان الصفحة (Meta Title)</Label>
                  <Input
                    id="meta_title"
                    value={formData.meta_title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, meta_title: e.target.value }))
                    }
                    placeholder="عنوان SEO"
                  />
                </div>

                <div>
                  <Label htmlFor="meta_description">وصف الصفحة (Meta Description)</Label>
                  <textarea
                    id="meta_description"
                    value={formData.meta_description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData((prev) => ({ ...prev, meta_description: e.target.value }))
                    }
                    placeholder="وصف SEO"
                    rows={2}
                    className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving || isPublishing}>
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

          <Button onClick={handlePublish} disabled={isSaving || isPublishing} variant="default">
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
