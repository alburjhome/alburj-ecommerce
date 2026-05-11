'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageIcon, RefreshCw, Save, Star, Trash2, Upload, ArrowUp, ArrowDown, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SafeImage } from '@/components/ui/safe-image';
import { useToast } from '@/hooks/use-toast';
import {
  deleteAdminProductImage,
  getAdminProductImages,
  setAdminProductPrimaryImage,
  updateAdminProductImage,
  uploadAdminProductImage,
} from '@/app/actions/admin-product-images';
import type { ProductImageRecord } from '@/app/actions/admin-product-images';
import { PLACEHOLDER_PRODUCT, safeImageSrc } from '@/lib/image-utils';
import { supabase } from '@/lib/supabase';

interface ProductData {
  name?: string;
  categoryName?: string;
  shortDescription?: string;
  marketingTagline?: string;
  keyFeatures?: string[];
}

interface ProductImagesManagerProps {
  productId?: string;
  ensureProductId?: () => Promise<string | null>;
  focusOnMount?: boolean;
  productData?: ProductData;
}

interface ImageDraft {
  alt_text: string;
  sort_order: string;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

function buildDrafts(images: ProductImageRecord[]) {
  return images.reduce<Record<string, ImageDraft>>((acc, image) => {
    acc[image.id] = {
      alt_text: image.alt_text || '',
      sort_order: String(image.sort_order),
    };
    return acc;
  }, {});
}

function validateImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    return 'اختر ملف صورة فقط';
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return 'حجم الصورة يجب ألا يتجاوز 5MB';
  }

  return null;
}

export function ProductImagesManager({
  productId,
  ensureProductId,
  focusOnMount = false,
  productData,
}: ProductImagesManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [images, setImages] = useState<ProductImageRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ImageDraft>>({});
  const [isLoading, setIsLoading] = useState(Boolean(productId));
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadAltText, setUploadAltText] = useState('');
  const [uploadSortOrder, setUploadSortOrder] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [generatingAltTextId, setGeneratingAltTextId] = useState<string | null>(null);

  const nextSortOrder = useMemo(() => {
    if (!images.length) return 10;
    return Math.max(...images.map((image) => image.sort_order)) + 10;
  }, [images]);

  const fetchImages = useCallback(async (targetProductId: string) => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const result = await getAdminProductImages(token, targetProductId);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر تحميل صور المنتج');
      }

      setImages(result.data);
      setDrafts(buildDrafts(result.data));
      setUploadSortOrder('');
    } catch (error) {
      toast({
        title: 'تعذر تحميل صور المنتج',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadImages = useCallback(async () => {
    if (!productId) {
      setImages([]);
      setDrafts({});
      setUploadSortOrder('');
      setIsLoading(false);
      return;
    }

    await fetchImages(productId);
  }, [fetchImages, productId]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  useEffect(() => {
    if (!focusOnMount) return;

    const id = window.setTimeout(() => {
      const container = document.getElementById('product-images');
      container?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    return () => window.clearTimeout(id);
  }, [focusOnMount]);

  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    };
  }, [uploadPreviewUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setUploadFile(null);
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      toast({
        title: 'ملف غير صالح',
        description: validationError,
        variant: 'destructive',
      });
      setUploadFile(null);
      setFileInputKey((key) => key + 1);
      return;
    }

    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadFile(file);
    setUploadPreviewUrl(URL.createObjectURL(file));
  }

  async function handleUpload() {
    if (!uploadFile) {
      toast({
        title: 'اختر صورة',
        description: 'اختر صورة قبل تنفيذ الرفع.',
        variant: 'destructive',
      });
      return;
    }

    const validationError = validateImageFile(uploadFile);
    if (validationError) {
      toast({
        title: 'ملف غير صالح',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setMutatingId('upload');
    try {
      const effectiveProductId = productId || (ensureProductId ? await ensureProductId() : null);
      if (!effectiveProductId) {
        throw new Error('احفظ المنتج كمسودة أولًا حتى يمكن رفع الصور.');
      }

      const token = await getAccessToken();
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('alt_text', uploadAltText);
      if (uploadSortOrder.trim()) {
        formData.append('sort_order', uploadSortOrder);
      }

      const result = await uploadAdminProductImage(token, effectiveProductId, formData);
      if (!result.success) {
        throw new Error(result.error || 'تعذر رفع الصورة');
      }

      toast({
        title: 'تم رفع الصورة',
        description: uploadFile.name,
      });
      setUploadFile(null);
      setUploadAltText('');
      if (uploadPreviewUrl) {
        URL.revokeObjectURL(uploadPreviewUrl);
        setUploadPreviewUrl(null);
      }
      setFileInputKey((key) => key + 1);
      await fetchImages(effectiveProductId);
      router.refresh();
    } catch (error) {
      toast({
        title: 'تعذر رفع الصورة',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setMutatingId(null);
    }
  }

  async function handleSaveMeta(image: ProductImageRecord) {
    const draft = drafts[image.id];
    const sortOrder = Number(draft?.sort_order ?? image.sort_order);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      toast({
        title: 'ترتيب غير صالح',
        description: 'ترتيب الصورة يجب أن يكون رقماً صحيحاً لا يقل عن صفر.',
        variant: 'destructive',
      });
      return;
    }

    setMutatingId(image.id);
    try {
      const token = await getAccessToken();
      const result = await updateAdminProductImage(token, image.id, {
        alt_text: draft?.alt_text || null,
        sort_order: sortOrder,
      });

      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ الصورة');
      }

      toast({ title: 'تم حفظ بيانات الصورة' });
      await loadImages();
      router.refresh();
    } catch (error) {
      toast({
        title: 'تعذر حفظ بيانات الصورة',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setMutatingId(null);
    }
  }

  async function handleSetPrimary(image: ProductImageRecord) {
    if (image.is_primary) return;

    setMutatingId(image.id);
    try {
      const token = await getAccessToken();
      const result = await setAdminProductPrimaryImage(token, image.id);

      if (!result.success) {
        throw new Error(result.error || 'تعذر تعيين الصورة الأساسية');
      }

      toast({ title: 'تم تعيين الصورة الأساسية' });
      await loadImages();
      router.refresh();
    } catch (error) {
      toast({
        title: 'تعذر تعيين الصورة الأساسية',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setMutatingId(null);
    }
  }

  async function handleDelete(image: ProductImageRecord) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف هذه الصورة؟\n\n${image.is_primary ? '⚠️ هذه هي الصورة الرئيسية للمنتج. سيتم تعيين صورة أخرى كرئيسية بعد الحذف.\n\n' : ''}سيتم حذف الصورة نهائيًا من المنتج ومن التخزين. لا يمكن التراجع عن هذا الإجراء.`
    );

    if (!confirmed) return;

    setMutatingId(image.id);
    try {
      const token = await getAccessToken();
      const result = await deleteAdminProductImage(token, image.id);

      if (!result.success) {
        throw new Error(result.error || 'تعذر حذف الصورة');
      }

      toast({
        title: 'تم حذف الصورة',
        description: 'تم حذف الصورة بنجاح',
      });
      await loadImages();
      router.refresh();
    } catch (error) {
      toast({
        title: 'تعذر حذف الصورة',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setMutatingId(null);
    }
  }

  async function handleMoveUp(image: ProductImageRecord) {
    const currentIndex = images.findIndex((img) => img.id === image.id);
    if (currentIndex <= 0) return;

    const prevImage = images[currentIndex - 1];
    const currentSortOrder = image.sort_order;
    const prevSortOrder = prevImage.sort_order;

    setMutatingId(image.id);
    try {
      const token = await getAccessToken();

      // Swap sort orders
      const result1 = await updateAdminProductImage(token, image.id, {
        alt_text: image.alt_text,
        sort_order: prevSortOrder,
      });
      const result2 = await updateAdminProductImage(token, prevImage.id, {
        alt_text: prevImage.alt_text,
        sort_order: currentSortOrder,
      });

      if (!result1.success || !result2.success) {
        throw new Error('تعذر تغيير ترتيب الصور');
      }

      await loadImages();
      router.refresh();
    } catch (error) {
      toast({
        title: 'تعذر تغيير الترتيب',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setMutatingId(null);
    }
  }

  async function handleMoveDown(image: ProductImageRecord) {
    const currentIndex = images.findIndex((img) => img.id === image.id);
    if (currentIndex === -1 || currentIndex >= images.length - 1) return;

    const nextImage = images[currentIndex + 1];
    const currentSortOrder = image.sort_order;
    const nextSortOrder = nextImage.sort_order;

    setMutatingId(image.id);
    try {
      const token = await getAccessToken();

      // Swap sort orders
      const result1 = await updateAdminProductImage(token, image.id, {
        alt_text: image.alt_text,
        sort_order: nextSortOrder,
      });
      const result2 = await updateAdminProductImage(token, nextImage.id, {
        alt_text: nextImage.alt_text,
        sort_order: currentSortOrder,
      });

      if (!result1.success || !result2.success) {
        throw new Error('تعذر تغيير ترتيب الصور');
      }

      await loadImages();
      router.refresh();
    } catch (error) {
      toast({
        title: 'تعذر تغيير الترتيب',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setMutatingId(null);
    }
  }

  async function handleGenerateAiAltText(image: ProductImageRecord, draft: ImageDraft) {
    if (!productData?.name) {
      toast({
        title: 'أدخل اسم المنتج أولًا',
        description: 'يجب إدخال اسم المنتج في النموذج أعلاه قبل توليد وصف الصورة.',
        variant: 'destructive',
      });
      return;
    }

    // If alt text already exists, confirm replacement
    if (draft.alt_text?.trim()) {
      const confirmed = window.confirm(
        'الحقل يحتوي على نص بالفعل. هل تريد استبداله بالوصف المُولد بالذكاء الاصطناعي؟'
      );
      if (!confirmed) return;
    }

    setGeneratingAltTextId(image.id);
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/admin/ai/image-alt-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productName: productData.name,
          categoryName: productData.categoryName,
          shortDescription: productData.shortDescription,
          marketingTagline: productData.marketingTagline,
          keyFeatures: productData.keyFeatures,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'تعذر توليد الوصف');
      }

      const data = await response.json();
      if (!data.alt_text) {
        throw new Error('لم يتم استلام وصف صالح');
      }

      // Update draft with generated alt text (doesn't save automatically)
      setDrafts((current) => ({
        ...current,
        [image.id]: { ...draft, alt_text: data.alt_text },
      }));

      toast({
        title: 'تم توليد الوصف',
        description: 'راجع الوصف ثم اضغط "حفظ" لتطبيقه.',
      });
    } catch (error) {
      toast({
        title: 'تعذر توليد الوصف',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setGeneratingAltTextId(null);
    }
  }

  const hasPrimaryImage = images.some((img) => img.is_primary);

  return (
    <section id="product-images" className="rounded-lg border bg-card p-5 shadow-sm">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className={focusOnMount ? 'text-xl font-bold ring-2 ring-primary/30 rounded-md px-2 py-1 inline-block' : 'text-xl font-bold'}>
            صور المنتج
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ارفع صور واضحة للمنتج. الصورة الرئيسية تظهر في كرت المنتج وصفحة المنتج.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadImages} disabled={isLoading}>
          <RefreshCw className={`ml-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* No Primary Image Warning */}
      {!isLoading && images.length > 0 && !hasPrimaryImage && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">لم يتم تحديد صورة رئيسية بعد</p>
              <p className="text-sm text-amber-700">
                أول صورة ستظهر غالبًا في المتجر. انقر على زر "تعيين كرئيسية" لتحديد الصورة المناسبة.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Primary Image Info */}
      {!isLoading && images.length > 0 && hasPrimaryImage && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-900">تم تحديد الصورة الرئيسية</p>
              <p className="text-sm text-green-700">
                الصورة المعلمة بـ "رئيسية" هي التي تظهر في قوائم المنتجات ومشاركات التواصل الاجتماعي.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="mb-6 rounded-lg border bg-muted/30 p-5">
        <h3 className="mb-4 font-semibold">رفع صورة جديدة</h3>
        <div className="grid gap-4 lg:grid-cols-[140px_1fr_1fr_auto] lg:items-end">
          {/* Preview */}
          <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 bg-background">
            {uploadPreviewUrl ? (
              <img src={uploadPreviewUrl} alt="معاينة الصورة" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
                <span className="text-xs">معاينة</span>
              </div>
            )}
          </div>

          {/* File Input */}
          <div>
            <Label htmlFor="product-image-file">اختر ملف الصورة *</Label>
            <Input
              key={fileInputKey}
              id="product-image-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              JPG, PNG, WEBP, GIF - الحد الأقصى 5MB
            </p>
          </div>

          {/* Alt Text */}
          <div>
            <Label htmlFor="product-image-alt">وصف الصورة (للمحركات)</Label>
            <Input
              id="product-image-alt"
              value={uploadAltText}
              onChange={(event) => setUploadAltText(event.target.value)}
              placeholder="مثال: شامبو تنظيف السجاد بفرشاة مدمجة"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              يظهر عند عدم تحميل الصورة ويساعد في SEO
            </p>
          </div>

          {/* Sort Order & Upload Button */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="product-image-order">الترتيب</Label>
              <Input
                id="product-image-order"
                type="number"
                min="0"
                value={uploadSortOrder}
                onChange={(event) => setUploadSortOrder(event.target.value)}
                placeholder={String(nextSortOrder)}
              />
            </div>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={mutatingId === 'upload' || !uploadFile}
              className="self-end"
            >
              <Upload className="ml-2 h-4 w-4" />
              {mutatingId === 'upload' ? 'جاري الرفع...' : productId ? 'رفع' : 'إنشاء مسودة ورفع'}
            </Button>
          </div>
        </div>
      </div>

      {/* Images Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="aspect-[4/3] rounded-lg border bg-muted animate-pulse" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 px-4 py-16 text-center">
          <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold text-muted-foreground">لا توجد صور لهذا المنتج بعد</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            ارفع صورة واحدة على الأقل حتى يظهر المنتج بشكل أفضل في المتجر.
            <br />
            الصورة الأولى التي ترفعها ستصبح تلقائيًا الصورة الرئيسية.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => {
            const draft = drafts[image.id] || { alt_text: '', sort_order: String(image.sort_order) };
            const isBusy = mutatingId === image.id;
            const isFirst = index === 0;
            const isLast = index === images.length - 1;

            return (
              <article
                key={image.id}
                className={`group relative rounded-lg border bg-background p-3 transition-shadow hover:shadow-md ${
                  image.is_primary ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
              >
                {/* Image Container */}
                <div className="relative aspect-[4/3] overflow-hidden rounded-md border bg-muted">
                  <SafeImage
                    src={safeImageSrc(image.url, PLACEHOLDER_PRODUCT)}
                    fallbackSrc={PLACEHOLDER_PRODUCT}
                    alt={draft.alt_text || image.alt_text || 'صورة المنتج'}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />

                  {/* Primary Badge */}
                  {image.is_primary && (
                    <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                      <Star className="h-3 w-3 fill-current" />
                      رئيسية
                    </div>
                  )}

                  {/* Sort Order Badge */}
                  <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    #{image.sort_order}
                  </div>
                </div>

                {/* Alt Text Input with AI Button */}
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`alt-${image.id}`} className="text-xs">
                      وصف الصورة (Alt text)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleGenerateAiAltText(image, draft)}
                      disabled={generatingAltTextId === image.id || !productData?.name}
                      className="h-6 px-2 text-xs text-primary hover:text-primary"
                    >
                      <Sparkles className="ml-1 h-3 w-3" />
                      {generatingAltTextId === image.id ? 'جاري التوليد...' : 'ولّد بالذكاء الاصطناعي'}
                    </Button>
                  </div>
                  <Input
                    id={`alt-${image.id}`}
                    size-alias={1}
                    value={draft.alt_text}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [image.id]: { ...draft, alt_text: event.target.value },
                      }))
                    }
                    placeholder="وصف للمحركات..."
                    className="mt-1 h-8 text-sm"
                  />
                </div>

                {/* Action Buttons */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {/* Save Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveMeta(image)}
                    disabled={isBusy}
                    className="h-8 px-2 text-xs"
                  >
                    <Save className="ml-1 h-3 w-3" />
                    حفظ
                  </Button>

                  {/* Set Primary Button */}
                  {!image.is_primary && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetPrimary(image)}
                      disabled={isBusy}
                      className="h-8 px-2 text-xs"
                    >
                      <Star className="ml-1 h-3 w-3" />
                      تعيين كرئيسية
                    </Button>
                  )}

                  {/* Move Up */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMoveUp(image)}
                    disabled={isBusy || isFirst}
                    className="h-8 w-8 p-0"
                    title="تحريك للأعلى"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>

                  {/* Move Down */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMoveDown(image)}
                    disabled={isBusy || isLast}
                    className="h-8 w-8 p-0"
                    title="تحريك للأسفل"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>

                  {/* Delete Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(image)}
                    disabled={isBusy}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="حذف الصورة"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
