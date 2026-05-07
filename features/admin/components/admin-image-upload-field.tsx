'use client';

import { ChangeEvent, useId, useMemo, useState } from 'react';
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SafeImage } from '@/components/ui/safe-image';
import { useToast } from '@/hooks/use-toast';
import { deleteAdminImageField, uploadAdminImageField } from '@/app/actions/admin-images';
import { PLACEHOLDER_BANNER, PLACEHOLDER_CATEGORY, safeImageSrc } from '@/lib/image-utils';
import { supabase } from '@/lib/supabase';

type AdminImageBucket = 'categories' | 'banners';

interface AdminImageUploadFieldProps {
  bucket: AdminImageBucket;
  value: string | null;
  onChange: (url: string | null) => void;
  folder: string;
  label: string;
  description?: string;
  disabled?: boolean;
  maxSizeMb?: number;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

function fallbackForBucket(bucket: AdminImageBucket) {
  return bucket === 'banners' ? PLACEHOLDER_BANNER : PLACEHOLDER_CATEGORY;
}

function validateImageFile(file: File, maxSizeMb: number) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'اختر ملف صورة فقط بصيغة JPG أو PNG أو WEBP أو GIF';
  }

  if (file.size > maxSizeMb * 1024 * 1024) {
    return `حجم الصورة يجب ألا يتجاوز ${maxSizeMb}MB`;
  }

  return null;
}

export function AdminImageUploadField({
  bucket,
  value,
  onChange,
  folder,
  label,
  description,
  disabled = false,
  maxSizeMb,
}: AdminImageUploadFieldProps) {
  const { toast } = useToast();
  const inputId = useId();
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fallback = fallbackForBucket(bucket);
  const previewSrc = useMemo(() => safeImageSrc(value, fallback), [fallback, value]);
  const limit = maxSizeMb || (bucket === 'banners' ? 10 : 5);

  async function removeCurrentImage(showToast = true) {
    if (!value) {
      onChange(null);
      return true;
    }

    setIsDeleting(true);
    try {
      const token = await getAccessToken();
      const result = await deleteAdminImageField(token, { bucket, url: value });
      if (!result.success) {
        throw new Error(result.error || 'تعذر حذف الصورة');
      }

      onChange(null);
      if (showToast) {
        toast({ title: 'تم حذف الصورة' });
      }
      return true;
    } catch (error) {
      toast({
        title: 'تعذر حذف الصورة',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    const validationError = validateImageFile(file, limit);
    if (validationError) {
      toast({
        title: 'ملف غير صالح',
        description: validationError,
        variant: 'destructive',
      });
      setFileInputKey((key) => key + 1);
      return;
    }

    setIsUploading(true);
    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadAdminImageField(token, { bucket, folder }, formData);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر رفع الصورة');
      }

      const previousValue = value;
      onChange(result.data.url);
      setFileInputKey((key) => key + 1);

      if (previousValue) {
        await deleteAdminImageField(token, { bucket, url: previousValue });
      }

      toast({
        title: 'تم رفع الصورة',
        description: file.name,
      });
    } catch (error) {
      toast({
        title: 'تعذر رفع الصورة',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }

  const busy = disabled || isUploading || isDeleting;

  return (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>

      <div className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-[112px_1fr]">
        <div className="relative aspect-square overflow-hidden rounded-md border bg-background">
          {value ? (
            <SafeImage
              src={previewSrc}
              fallbackSrc={fallback}
              alt={label}
              fill
              className="object-cover"
              sizes="112px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-3">
          <div>
            <Input
              key={fileInputKey}
              id={inputId}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              disabled={busy}
              onChange={handleFileChange}
            />
            <p className="mt-2 truncate text-xs text-muted-foreground" dir="ltr">
              {value || 'لم يتم اختيار صورة'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Label
              htmlFor={busy ? undefined : inputId}
              className={
                busy
                  ? 'inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md border px-3 text-sm font-medium opacity-50'
                  : 'inline-flex h-9 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground'
              }
            >
              {isUploading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
              اختر وارفع
            </Label>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy || !value}
              onClick={() => removeCurrentImage()}
            >
              {isDeleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Trash2 className="ml-2 h-4 w-4" />}
              حذف الصورة
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
