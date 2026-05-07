'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminActionClient } from '@/lib/admin-auth';
import { createReadableSlug, isValidSlug, normalizeSlug } from '@/lib/slug';

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

const optionalSlug = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine((value) => !value || isValidSlug(value), 'استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط');

const taxonomyBaseSchema = z.object({
  name: z.string().trim().min(1, 'الاسم مطلوب'),
  slug: optionalSlug,
  slug_was_manual: z.boolean().optional().default(false),
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

type AdminClient = Awaited<ReturnType<typeof createAdminActionClient>>;

function friendlyError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') return 'يجب تسجيل الدخول أولًا';
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

function normalizeCategoryInput(input: CategoryInput, slug: string, sortOrder: number) {
  return {
    name: input.name.trim(),
    slug,
    description: input.description?.trim() || null,
    image_url: input.image_url?.trim() || null,
    is_active: input.is_active,
    sort_order: sortOrder,
  };
}

function normalizeSubcategoryInput(input: SubcategoryInput, slug: string, sortOrder: number) {
  return {
    ...normalizeCategoryInput(input, slug, sortOrder),
    category_id: input.category_id,
  };
}

async function getNextSortOrder(
  adminClient: AdminClient,
  table: 'categories' | 'subcategories',
  filters: Record<string, string> = {}
) {
  let query = (adminClient.from(table) as any)
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);

  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

  const { data, error } = await query;
  if (error) throw error;

  return Number(data?.[0]?.sort_order || 0) + 10;
}

async function categorySlugExists(adminClient: AdminClient, slug: string, currentId?: string) {
  let query = (adminClient.from('categories') as any).select('id').eq('slug', slug);

  if (currentId) query = query.neq('id', currentId);

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

async function subcategorySlugExists(
  adminClient: AdminClient,
  categoryId: string,
  slug: string,
  currentId?: string
) {
  let query = (adminClient.from('subcategories') as any)
    .select('id')
    .eq('category_id', categoryId)
    .eq('slug', slug);

  if (currentId) query = query.neq('id', currentId);

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

async function uniqueCategorySlug(adminClient: AdminClient, baseSlug: string) {
  const base = normalizeSlug(baseSlug) || 'category';
  let candidate = base;
  let suffix = 2;

  while (await categorySlugExists(adminClient, candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function uniqueSubcategorySlug(adminClient: AdminClient, categoryId: string, baseSlug: string) {
  const base = normalizeSlug(baseSlug) || 'subcategory';
  let candidate = base;
  let suffix = 2;

  while (await subcategorySlugExists(adminClient, categoryId, candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function resolveCategorySlug(adminClient: AdminClient, input: CategoryInput, currentId?: string) {
  const providedSlug = normalizeSlug(input.slug || '');

  if (currentId || input.slug_was_manual) {
    if (!providedSlug || !isValidSlug(providedSlug)) {
      throw new Error('الرابط المختصر غير صالح');
    }
    if (await categorySlugExists(adminClient, providedSlug, currentId)) {
      throw new Error('يوجد قسم بنفس الرابط المختصر');
    }
    return providedSlug;
  }

  return uniqueCategorySlug(adminClient, providedSlug || createReadableSlug(input.name, 'category'));
}

async function resolveSubcategorySlug(adminClient: AdminClient, input: SubcategoryInput, currentId?: string) {
  const providedSlug = normalizeSlug(input.slug || '');

  if (currentId || input.slug_was_manual) {
    if (!providedSlug || !isValidSlug(providedSlug)) {
      throw new Error('الرابط المختصر غير صالح');
    }
    if (await subcategorySlugExists(adminClient, input.category_id, providedSlug, currentId)) {
      throw new Error('يوجد فئة بنفس الرابط المختصر داخل هذا القسم');
    }
    return providedSlug;
  }

  return uniqueSubcategorySlug(adminClient, input.category_id, providedSlug || createReadableSlug(input.name, 'subcategory'));
}

export async function getAdminCategories(
  accessToken: string | null,
  filters: TaxonomyFilters = {}
): Promise<ActionResult<CategoryRecord[]>> {
  try {
    const adminClient = await createAdminActionClient(accessToken);
    let query = (adminClient.from('categories') as any)
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

    const slug = await resolveCategorySlug(adminClient, parsed.data);
    const sortOrder = parsed.data.sort_order > 0 ? parsed.data.sort_order : await getNextSortOrder(adminClient, 'categories');
    const payload = normalizeCategoryInput(parsed.data, slug, sortOrder);

    const { data, error } = await (adminClient.from('categories') as any).insert(payload).select('id').single();
    if (error) throw error;

    revalidatePath('/');
    revalidatePath('/categories');
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

    const slug = await resolveCategorySlug(adminClient, parsed.data, categoryId);
    const payload = normalizeCategoryInput(parsed.data, slug, parsed.data.sort_order);

    const { error } = await (adminClient.from('categories') as any).update(payload).eq('id', categoryId);
    if (error) throw error;

    revalidatePath('/');
    revalidatePath('/categories');
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

    revalidatePath('/');
    revalidatePath('/categories');
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

    revalidatePath('/');
    revalidatePath('/categories');
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
      (adminClient.from('categories') as any)
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

    const slug = await resolveSubcategorySlug(adminClient, parsed.data);
    const sortOrder =
      parsed.data.sort_order > 0
        ? parsed.data.sort_order
        : await getNextSortOrder(adminClient, 'subcategories', { category_id: parsed.data.category_id });
    const payload = normalizeSubcategoryInput(parsed.data, slug, sortOrder);

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

    const slug = await resolveSubcategorySlug(adminClient, parsed.data, subcategoryId);
    const payload = normalizeSubcategoryInput(parsed.data, slug, parsed.data.sort_order);

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
