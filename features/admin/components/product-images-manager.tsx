'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ImageIcon, RefreshCw, Save, Star, Trash2, Upload } from 'lucide-react';
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

interface ProductImagesManagerProps {
  productId: string;
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

export function ProductImagesManager({ productId }: ProductImagesManagerProps) {
  const { toast } = useToast();
  const [images, setImages] = useState<ProductImageRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ImageDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadAltText, setUploadAltText] = useState('');
  const [uploadSortOrder, setUploadSortOrder] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);

  const nextSortOrder = useMemo(() => {
    if (!images.length) return 10;
    return Math.max(...images.map((image) => image.sort_order)) + 10;
  }, [images]);

  const loadImages = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const result = await getAdminProductImages(token, productId);

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
  }, [productId, toast]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

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
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('alt_text', uploadAltText);
      if (uploadSortOrder.trim()) {
        formData.append('sort_order', uploadSortOrder);
      }

      const result = await uploadAdminProductImage(token, productId, formData);
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
      await loadImages();
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
      'حذف هذه الصورة نهائياً؟\n\nسيتم حذف السجل من product_images ومحاولة حذف الملف من Supabase Storage. لا يمكن التراجع عن هذا الإجراء.'
    );

    if (!confirmed) return;

    setMutatingId(image.id);
    try {
      const token = await getAccessToken();
      const result = await deleteAdminProductImage(token, image.id);

      if (!result.success) {
        throw new Error(result.error || 'تعذر حذف الصورة');
      }

      toast({ title: 'تم حذف الصورة' });
      await loadImages();
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

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">صور المنتج</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            يفضل صور مربعة 1000×1000 أو 1200×1200، بخلفية نظيفة والمنتج يملأ 70–85% من الصورة. رفع الصور محدود بـ 5MB.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadImages} disabled={isLoading}>
          <RefreshCw className="ml-2 h-4 w-4" />
          تحديث
        </Button>
      </div>

      <div className="mb-5 rounded-md border bg-muted/30 p-4">
        <div className="grid gap-4 lg:grid-cols-[128px_1.5fr_1fr_auto] lg:items-end">
          <div className="relative aspect-square overflow-hidden rounded-md border bg-background">
            {uploadPreviewUrl ? (
              // Local blob previews cannot be rendered through next/image.
              <img src={uploadPreviewUrl} alt="معاينة الصورة" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="product-image-file">صورة جديدة</Label>
            <Input
              key={fileInputKey}
              id="product-image-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {uploadFile ? 'تمت المعاينة. اضغط رفع لحفظ الصورة.' : 'اختر صورة لمعاينتها قبل الرفع.'}
            </p>
          </div>
          <div>
            <Label htmlFor="product-image-alt">Alt text</Label>
            <Input
              id="product-image-alt"
              value={uploadAltText}
              onChange={(event) => setUploadAltText(event.target.value)}
              placeholder="وصف الصورة"
            />
          </div>
          <details className="rounded-md border bg-background p-3 text-sm">
            <summary className="cursor-pointer font-medium">خيارات متقدمة</summary>
            <div className="mt-3">
              <Label htmlFor="product-image-order">الترتيب</Label>
              <Input
                id="product-image-order"
                type="number"
                min="0"
                value={uploadSortOrder}
                onChange={(event) => setUploadSortOrder(event.target.value)}
                placeholder={String(nextSortOrder)}
              />
              <p className="mt-1 text-xs text-muted-foreground">يُحسب تلقائياً: آخر ترتيب + 10.</p>
            </div>
          </details>
          <Button type="button" onClick={handleUpload} disabled={mutatingId === 'upload'}>
            <Upload className="ml-2 h-4 w-4" />
            {mutatingId === 'upload' ? 'جاري الرفع...' : 'رفع'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-56 rounded-md border bg-muted" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed px-4 py-12 text-center">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 font-semibold">لا توجد صور لهذا المنتج</h3>
          <p className="mt-1 text-sm text-muted-foreground">ارفع أول صورة وسيتم تعيينها كصورة أساسية تلقائياً.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {images.map((image) => {
            const draft = drafts[image.id] || { alt_text: '', sort_order: String(image.sort_order) };
            const isBusy = mutatingId === image.id;

            return (
              <article key={image.id} className="rounded-md border bg-background p-3">
                <div className="relative aspect-[4/3] overflow-hidden rounded-md border bg-muted">
                  <SafeImage
                    src={safeImageSrc(image.url, PLACEHOLDER_PRODUCT)}
                    fallbackSrc={PLACEHOLDER_PRODUCT}
                    alt={draft.alt_text || 'صورة المنتج'}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  {image.is_primary && (
                    <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                      أساسية
                    </span>
                  )}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_110px]">
                  <div>
                    <Label htmlFor={`alt-${image.id}`}>Alt text</Label>
                    <Input
                      id={`alt-${image.id}`}
                      value={draft.alt_text}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [image.id]: { ...draft, alt_text: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`order-${image.id}`}>الترتيب</Label>
                    <Input
                      id={`order-${image.id}`}
                      type="number"
                      min="0"
                      value={draft.sort_order}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [image.id]: { ...draft, sort_order: event.target.value },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleSaveMeta(image)} disabled={isBusy}>
                    <Save className="ml-1 h-4 w-4" />
                    حفظ
                  </Button>
                  <Button
                    type="button"
                    variant={image.is_primary ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => handleSetPrimary(image)}
                    disabled={isBusy || image.is_primary}
                  >
                    <Star className="ml-1 h-4 w-4" />
                    {image.is_primary ? 'الصورة الأساسية' : 'اجعلها أساسية'}
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => handleDelete(image)} disabled={isBusy}>
                    <Trash2 className="ml-1 h-4 w-4" />
                    حذف
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
