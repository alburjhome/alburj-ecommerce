'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Edit, EyeOff, ImageIcon, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SafeImage } from '@/components/ui/safe-image';
import { useToast } from '@/hooks/use-toast';
import { AdminImageUploadField } from '@/features/admin/components/admin-image-upload-field';
import {
  createAdminBanner,
  deleteAdminBanner,
  getAdminBanners,
  toggleAdminBannerActive,
  updateAdminBanner,
} from '@/app/actions/admin-banners';
import type { BannerPosition, BannerRecord } from '@/app/actions/admin-banners';
import { PLACEHOLDER_BANNER, safeImageSrc } from '@/lib/image-utils';
import { supabase } from '@/lib/supabase';

interface BannerFormState {
  title: string;
  subtitle: string;
  image_url: string;
  mobile_image_url: string;
  link_url: string;
  position: BannerPosition;
  is_active: boolean;
  sort_order: string;
  start_date: string;
  end_date: string;
}

const emptyForm: BannerFormState = {
  title: '',
  subtitle: '',
  image_url: '',
  mobile_image_url: '',
  link_url: '',
  position: 'home_hero',
  is_active: true,
  sort_order: '0',
  start_date: '',
  end_date: '',
};

const positionOptions: Array<{ value: BannerPosition; label: string }> = [
  { value: 'home_hero', label: 'الرئيسية - Hero' },
  { value: 'home_middle', label: 'الرئيسية - الوسط' },
  { value: 'home_bottom', label: 'الرئيسية - الأسفل' },
  { value: 'category_page', label: 'صفحة القسم' },
];

const linkPresetOptions: Array<{ value: string; label: string }> = [
  { label: 'بدون رابط', value: '' },
  { label: 'الرئيسية', value: '/' },
  { label: 'كل المنتجات', value: '/products' },
  { label: 'الأقسام', value: '/categories' },
  { label: 'العروض', value: '/offers' },
  { label: 'للمطاعم والكافيهات', value: '/restaurants' },
  { label: 'التغليف', value: '/packaging' },
  { label: 'البلاستيكيات', value: '/plastic-products' },
  { label: 'البيت والمطبخ', value: '/home-kitchen' },
  { label: 'المنظفات والورقيات', value: '/cleaning' },
  { label: 'الكميات والجملة', value: '/bulk' },
  { label: 'جهّز طلبك خلال دقيقة', value: '/quick-order' },
];

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

function toDateTimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formFromBanner(banner: BannerRecord): BannerFormState {
  return {
    title: banner.title,
    subtitle: banner.subtitle || '',
    image_url: banner.image_url,
    mobile_image_url: banner.mobile_image_url || '',
    link_url: banner.link_url || '',
    position: banner.position,
    is_active: banner.is_active,
    sort_order: String(banner.sort_order),
    start_date: toDateTimeLocal(banner.start_date),
    end_date: toDateTimeLocal(banner.end_date),
  };
}

function appendFormData(form: BannerFormState) {
  const formData = new FormData();
  formData.append('title', form.title);
  formData.append('subtitle', form.subtitle);
  formData.append('image_url', form.image_url);
  formData.append('mobile_image_url', form.mobile_image_url);
  formData.append('link_url', form.link_url);
  formData.append('position', form.position);
  formData.append('is_active', String(form.is_active));
  formData.append('sort_order', form.sort_order);
  formData.append('start_date', form.start_date);
  formData.append('end_date', form.end_date);
  return formData;
}

export function BannersClient() {
  const { toast } = useToast();
  const [banners, setBanners] = useState<BannerRecord[]>([]);
  const [form, setForm] = useState<BannerFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const currentLinkPresetValue = useMemo(() => {
    const value = form.link_url.trim();
    const match = linkPresetOptions.some((option) => option.value === value);
    return match ? value : '__custom__';
  }, [form.link_url]);

  const loadBanners = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const result = await getAdminBanners(token);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر تحميل البانرات');
      }

      setBanners(result.data);
    } catch (error) {
      toast({
        title: 'تعذر تحميل البانرات',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBanners();
  }, [loadBanners]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(banner: BannerRecord) {
    setEditingId(banner.id);
    setForm(formFromBanner(banner));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const token = await getAccessToken();
      const formData = appendFormData(form);
      const result = editingId
        ? await updateAdminBanner(token, editingId, formData)
        : await createAdminBanner(token, formData);

      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ البانر');
      }

      toast({
        title: editingId ? 'تم حفظ البانر' : 'تمت إضافة البانر',
        description: form.title,
      });
      resetForm();
      await loadBanners();
    } catch (error) {
      toast({
        title: 'تعذر حفظ البانر',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(banner: BannerRecord) {
    setMutatingId(banner.id);
    try {
      const token = await getAccessToken();
      const result = await toggleAdminBannerActive(token, banner.id, !banner.is_active);

      if (!result.success) {
        throw new Error(result.error || 'تعذر تغيير حالة البانر');
      }

      toast({
        title: banner.is_active ? 'تم تعطيل البانر' : 'تم تفعيل البانر',
        description: banner.title,
      });
      await loadBanners();
    } catch (error) {
      toast({
        title: 'تعذر تغيير حالة البانر',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setMutatingId(null);
    }
  }

  async function handleDelete(banner: BannerRecord) {
    const confirmed = window.confirm(
      `حذف البانر "${banner.title}" نهائياً؟\n\nسيتم حذف السجل ومحاولة حذف الصورة من Storage إذا كانت مرفوعة في bucket banners. لا يمكن التراجع عن هذا الإجراء.`
    );

    if (!confirmed) return;

    setMutatingId(banner.id);
    try {
      const token = await getAccessToken();
      const result = await deleteAdminBanner(token, banner.id);

      if (!result.success) {
        throw new Error(result.error || 'تعذر حذف البانر');
      }

      toast({ title: 'تم حذف البانر', description: banner.title });
      await loadBanners();
    } catch (error) {
      toast({
        title: 'تعذر حذف البانر',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setMutatingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">البانرات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            إدارة بانرات المتجر ومواقع ظهورها وحالة النشر.
          </p>
        </div>
        <Button type="button" onClick={resetForm}>
          <Plus className="ml-2 h-4 w-4" />
          بانر جديد
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{editingId ? 'تعديل بانر' : 'إضافة بانر'}</h2>
          {editingId && (
            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
              <X className="ml-1 h-4 w-4" />
              إلغاء التعديل
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="banner-title">العنوان *</Label>
            <Input
              id="banner-title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="banner-subtitle">العنوان الفرعي</Label>
            <Input
              id="banner-subtitle"
              value={form.subtitle}
              onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <AdminImageUploadField
              bucket="banners"
              label="صورة البانر"
              description="Hero desktop: 1920×700 أو 1600×600. اجعل النص والعنصر المهم في وسط الصورة للموبايل. النسبة المناسبة 16:6 تقريباً. الحد الأقصى 10MB."
              folder={`banners/${form.position}/${form.title || 'draft'}`}
              value={form.image_url || null}
              onChange={(url) => setForm((current) => ({ ...current, image_url: url || '' }))}
              disabled={isSubmitting}
              maxSizeMb={10}
            />
          </div>

          <div className="md:col-span-2">
            <AdminImageUploadField
              bucket="banners"
              label="صورة الموبايل"
              description="يفضل مقاس 1080×1350 أو 1080×1440. إذا تُركت فارغة سيتم استخدام صورة الديسكتوب. الحد الأقصى 10MB."
              folder={`banners/${form.position}/${form.title || 'draft'}/mobile`}
              value={form.mobile_image_url || null}
              onChange={(url) => setForm((current) => ({ ...current, mobile_image_url: url || '' }))}
              disabled={isSubmitting}
              maxSizeMb={10}
            />
          </div>
          <div>
            <Label>اختر رابطًا جاهزًا</Label>
            <Select
              value={currentLinkPresetValue}
              onValueChange={(value) => {
                if (value === '__custom__') return;
                setForm((current) => ({ ...current, link_url: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر رابطًا" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom__">رابط مخصص</SelectItem>
                {linkPresetOptions.map((option) => (
                  <SelectItem key={option.label} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">اختر رابطًا جاهزًا أو اكتب رابطًا مخصصًا يدويًا.</p>

            <div className="mt-3">
              <Label htmlFor="banner-link">أو اكتب رابطًا مخصصًا</Label>
              <Input
                id="banner-link"
                dir="ltr"
                value={form.link_url}
                onChange={(event) => setForm((current) => ({ ...current, link_url: event.target.value }))}
                placeholder="/category/cleaning-paper-personal-care أو https://wa.me/..."
              />
            </div>
          </div>
          <div>
            <Label>مكان الظهور</Label>
            <Select
              value={form.position}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, position: value as BannerPosition }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {positionOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">خيارات متقدمة</summary>
            <div className="mt-3">
              <Label htmlFor="banner-order">الترتيب</Label>
              <Input
                id="banner-order"
                type="number"
                min="0"
                value={form.sort_order}
                onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))}
              />
              {!editingId && <p className="mt-1 text-xs text-muted-foreground">يُحسب تلقائياً حسب مكان الظهور: آخر ترتيب + 10.</p>}
            </div>
          </details>
          <div>
            <Label htmlFor="banner-start">تاريخ البداية</Label>
            <Input
              id="banner-start"
              type="datetime-local"
              value={form.start_date}
              onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="banner-end">تاريخ النهاية</Label>
            <Input
              id="banner-end"
              type="datetime-local"
              value={form.end_date}
              onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            البانر نشط
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="ml-2 h-4 w-4" />
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ البانر'}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <Button type="button" variant="outline" onClick={loadBanners} disabled={isLoading}>
          <RefreshCw className="ml-2 h-4 w-4" />
          تحديث
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-right font-medium">الصورة</th>
                <th className="px-4 py-3 text-right font-medium">العنوان</th>
                <th className="px-4 py-3 text-right font-medium">الموقع</th>
                <th className="px-4 py-3 text-right font-medium">الترتيب</th>
                <th className="px-4 py-3 text-right font-medium">الفترة</th>
                <th className="px-4 py-3 text-right font-medium">الحالة</th>
                <th className="px-4 py-3 text-left font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="border-b">
                    {Array.from({ length: 7 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4">
                        <div className="h-5 rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading &&
                banners.map((banner) => (
                  <tr key={banner.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="relative h-14 w-24 overflow-hidden rounded-md border bg-muted">
                        <SafeImage
                          src={safeImageSrc(banner.image_url, PLACEHOLDER_BANNER)}
                          fallbackSrc={PLACEHOLDER_BANNER}
                          alt={banner.title}
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{banner.title}</div>
                      <div className="text-xs text-muted-foreground">{banner.subtitle || 'بدون عنوان فرعي'}</div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">{banner.link_url || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {positionOptions.find((item) => item.value === banner.position)?.label || banner.position}
                    </td>
                    <td className="px-4 py-3">{banner.sort_order}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>{banner.start_date ? new Date(banner.start_date).toLocaleString('ar-JO') : 'بدون بداية'}</div>
                      <div>{banner.end_date ? new Date(banner.end_date).toLocaleString('ar-JO') : 'بدون نهاية'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          banner.is_active
                            ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700'
                            : 'rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700'
                        }
                      >
                        {banner.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(banner)}>
                          <Edit className="ml-1 h-4 w-4" />
                          تعديل
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={mutatingId === banner.id}
                          onClick={() => handleToggle(banner)}
                        >
                          <EyeOff className="ml-1 h-4 w-4" />
                          {banner.is_active ? 'تعطيل' : 'تفعيل'}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={mutatingId === banner.id}
                          onClick={() => handleDelete(banner)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!isLoading && banners.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">لا توجد بانرات</h2>
            <p className="mt-1 text-sm text-muted-foreground">أضف أول بانر للصفحة الرئيسية أو صفحات الأقسام.</p>
          </div>
        )}
      </div>
    </div>
  );
}
