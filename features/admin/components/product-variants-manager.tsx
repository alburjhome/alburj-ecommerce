'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Copy, Plus, Save, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  getAdminProductVariants,
  saveAdminProductVariants,
  type ProductVariantInput,
  type ProductVariantOptionInput,
} from '@/app/actions/admin-product-variants';

interface ProductVariantsManagerProps {
  productId?: string;
  basePrice: number;
  baseComparePrice: number | null;
  baseStockQuantity: number;
  baseTrackStock: boolean;
}

interface OptionDraft {
  id: string;
  name: string;
  values: Array<{ id: string; value: string }>;
}

interface VariantDraft {
  id: string;
  sku: string;
  price: number;
  compare_price: number | null;
  stock_quantity: number;
  track_stock: boolean;
  is_active: boolean;
  image_url: string;
  option_value_ids: Record<string, string>;
}

function tempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

function parseValuesText(optionId: string, text: string) {
  return text
    .split(/[,،]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => ({ id: tempId(`${optionId}-value`), value }));
}

function buildVariantLabel(option: OptionDraft, valueId: string) {
  const value = option.values.find((item) => item.id === valueId);
  return value?.value || 'غير محدد';
}

function buildCombinations(options: OptionDraft[]) {
  const validOptions = options.filter((option) => option.name.trim() && option.values.length > 0);
  if (validOptions.length === 0) return [];

  const combinations: Record<string, string>[] = [];

  function walk(index: number, current: Record<string, string>) {
    const option = validOptions[index];
    if (!option) {
      combinations.push(current);
      return;
    }

    for (const value of option.values) {
      walk(index + 1, { ...current, [option.id]: value.id });
    }
  }

  walk(0, {});
  return combinations;
}

function formatVariantLabel(options: OptionDraft[], variant: VariantDraft) {
  return options
    .map((option) => buildVariantLabel(option, variant.option_value_ids[option.id]))
    .filter(Boolean)
    .join(' - ');
}

const quickVariantTemplates = [
  { label: 'لا', options: [] },
  { label: 'نكهة', options: ['النكهة'] },
  { label: 'حجم', options: ['الحجم'] },
  { label: 'لون', options: ['اللون'] },
  { label: 'مقاس', options: ['المقاس'] },
  { label: 'نكهة + حجم', options: ['النكهة', 'الحجم'] },
];

export function ProductVariantsManager({
  productId,
  basePrice,
  baseComparePrice,
  baseStockQuantity,
  baseTrackStock,
}: ProductVariantsManagerProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(Boolean(productId));
  const [isSaving, setIsSaving] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!productId) return;

      setIsLoading(true);
      try {
        const token = await getAccessToken();
        const result = await getAdminProductVariants(token, productId);

        if (!mounted) return;
        if (!result.success || !result.data) {
          throw new Error(result.error || 'تعذر تحميل المتغيرات');
        }

        const loadedOptions: OptionDraft[] = result.data.options.map((option) => ({
          id: option.id,
          name: option.name,
          values: option.values.map((value) => ({ id: value.id, value: value.value })),
        }));

        const loadedVariants: VariantDraft[] = result.data.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku || '',
          price: Number(variant.price),
          compare_price: variant.compare_price === null ? null : Number(variant.compare_price),
          stock_quantity: variant.stock_quantity,
          track_stock: variant.track_stock,
          is_active: variant.is_active,
          image_url: variant.image_url || '',
          option_value_ids: (variant.values || []).reduce<Record<string, string>>((acc, value) => {
            acc[value.option_id] = value.option_value_id;
            return acc;
          }, {}),
        }));

        setOptions(loadedOptions);
        setVariants(loadedVariants);
        setIsEnabled(loadedOptions.length > 0 && loadedVariants.length > 0);
      } catch (error) {
        toast({
          title: 'فشل تحميل المتغيرات',
          description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
          variant: 'destructive',
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [productId, toast]);

  const allVariantsInactive = useMemo(() => {
    return isEnabled && variants.length > 0 && variants.every((variant) => !variant.is_active);
  }, [isEnabled, variants]);

  function addOption() {
    setIsEnabled(true);
    setOptions((current) => [
      ...current,
      {
        id: tempId('option'),
        name: '',
        values: [],
      },
    ]);
  }

  function applyQuickTemplate(optionNames: string[]) {
    setVariants([]);
    setIsEnabled(optionNames.length > 0);
    setOptions(
      optionNames.map((name) => ({
        id: tempId('option'),
        name,
        values: [],
      }))
    );
  }

  function updateOptionName(optionId: string, name: string) {
    setOptions((current) =>
      current.map((option) => (option.id === optionId ? { ...option, name } : option))
    );
  }

  function updateOptionValues(optionId: string, text: string) {
    setVariants([]);
    setOptions((current) =>
      current.map((option) =>
        option.id === optionId ? { ...option, values: parseValuesText(option.id, text) } : option
      )
    );
  }

  function removeOption(optionId: string) {
    setOptions((current) => current.filter((option) => option.id !== optionId));
    setVariants([]);
  }

  function generateVariants() {
    const validOptions = options.filter((option) => option.name.trim() && option.values.length > 0);
    if (validOptions.length === 0) {
      toast({
        title: 'أضف خيارًا واحدًا على الأقل',
        description: 'مثال: النكهة مع قيم مفصولة بفاصلة.',
        variant: 'destructive',
      });
      return;
    }

    const combinations = buildCombinations(validOptions);
    setVariants(
      combinations.map((combination) => ({
        id: tempId('variant'),
        sku: '',
        price: Number(basePrice) || 0,
        compare_price: baseComparePrice || null,
        stock_quantity: Number(baseStockQuantity) || 0,
        track_stock: baseTrackStock,
        is_active: true,
        image_url: '',
        option_value_ids: combination,
      }))
    );
  }

  function updateVariant(id: string, patch: Partial<VariantDraft>) {
    setVariants((current) =>
      current.map((variant) => (variant.id === id ? { ...variant, ...patch } : variant))
    );
  }

  function copyBaseToVariants() {
    setVariants((current) =>
      current.map((variant) => ({
        ...variant,
        price: Number(basePrice) || 0,
        compare_price: baseComparePrice || null,
        stock_quantity: Number(baseStockQuantity) || 0,
        track_stock: baseTrackStock,
      }))
    );
  }

  function applyBulkPrice() {
    const value = Number(bulkPrice);
    if (!Number.isFinite(value) || value < 0) return;
    setVariants((current) => current.map((variant) => ({ ...variant, price: value })));
  }

  function applyBulkStock() {
    const value = Number(bulkStock);
    if (!Number.isInteger(value) || value < 0) return;
    setVariants((current) => current.map((variant) => ({ ...variant, stock_quantity: value })));
  }

  async function handleSave() {
    if (!productId) return;

    setIsSaving(true);
    try {
      if (isEnabled && variants.length === 0) {
        throw new Error('فعّلت المتغيرات لكن لم تنشئ أي خيار قابل للبيع.');
      }
      if (isEnabled && variants.length > 0 && variants.every((variant) => !variant.is_active)) {
        throw new Error('لا يوجد أي متغير نشط، المنتج لن يكون قابلًا للبيع.');
      }
      if (variants.some((variant) => variant.is_active && Number(variant.price) <= 0)) {
        throw new Error('يوجد متغير نشط بدون سعر.');
      }
      if (
        variants.some(
          (variant) =>
            variant.is_active &&
            options.some((option) => !variant.option_value_ids[option.id])
        )
      ) {
        throw new Error('يوجد متغير نشط بدون خيار مكتمل.');
      }

      const token = await getAccessToken();
      const payload = {
        options: isEnabled
          ? options.map<ProductVariantOptionInput>((option) => ({
              id: option.id,
              name: option.name,
              values: option.values,
            }))
          : [],
        variants: isEnabled
          ? variants.map<ProductVariantInput>((variant) => ({
              id: variant.id,
              sku: variant.sku || null,
              price: Number(variant.price),
              compare_price: variant.compare_price,
              stock_quantity: Number(variant.stock_quantity),
              track_stock: variant.track_stock,
              is_active: variant.is_active,
              image_url: variant.image_url || null,
              option_value_ids: variant.option_value_ids,
            }))
          : [],
      };

      const result = await saveAdminProductVariants(token, productId, payload);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر حفظ المتغيرات');
      }

      toast({ title: 'تم حفظ متغيرات المنتج' });
      setOptions(
        result.data.options.map((option) => ({
          id: option.id,
          name: option.name,
          values: option.values.map((value) => ({ id: value.id, value: value.value })),
        }))
      );
      setVariants(
        result.data.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku || '',
          price: Number(variant.price),
          compare_price: variant.compare_price === null ? null : Number(variant.compare_price),
          stock_quantity: variant.stock_quantity,
          track_stock: variant.track_stock,
          is_active: variant.is_active,
          image_url: variant.image_url || '',
          option_value_ids: (variant.values || []).reduce<Record<string, string>>((acc, value) => {
            acc[value.option_id] = value.option_value_id;
            return acc;
          }, {}),
        }))
      );
    } catch (error) {
      toast({
        title: 'فشل حفظ المتغيرات',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (!productId) {
    return (
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Boxes className="mt-1 h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">متغيرات المنتج</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              احفظ المنتج أولًا، ثم أضف النكهات أو الأحجام أو الألوان من صفحة التعديل.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">متغيرات المنتج</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            استخدمها للمنتجات التي لها نكهة أو حجم أو لون. عند وجود متغيرات، ستُستخدم أسعارها ومخزونها في واجهة العميل.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => setIsEnabled(event.target.checked)}
          />
          تفعيل المتغيرات لهذا المنتج
        </label>
      </div>

      {isLoading ? (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">جاري تحميل المتغيرات...</div>
      ) : isEnabled ? (
        <div className="space-y-5">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            سيتم استخدام أسعار ومخزون المتغيرات بدل السعر الأساسي في واجهة العميل.
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-medium">قوالب سريعة</div>
            <div className="flex flex-wrap gap-2">
              {quickVariantTemplates.map((template) => (
                <Button
                  key={template.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyQuickTemplate(template.options)}
                >
                  {template.label}
                </Button>
              ))}
            </div>
          </div>

          {allVariantsInactive && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>هذا المنتج يحتوي متغيرات، لكن لا يوجد أي متغير نشط قابل للبيع.</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">الخيارات</h3>
              <Button type="button" variant="outline" size="sm" onClick={addOption}>
                <Plus className="ml-2 h-4 w-4" />
                إضافة خيار
              </Button>
            </div>

            {options.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                أضف خيارًا مثل النكهة أو الحجم، ثم اكتب القيم مفصولة بفاصلة.
              </div>
            ) : (
              <div className="space-y-3">
                {options.map((option) => (
                  <div key={option.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[180px_1fr_auto]">
                    <div>
                      <Label>اسم الخيار</Label>
                      <Input
                        value={option.name}
                        onChange={(event) => updateOptionName(option.id, event.target.value)}
                        placeholder="النكهة"
                      />
                    </div>
                    <div>
                      <Label>القيم مفصولة بفاصلة</Label>
                      <Input
                        value={option.values.map((value) => value.value).join('، ')}
                        onChange={(event) => updateOptionValues(option.id, event.target.value)}
                        placeholder="ليمون، ورد، تفاح"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="outline" size="icon" onClick={() => removeOption(option.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button type="button" variant="outline" onClick={generateVariants}>
              <Wand2 className="ml-2 h-4 w-4" />
              توليد المتغيرات
            </Button>
          </div>

          {variants.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 lg:flex-row lg:items-end">
                <Button type="button" variant="outline" onClick={copyBaseToVariants}>
                  <Copy className="ml-2 h-4 w-4" />
                  نسخ السعر والمخزون من المنتج الأساسي
                </Button>
                <div className="flex items-end gap-2">
                  <div>
                    <Label>تطبيق سعر</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bulkPrice}
                      onChange={(event) => setBulkPrice(event.target.value)}
                      className="w-28"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={applyBulkPrice}>
                    تطبيق
                  </Button>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <Label>تطبيق مخزون</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={bulkStock}
                      onChange={(event) => setBulkStock(event.target.value)}
                      className="w-28"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={applyBulkStock}>
                    تطبيق
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-right">المتغير</th>
                      <th className="px-3 py-2 text-right">SKU</th>
                      <th className="px-3 py-2 text-right">السعر</th>
                      <th className="px-3 py-2 text-right">قبل الخصم</th>
                      <th className="px-3 py-2 text-right">المخزون</th>
                      <th className="px-3 py-2 text-right">نشط</th>
                      <th className="px-3 py-2 text-right">صورة اختيارية</th>
                      <th className="px-3 py-2 text-right">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((variant) => (
                      <tr key={variant.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{formatVariantLabel(options, variant)}</td>
                        <td className="px-3 py-2">
                          <Input
                            value={variant.sku}
                            onChange={(event) => updateVariant(variant.id, { sku: event.target.value })}
                            className="w-32"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={variant.price}
                            onChange={(event) => updateVariant(variant.id, { price: Number(event.target.value) })}
                            className="w-28"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={variant.compare_price ?? ''}
                            onChange={(event) =>
                              updateVariant(variant.id, {
                                compare_price: event.target.value ? Number(event.target.value) : null,
                              })
                            }
                            className="w-28"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={variant.stock_quantity}
                            onChange={(event) =>
                              updateVariant(variant.id, { stock_quantity: Number(event.target.value) })
                            }
                            className="w-24"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={variant.is_active}
                            onChange={(event) => updateVariant(variant.id, { is_active: event.target.checked })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={variant.image_url}
                            onChange={(event) => updateVariant(variant.id, { image_url: event.target.value })}
                            placeholder="اختياري"
                            className="w-48"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              setVariants((current) => current.filter((item) => item.id !== variant.id))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end border-t pt-4">
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              <Save className="ml-2 h-4 w-4" />
              {isSaving ? 'جاري الحفظ...' : 'حفظ متغيرات المنتج'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          المتغيرات غير مفعّلة لهذا المنتج. المنتجات الحالية بدون متغيرات ستبقى تعمل بنفس السلوك القديم.
        </div>
      )}
    </section>
  );
}
