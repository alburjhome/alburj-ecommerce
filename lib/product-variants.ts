import type {
  ProductOption,
  ProductVariant,
  ProductVariantValue,
  ProductWithDetails,
} from '@/types';

export type SelectedVariantOptions = Record<string, string>;

export function sortProductOptions(options: ProductOption[] = []) {
  return [...options].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name, 'ar');
  });
}

export function sortOptionValues(values: ProductOption['values'] = []) {
  return [...values].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.value.localeCompare(b.value, 'ar');
  });
}

export function sortProductVariants(variants: ProductVariant[] = []) {
  return [...variants].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name, 'ar');
  });
}

export function variantOptionsToLabel(options: SelectedVariantOptions | null | undefined) {
  if (!options || Object.keys(options).length === 0) return null;
  return Object.entries(options)
    .map(([name, value]) => `${name}: ${value}`)
    .join('، ');
}

export function getVariantSelectedOptions(variant: ProductVariant): SelectedVariantOptions {
  const structuredValues = variant.values || [];
  if (structuredValues.length > 0) {
    return structuredValues.reduce<SelectedVariantOptions>((acc, value) => {
      const optionName = value.option?.name;
      const optionValue = value.option_value?.value;
      if (optionName && optionValue) {
        acc[optionName] = optionValue;
      }
      return acc;
    }, {});
  }

  return variant.options || {};
}

export function getVariantLabel(variant: ProductVariant) {
  return variantOptionsToLabel(getVariantSelectedOptions(variant)) || variant.name;
}

export function productHasActiveVariants(product: Pick<ProductWithDetails, 'variants'>) {
  return (product.variants || []).some((variant) => variant.is_active);
}

export function isVariantInStock(variant: Pick<ProductVariant, 'track_stock' | 'stock_quantity'>) {
  if (!variant.track_stock) return true;
  return (variant.stock_quantity ?? 0) > 0;
}

export function getVariantValueIds(variant: ProductVariant) {
  return new Map((variant.values || []).map((value) => [value.option_id, value.option_value_id]));
}

export function findMatchingVariant(
  variants: ProductVariant[],
  selectedValueIds: Record<string, string>
) {
  const selectedEntries = Object.entries(selectedValueIds).filter(([, valueId]) => Boolean(valueId));
  if (selectedEntries.length === 0) return null;

  return (
    variants.find((variant) => {
      if (!variant.is_active) return false;
      const values = getVariantValueIds(variant);
      return selectedEntries.every(
        ([optionId, valueId]) => values.get(optionId) === valueId
      );
    }) || null
  );
}

export function isOptionValueAvailable(
  variants: ProductVariant[],
  selectedValueIds: Record<string, string>,
  optionId: string,
  valueId: string
) {
  const nextSelection = {
    ...selectedValueIds,
    [optionId]: valueId,
  };

  return variants.some((variant) => {
    if (!variant.is_active) return false;
    const values = getVariantValueIds(variant);
    return Object.entries(nextSelection)
      .filter(([, selectedValueId]) => Boolean(selectedValueId))
      .every(([selectedOptionId, selectedValueId]) => {
        return values.get(selectedOptionId) === selectedValueId;
      });
  });
}

export function getProductBaseStock(product: Pick<ProductWithDetails, 'track_stock' | 'allow_backorders' | 'stock_quantity'>) {
  if (!product.track_stock || product.allow_backorders) return Number.MAX_SAFE_INTEGER;
  return product.stock_quantity ?? 0;
}

export function getVariantCartStock(variant: ProductVariant) {
  if (!variant.track_stock) return Number.MAX_SAFE_INTEGER;
  return variant.stock_quantity ?? 0;
}
