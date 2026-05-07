'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminActionClient } from '@/lib/admin-auth';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SubcategoryRecord {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category: {
    id: string;
    name: string;
  } | null;
}

export interface TaxonomyFilters {
  search?: string;
  categoryId?: string;
}

const nullableText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().nullable()
);

const taxonomyBaseSchema = z.object({
  name: z.string().trim().min(1, 'الاسم مطلوب'),
  slug: z
    .string()
    .trim()
    .min(1, 'الرابط المختصر مطلوب')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'استخدم أحرفاً إنجليزية صغيرة وأرقاماً وشرطات فقط'),
  description: nullableText,
  image_url: nullableText,
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0, 'الترتيب يجب ألا يقل عن صفر'),
});

const categorySchema = taxonomyBaseSchema;
const subcategorySchema = taxonomyBaseSchema.extend({
  category_id: z.string().uuid('القسم مطلوب'),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type SubcategoryInput = z.infer<typeof subcategorySchema>;

function friendlyError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') return 'يجب تسجيل الدخول أولاً';
    if (error.message === 'FORBIDDEN') return 'ليس لديك صلاحية تنفيذ هذه العملية';
    if (error.message.includes('duplicate key') || error.message.includes('unique')) {
      return 'يوجد عنصر بنفس الرابط المختصر';
    }
    return error.message;
  }

  return 'حدث خطأ غير متوقع';
}

function logTaxonomyError(action: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') return;

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[admin-taxonomy:${action}] ${message}`);
}

function normalizeCategoryInput(input: CategoryInput) {
  return {
    name: input.name.trim(),
    slug: input.slug.trim(),
    description: input.description?.trim() || null,
    image_url: input.image_url?.trim() || null,
    is_active: input.is_active,
    sort_order: input.sort_order,
  };
}

function normalizeSubcategoryInput(input: SubcategoryInput) {
  return {
    ...normalizeCategoryInput(input),
    category_id: input.category_id,
  };
}

async function assertUniqueCategorySlug(
  accessToken: string | null | undefined,
  slug: string,
  currentId?: string
) {
  const adminClient = await createAdminActionClient(accessToken);
  let query = (adminClient.from('categories') as any).select('id').eq('slug', slug);

  if (currentId) {
    query = query.neq('id', currentId);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;
  if (data?.length) throw new Error('يوجد قسم بنفس الرابط المختصر');
}

async function assertUniqueSubcategorySlug(
  accessToken: string | null | undefined,
  categoryId: string,
  slug: string,
  currentId?: string
) {
  const adminClient = await createAdminActionClient(accessToken);
  let query = (adminClient
    .from('subcategories') as any)
    .select('id')
    .eq('category_id', categoryId)
    .eq('slug', slug);

  if (currentId) {
    query = query.neq('id', currentId);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;
  if (data?.length) throw new Error('يوجد فئة بنفس الرابط المختصر داخل هذا القسم');
}

export async function getAdminCategories(
  accessToken: string | null,
  filters: TaxonomyFilters = {}
): Promise<ActionResult<CategoryRecord[]>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    let query = (adminClient
      .from('categories') as any)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    const search = filters.search?.trim();
    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, data: (data || []) as CategoryRecord[] };
  } catch (error) {
    logTaxonomyError('getAdminCategories', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function createAdminCategory(
  accessToken: string | null,
  input: CategoryInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const parsed = categorySchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: 'تحقق من الحقول المطلوبة',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const payload = normalizeCategoryInput(parsed.data);
    await assertUniqueCategorySlug(accessToken, payload.slug);

    const { data, error } = await (adminClient.from('categories') as any).insert(payload).select('id').single();
    if (error) throw error;

    revalidatePath('/admin/categories');
    revalidatePath('/admin/products');
    return { success: true, data: data ? { id: data.id } : undefined };
  } catch (error) {
    logTaxonomyError('createAdminCategory', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function updateAdminCategory(
  accessToken: string | null,
  categoryId: string,
  input: CategoryInput
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const parsed = categorySchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: 'تحقق من الحقول المطلوبة',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const payload = normalizeCategoryInput(parsed.data);
    await assertUniqueCategorySlug(accessToken, payload.slug, categoryId);

    const { error } = await (adminClient.from('categories') as any).update(payload).eq('id', categoryId);
    if (error) throw error;

    revalidatePath('/admin/categories');
    revalidatePath('/admin/subcategories');
    revalidatePath('/admin/products');
    return { success: true };
  } catch (error) {
    logTaxonomyError('updateAdminCategory', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function toggleAdminCategoryActive(
  accessToken: string | null,
  categoryId: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const { error } = await (adminClient.from('categories') as any).update({ is_active: isActive }).eq('id', categoryId);
    if (error) throw error;

    revalidatePath('/admin/categories');
    revalidatePath('/admin/subcategories');
    return { success: true };
  } catch (error) {
    logTaxonomyError('toggleAdminCategoryActive', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function deleteAdminCategory(accessToken: string | null, categoryId: string): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const { error } = await (adminClient.from('categories') as any).delete().eq('id', categoryId);
    if (error) throw error;

    revalidatePath('/admin/categories');
    revalidatePath('/admin/subcategories');
    revalidatePath('/admin/products');
    return { success: true };
  } catch (error) {
    logTaxonomyError('deleteAdminCategory', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function getAdminSubcategories(
  accessToken: string | null,
  filters: TaxonomyFilters = {}
): Promise<ActionResult<{ categories: CategoryRecord[]; subcategories: SubcategoryRecord[] }>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const [categoriesResult, subcategoriesResult] = await Promise.all([
      (adminClient
        .from('categories') as any)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false }),
      (adminClient.from('subcategories') as any)
        .select('*, category:categories(id, name)')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false }),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (subcategoriesResult.error) throw subcategoriesResult.error;

    let subcategories = (subcategoriesResult.data || []) as SubcategoryRecord[];
    const search = filters.search?.trim().toLowerCase();

    if (filters.categoryId && filters.categoryId !== 'all') {
      subcategories = subcategories.filter((subcategory) => subcategory.category_id === filters.categoryId);
    }

    if (search) {
      subcategories = subcategories.filter(
        (subcategory) =>
          subcategory.name.toLowerCase().includes(search) ||
          subcategory.slug.toLowerCase().includes(search)
      );
    }

    return {
      success: true,
      data: {
        categories: (categoriesResult.data || []) as CategoryRecord[],
        subcategories,
      },
    };
  } catch (error) {
    logTaxonomyError('getAdminSubcategories', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function createAdminSubcategory(
  accessToken: string | null,
  input: SubcategoryInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const parsed = subcategorySchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: 'تحقق من الحقول المطلوبة',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const payload = normalizeSubcategoryInput(parsed.data);
    await assertUniqueSubcategorySlug(accessToken, payload.category_id, payload.slug);

    const { data, error } = await (adminClient.from('subcategories') as any).insert(payload).select('id').single();
    if (error) throw error;

    revalidatePath('/admin/subcategories');
    revalidatePath('/admin/products');
    return { success: true, data: data ? { id: data.id } : undefined };
  } catch (error) {
    logTaxonomyError('createAdminSubcategory', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function updateAdminSubcategory(
  accessToken: string | null,
  subcategoryId: string,
  input: SubcategoryInput
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const parsed = subcategorySchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: 'تحقق من الحقول المطلوبة',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const payload = normalizeSubcategoryInput(parsed.data);
    await assertUniqueSubcategorySlug(accessToken, payload.category_id, payload.slug, subcategoryId);

    const { error } = await (adminClient.from('subcategories') as any).update(payload).eq('id', subcategoryId);
    if (error) throw error;

    revalidatePath('/admin/subcategories');
    revalidatePath('/admin/products');
    return { success: true };
  } catch (error) {
    logTaxonomyError('updateAdminSubcategory', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function toggleAdminSubcategoryActive(
  accessToken: string | null,
  subcategoryId: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const { error } = await (adminClient.from('subcategories') as any).update({ is_active: isActive }).eq('id', subcategoryId);
    if (error) throw error;

    revalidatePath('/admin/subcategories');
    return { success: true };
  } catch (error) {
    logTaxonomyError('toggleAdminSubcategoryActive', error);
    return { success: false, error: friendlyError(error) };
  }
}

export async function deleteAdminSubcategory(accessToken: string | null, subcategoryId: string): Promise<ActionResult> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    const { error } = await (adminClient.from('subcategories') as any).delete().eq('id', subcategoryId);
    if (error) throw error;

    revalidatePath('/admin/subcategories');
    revalidatePath('/admin/products');
    return { success: true };
  } catch (error) {
    logTaxonomyError('deleteAdminSubcategory', error);
    return { success: false, error: friendlyError(error) };
  }
}
