'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Edit, EyeOff, FolderTree, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AdminImageUploadField } from '@/features/admin/components/admin-image-upload-field';
import {
  createAdminSubcategory,
  deleteAdminSubcategory,
  getAdminSubcategories,
  toggleAdminSubcategoryActive,
  updateAdminSubcategory,
} from '@/app/actions/admin-taxonomy';
import type { CategoryRecord, SubcategoryInput, SubcategoryRecord } from '@/app/actions/admin-taxonomy';
import { PLACEHOLDER_CATEGORY, safeImageSrc } from '@/lib/image-utils';
import { normalizeSlug } from '@/lib/slug';
import { slugify } from '@/lib/product-validation';
import { supabase } from '@/lib/supabase';

const emptyForm: SubcategoryInput = {
  category_id: '',
  name: '',
  slug: '',
  slug_was_manual: false,
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

export function SubcategoriesClient() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRecord[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [form, setForm] = useState<SubcategoryInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const selectedCategoryName = useMemo(() => {
    return categories.find((category) => category.id === form.category_id)?.name || '';
  }, [categories, form.category_id]);

  const loadSubcategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const result = await getAdminSubcategories(token, {
        search,
        categoryId: categoryFilter,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر تحميل الفئات');
      }

      setCategories(result.data.categories);
      setSubcategories(result.data.subcategories);
    } catch (error) {
      toast({
        title: 'تعذر تحميل الفئات',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, search, toast]);

  useEffect(() => {
    loadSubcategories();
  }, [loadSubcategories]);

  useEffect(() => {
    if (!editingId && !slugTouched) {
      const generated = slugify(form.name);
      setForm((current) => ({
        ...current,
        slug: generated || (current.name.trim() ? `subcategory-${Date.now()}` : ''),
      }));
    }
  }, [editingId, form.name, slugTouched]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSlugTouched(false);
  }

  function startEdit(subcategory: SubcategoryRecord) {
    setEditingId(subcategory.id);
    setSlugTouched(true);
    setForm({
      category_id: subcategory.category_id,
      name: subcategory.name,
      slug: subcategory.slug,
      slug_was_manual: true,
      description: subcategory.description,
      image_url: subcategory.image_url,
      is_active: subcategory.is_active,
      sort_order: subcategory.sort_order,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const token = await getAccessToken();
      const payload: SubcategoryInput = {
        ...form,
        slug_was_manual: Boolean(editingId) || slugTouched,
        description: form.description?.trim() || null,
        image_url: form.image_url?.trim() || null,
        sort_order: Number(form.sort_order),
      };

      const result = editingId
        ? await updateAdminSubcategory(token, editingId, payload)
        : await createAdminSubcategory(token, payload);

      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ الفئة');
      }

      toast({
        title: editingId ? 'تم حفظ الفئة' : 'تمت إضافة الفئة',
        description: selectedCategoryName ? `${payload.name} - ${selectedCategoryName}` : payload.name,
      });
      resetForm();
      await loadSubcategories();
    } catch (error) {
      toast({
        title: 'تعذر حفظ الفئة',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(subcategory: SubcategoryRecord) {
    setMutatingId(subcategory.id);
    try {
      const token = await getAccessToken();
      const result = await toggleAdminSubcategoryActive(token, subcategory.id, !subcategory.is_active);

      if (!result.success) {
        throw new Error(result.error || 'تعذر تغيير حالة الفئة');
      }

      toast({
        title: subcategory.is_active ? 'تم تعطيل الفئة' : 'تم تفعيل الفئة',
        description: subcategory.name,
      });
      await loadSubcategories();
    } catch (error) {
      toast({
        title: 'تعذر تغيير حالة الفئة',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setMutatingId(null);
    }
  }

  async function handleDelete(subcategory: SubcategoryRecord) {
    const confirmed = window.confirm(
      `حذف الفئة "${subcategory.name}" نهائياً؟\n\nقد تتأثر المنتجات المرتبطة بهذه الفئة. هذا الإجراء لا يمكن التراجع عنه.`
    );

    if (!confirmed) return;

    setMutatingId(subcategory.id);
    try {
      const token = await getAccessToken();
      const result = await deleteAdminSubcategory(token, subcategory.id);

      if (!result.success) {
        throw new Error(result.error || 'تعذر حذف الفئة');
      }

      toast({ title: 'تم حذف الفئة', description: subcategory.name });
      await loadSubcategories();
    } catch (error) {
      toast({
        title: 'تعذر حذف الفئة',
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
          <h1 className="text-2xl font-bold tracking-tight">الفئات</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة الفئات الفرعية وربطها بالأقسام الرئيسية.</p>
        </div>
        <Button type="button" onClick={resetForm}>
          <Plus className="ml-2 h-4 w-4" />
          فئة جديدة
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{editingId ? 'تعديل فئة' : 'إضافة فئة'}</h2>
          {editingId && (
            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
              <X className="ml-1 h-4 w-4" />
              إلغاء التعديل
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>القسم *</Label>
            <Select
              value={form.category_id || undefined}
              onValueChange={(value) => setForm((current) => ({ ...current, category_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر القسم" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="subcategory-name">الاسم *</Label>
            <Input
              id="subcategory-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="subcategory-slug">Slug *</Label>
            <div className="flex gap-2">
              <Input
                id="subcategory-slug"
                dir="ltr"
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setForm((current) => ({ ...current, slug: normalizeSlug(event.target.value) }));
                }}
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSlugTouched(true);
                  setForm((current) => ({ ...current, slug: slugify(current.name) }));
                }}
              >
                إعادة توليد
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
              /category/category-slug?subcategory={form.slug || 'subcategory-slug'}
            </p>
          </div>
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">خيارات متقدمة</summary>
            <div className="mt-3">
              <Label htmlFor="subcategory-order">الترتيب</Label>
              <Input
                id="subcategory-order"
                type="number"
                min="0"
                value={form.sort_order}
                onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))}
              />
              {!editingId && <p className="mt-1 text-xs text-muted-foreground">يُحسب تلقائيًا داخل القسم: آخر ترتيب + 10.</p>}
            </div>
          </details>
          <div className="md:col-span-2">
            <Label htmlFor="subcategory-description">الوصف</Label>
            <Input
              id="subcategory-description"
              value={form.description || ''}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <AdminImageUploadField
              bucket="categories"
              label="صورة الفئة"
              description="يفضل صورة مربعة 800×800 بصيغة JPG/PNG/WebP، بخلفية واضحة والعنصر في المنتصف. الحد الأقصى 5MB."
              folder={`subcategories/${form.slug || 'draft'}`}
              value={form.image_url}
              onChange={(url) => setForm((current) => ({ ...current, image_url: url }))}
              disabled={isSubmitting}
              maxSizeMb={5}
            />
          </div>
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            الفئة نشطة
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={isSubmitting || categories.length === 0}>
            <Save className="ml-2 h-4 w-4" />
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ الفئة'}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pr-9"
              placeholder="بحث بالاسم أو slug"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="القسم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأقسام</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={loadSubcategories} disabled={isLoading}>
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-right font-medium">الصورة</th>
                <th className="px-4 py-3 text-right font-medium">الفئة</th>
                <th className="px-4 py-3 text-right font-medium">القسم</th>
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
                    {Array.from({ length: 7 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4">
                        <div className="h-5 rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading &&
                subcategories.map((subcategory) => (
                  <tr key={subcategory.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <img
                        src={safeImageSrc(subcategory.image_url, PLACEHOLDER_CATEGORY)}
                        alt={subcategory.name}
                        className="h-12 w-12 rounded-md border object-cover"
                        onError={(event) => {
                          event.currentTarget.src = PLACEHOLDER_CATEGORY;
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{subcategory.name}</div>
                      <div className="text-xs text-muted-foreground">{subcategory.description || 'بدون وصف'}</div>
                    </td>
                    <td className="px-4 py-3">{subcategory.category?.name || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{subcategory.slug}</td>
                    <td className="px-4 py-3">{subcategory.sort_order}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          subcategory.is_active
                            ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700'
                            : 'rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700'
                        }
                      >
                        {subcategory.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(subcategory)}>
                          <Edit className="ml-1 h-4 w-4" />
                          تعديل
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={mutatingId === subcategory.id}
                          onClick={() => handleToggle(subcategory)}
                        >
                          <EyeOff className="ml-1 h-4 w-4" />
                          {subcategory.is_active ? 'تعطيل' : 'تفعيل'}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={mutatingId === subcategory.id}
                          onClick={() => handleDelete(subcategory)}
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

        {!isLoading && subcategories.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <FolderTree className="h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">لا توجد فئات</h2>
            <p className="mt-1 text-sm text-muted-foreground">أضف أول فئة أو عدّل البحث والفلترة.</p>
          </div>
        )}
      </div>
    </div>
  );
}
