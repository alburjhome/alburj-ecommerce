'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Edit, EyeOff, FolderOpen, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AdminImageUploadField } from '@/features/admin/components/admin-image-upload-field';
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategories,
  toggleAdminCategoryActive,
  updateAdminCategory,
} from '@/app/actions/admin-taxonomy';
import type { CategoryInput, CategoryRecord } from '@/app/actions/admin-taxonomy';
import { PLACEHOLDER_CATEGORY, safeImageSrc } from '@/lib/image-utils';
import { slugify } from '@/lib/product-validation';
import { supabase } from '@/lib/supabase';

const emptyForm: CategoryInput = {
  name: '',
  slug: '',
  description: null,
  image_url: null,
  is_active: true,
  sort_order: 0,
};

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

export function CategoriesClient() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<CategoryInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const result = await getAdminCategories(token, { search });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر تحميل الأقسام');
      }

      setCategories(result.data);
    } catch (error) {
      toast({
        title: 'تعذر تحميل الأقسام',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!editingId && !slugTouched) {
      const generated = slugify(form.name);
      setForm((current) => ({
        ...current,
        slug: generated || (current.name.trim() ? `category-${Date.now()}` : ''),
      }));
    }
  }, [editingId, form.name, slugTouched]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSlugTouched(false);
  }

  function startEdit(category: CategoryRecord) {
    setEditingId(category.id);
    setSlugTouched(true);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description,
      image_url: category.image_url,
      is_active: category.is_active,
      sort_order: category.sort_order,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const token = await getAccessToken();
      const payload: CategoryInput = {
        ...form,
        description: form.description?.trim() || null,
        image_url: form.image_url?.trim() || null,
        sort_order: Number(form.sort_order),
      };

      const result = editingId
        ? await updateAdminCategory(token, editingId, payload)
        : await createAdminCategory(token, payload);

      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ القسم');
      }

      toast({
        title: editingId ? 'تم حفظ القسم' : 'تمت إضافة القسم',
        description: payload.name,
      });
      resetForm();
      await loadCategories();
    } catch (error) {
      toast({
        title: 'تعذر حفظ القسم',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(category: CategoryRecord) {
    setMutatingId(category.id);
    try {
      const token = await getAccessToken();
      const result = await toggleAdminCategoryActive(token, category.id, !category.is_active);

      if (!result.success) {
        throw new Error(result.error || 'تعذر تغيير حالة القسم');
      }

      toast({
        title: category.is_active ? 'تم تعطيل القسم' : 'تم تفعيل القسم',
        description: category.name,
      });
      await loadCategories();
    } catch (error) {
      toast({
        title: 'تعذر تغيير حالة القسم',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setMutatingId(null);
    }
  }

  async function handleDelete(category: CategoryRecord) {
    const confirmed = window.confirm(
      `حذف القسم "${category.name}" نهائياً؟\n\nسيتم حذف الفئات التابعة له، وقد تتأثر المنتجات المرتبطة به. هذا الإجراء لا يمكن التراجع عنه.`
    );

    if (!confirmed) return;

    setMutatingId(category.id);
    try {
      const token = await getAccessToken();
      const result = await deleteAdminCategory(token, category.id);

      if (!result.success) {
        throw new Error(result.error || 'تعذر حذف القسم');
      }

      toast({ title: 'تم حذف القسم', description: category.name });
      await loadCategories();
    } catch (error) {
      toast({
        title: 'تعذر حذف القسم',
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
          <h1 className="text-2xl font-bold tracking-tight">الأقسام</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة أقسام المتجر الرئيسية وترتيب ظهورها.</p>
        </div>
        <Button type="button" onClick={resetForm}>
          <Plus className="ml-2 h-4 w-4" />
          قسم جديد
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{editingId ? 'تعديل قسم' : 'إضافة قسم'}</h2>
          {editingId && (
            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
              <X className="ml-1 h-4 w-4" />
              إلغاء التعديل
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="category-name">الاسم *</Label>
            <Input
              id="category-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="category-slug">Slug *</Label>
            <Input
              id="category-slug"
              dir="ltr"
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                setForm((current) => ({ ...current, slug: event.target.value }));
              }}
              required
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="category-description">الوصف</Label>
            <Input
              id="category-description"
              value={form.description || ''}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <AdminImageUploadField
              bucket="categories"
              label="صورة القسم"
              description="ارفع صورة من جهازك وسيتم حفظ الرابط تلقائياً في القسم."
              folder={`categories/${form.slug || 'draft'}`}
              value={form.image_url}
              onChange={(url) => setForm((current) => ({ ...current, image_url: url }))}
              disabled={isSubmitting}
              maxSizeMb={5}
            />
          </div>
          <div>
            <Label htmlFor="category-order">الترتيب</Label>
            <Input
              id="category-order"
              type="number"
              min="0"
              value={form.sort_order}
              onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))}
            />
          </div>
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            القسم نشط
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="ml-2 h-4 w-4" />
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ القسم'}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pr-9"
              placeholder="بحث بالاسم أو slug"
            />
          </div>
          <Button type="button" variant="outline" onClick={loadCategories} disabled={isLoading}>
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-right font-medium">الصورة</th>
                <th className="px-4 py-3 text-right font-medium">الاسم</th>
                <th className="px-4 py-3 text-right font-medium">Slug</th>
                <th className="px-4 py-3 text-right font-medium">الترتيب</th>
                <th className="px-4 py-3 text-right font-medium">الحالة</th>
                <th className="px-4 py-3 text-left font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="border-b">
                    {Array.from({ length: 6 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4">
                        <div className="h-5 rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading &&
                categories.map((category) => (
                  <tr key={category.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <img
                        src={safeImageSrc(category.image_url, PLACEHOLDER_CATEGORY)}
                        alt={category.name}
                        className="h-12 w-12 rounded-md border object-cover"
                        onError={(event) => {
                          event.currentTarget.src = PLACEHOLDER_CATEGORY;
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{category.name}</div>
                      <div className="text-xs text-muted-foreground">{category.description || 'بدون وصف'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{category.slug}</td>
                    <td className="px-4 py-3">{category.sort_order}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          category.is_active
                            ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700'
                            : 'rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700'
                        }
                      >
                        {category.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(category)}>
                          <Edit className="ml-1 h-4 w-4" />
                          تعديل
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={mutatingId === category.id}
                          onClick={() => handleToggle(category)}
                        >
                          <EyeOff className="ml-1 h-4 w-4" />
                          {category.is_active ? 'تعطيل' : 'تفعيل'}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={mutatingId === category.id}
                          onClick={() => handleDelete(category)}
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

        {!isLoading && categories.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">لا توجد أقسام</h2>
            <p className="mt-1 text-sm text-muted-foreground">أضف أول قسم أو عدّل عبارة البحث.</p>
          </div>
        )}
      </div>
    </div>
  );
}
