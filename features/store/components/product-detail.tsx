'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Check,
  CreditCard,
  MessageCircle,
  Minus,
  Plus,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { ProductWithDetails } from '@/types';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PLACEHOLDER_PRODUCT, safeImageSrc } from '@/lib/image-utils';
import { calculateDiscountPercentage, formatPrice } from '@/lib/utils';
import useCartStore from '@/stores/cart';
import { getWhatsAppLink } from '@/lib/store-settings';
import { useToast } from '@/hooks/use-toast';
import {
  getProductSuitableForTags,
  INTENT_TAG_CONFIG,
  type ProductIntentKey,
} from '@/lib/product-intents';
import { trackWhatsAppClick } from '@/lib/analytics';
import {
  findMatchingVariant,
  getVariantCartStock,
  getVariantLabel,
  getVariantSelectedOptions,
  isOptionValueAvailable,
  isVariantInStock,
  sortOptionValues,
  sortProductOptions,
  sortProductVariants,
} from '@/lib/product-variants';
import { CartToastActions } from './cart-toast-actions';

interface ProductDetailProps {
  product: ProductWithDetails;
  whatsappNumber?: string | null;
}

export function ProductDetail({ product, whatsappNumber }: ProductDetailProps) {
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const rehydrate = useCartStore((state) => state.rehydrate);
  const { toast } = useToast();

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string>>({});
  const [productUrl, setProductUrl] = useState('');
  const [isVariantSheetOpen, setIsVariantSheetOpen] = useState(false);

  useEffect(() => {
    if (!hasHydrated && rehydrate) {
      rehydrate();
    }
  }, [hasHydrated, rehydrate]);

  useEffect(() => {
    setProductUrl(window.location.href);
  }, [product.slug]);

  const images = useMemo(() => {
    const sortedImages = [...(product.images || [])].sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.sort_order - b.sort_order;
    });

    return sortedImages.length
      ? sortedImages
      : [
          {
            id: 'placeholder',
            product_id: product.id,
            url: PLACEHOLDER_PRODUCT,
            alt_text: product.name,
            sort_order: 0,
            is_primary: true,
            created_at: '',
          },
        ];
  }, [product.id, product.images, product.name]);

  const options = useMemo(() => {
    return sortProductOptions(product.options || []).map((option) => ({
      ...option,
      values: sortOptionValues(option.values || []),
    }));
  }, [product.options]);

  const activeVariants = useMemo(() => {
    return sortProductVariants(product.variants || []).filter((variant) => variant.is_active);
  }, [product.variants]);

  const hasVariants = options.length > 0 && activeVariants.length > 0;
  const isSelectionComplete = !hasVariants || options.every((option) => Boolean(selectedOptionIds[option.id]));
  const selectedVariant =
    hasVariants && isSelectionComplete
      ? findMatchingVariant(activeVariants, selectedOptionIds)
      : null;
  const selectedVariantOptions = selectedVariant ? getVariantSelectedOptions(selectedVariant) : null;
  const selectedVariantLabel = selectedVariant ? getVariantLabel(selectedVariant) : null;

  const currentImage = images[selectedImage] || images[0];
  const displayPrice = selectedVariant ? selectedVariant.price : product.price;
  const displayComparePrice = selectedVariant ? selectedVariant.compare_price : product.compare_price;
  const displayStockQuantity = selectedVariant ? selectedVariant.stock_quantity : product.stock_quantity;
  const displayTrackStock = selectedVariant ? selectedVariant.track_stock : product.track_stock;
  const displaySku = selectedVariant?.sku || product.sku;
  const imageSrc = safeImageSrc(selectedVariant?.image_url || currentImage?.url, PLACEHOLDER_PRODUCT);
  const hasDiscount = Boolean(displayComparePrice && displayComparePrice > displayPrice);
  const discount = hasDiscount
    ? calculateDiscountPercentage(displayPrice, displayComparePrice || displayPrice)
    : 0;

  const maxQuantity = hasVariants
    ? selectedVariant
      ? Math.min(getVariantCartStock(selectedVariant), 99)
      : 99
    : product.track_stock && !product.allow_backorders
      ? product.stock_quantity
      : 99;
  const variantIsUnavailable = Boolean(selectedVariant && !isVariantInStock(selectedVariant));
  const isUnavailable = hasVariants
    ? Boolean(isSelectionComplete && (!selectedVariant || variantIsUnavailable))
    : Boolean(product.track_stock && !product.allow_backorders && product.stock_quantity <= 0);
  const canSubmitAddToCart = hasHydrated;

  useEffect(() => {
    setQuantity((value) => Math.min(Math.max(1, value), Math.max(1, maxQuantity)));
  }, [maxQuantity]);

  function handleSelectOption(optionId: string, valueId: string) {
    setSelectedOptionIds((current) => ({
      ...current,
      [optionId]: current[optionId] === valueId ? '' : valueId,
    }));
  }

  function getOptionValueState(optionId: string, valueId: string) {
    const nextSelection = {
      ...selectedOptionIds,
      [optionId]: valueId,
    };
    const matchingVariants = activeVariants.filter((variant) => {
      const values = new Map((variant.values || []).map((value) => [value.option_id, value.option_value_id]));
      return Object.entries(nextSelection)
        .filter(([, selectedValueId]) => Boolean(selectedValueId))
        .every(([selectedOptionId, selectedValueId]) => values.get(selectedOptionId) === selectedValueId);
    });

    return {
      hasMatchingVariant: matchingVariants.length > 0,
      hasInStockVariant: matchingVariants.some((variant) => isVariantInStock(variant)),
      isAvailable: isOptionValueAvailable(activeVariants, selectedOptionIds, optionId, valueId),
    };
  }

  function getAddToCartBlockMessage() {
    if (!hasHydrated) return 'يرجى الانتظار لحظة ثم حاول مرة أخرى.';

    if (hasVariants && !isSelectionComplete) {
      if (missingOptions.length === 1) {
        return `يرجى اختيار ${missingOptions[0]} أولًا`;
      }
      return 'يرجى اختيار جميع الخيارات قبل إضافة المنتج للسلة';
    }

    if (hasVariants && (!selectedVariant || variantIsUnavailable)) {
      return 'هذا الخيار غير متوفر حاليًا';
    }

    if (!hasVariants && isUnavailable) {
      return 'هذا المنتج غير متوفر حاليًا';
    }

    if (maxQuantity <= 0) {
      return 'هذا الخيار غير متوفر حاليًا';
    }

    return null;
  }

  function handleAddToCart() {
    const blockMessage = getAddToCartBlockMessage();

    if (blockMessage) {
      if (hasVariants) {
        setIsVariantSheetOpen(true);
        return;
      }
      toast({
        title: blockMessage,
        variant: 'destructive',
      });
      return;
    }

    addItem({
      product_id: product.id,
      variant_id: selectedVariant?.id || null,
      name: product.name,
      price: displayPrice,
      quantity,
      image: imageSrc,
      variant_name: selectedVariantLabel,
      variant_label: selectedVariantLabel,
      selected_options: selectedVariantOptions,
      sku: displaySku,
      stock_quantity: selectedVariant ? getVariantCartStock(selectedVariant) : maxQuantity,
    });
    setIsVariantSheetOpen(false);
    toast({
      title: 'تمت إضافة المنتج للسلة',
      description: <CartToastActions onViewCart={openCart} />,
    });
  }

  const variantLines = selectedVariantOptions
    ? `\n${Object.entries(selectedVariantOptions)
        .map(([name, value]) => `${name}: ${value}`)
        .join('\n')}`
    : '';
  const inquiryText = `مرحبا، أريد الاستفسار عن المنتج:\n${product.name}${variantLines}\nالسعر: ${formatPrice(displayPrice)}\nالرابط: ${productUrl}`;
  const orderText = `مرحبا، أريد طلب:\n${product.name}${variantLines}\nالكمية: ${quantity}\nالسعر: ${formatPrice(displayPrice)}\nالرابط: ${productUrl}`;
  const inquiryUrl = useMemo(() => {
    const base = getWhatsAppLink(whatsappNumber);
    if (!base) return null;
    return `${base}?text=${encodeURIComponent(inquiryText)}`;
  }, [inquiryText, whatsappNumber]);

  const orderUrl = useMemo(() => {
    const base = getWhatsAppLink(whatsappNumber);
    if (!base) return null;
    return `${base}?text=${encodeURIComponent(orderText)}`;
  }, [orderText, whatsappNumber]);

  const whatsappUrl = orderUrl || inquiryUrl;

  const normalizeForSimilarity = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[\u064B-\u065F]/g, '')
      .replace(/[\.\,\!\?\:\;\-\_\(\)\[\]\{\}\"\'\<\>\|\+\=\*\/\\%\$\#\@\^\&\~\`\u060C\u061B\u061F\u2026]/g, '')
      .trim();

  const isDescriptionTooSimilar = useMemo(() => {
    if (!product.short_description || !product.description) return false;
    const a = normalizeForSimilarity(product.short_description);
    const b = normalizeForSimilarity(product.description);
    if (!a || !b) return false;
    if (a === b) return true;
    const aTokens = new Set(a.split(' ').filter(Boolean));
    const bTokens = new Set(b.split(' ').filter(Boolean));
    if (aTokens.size < 6 || bTokens.size < 6) return false;
    let intersection = 0;
    aTokens.forEach((t) => {
      if (bTokens.has(t)) intersection += 1;
    });
    const similarity = intersection / Math.max(1, Math.min(aTokens.size, bTokens.size));
    return similarity >= 0.8;
  }, [product.description, product.short_description]);

  const shouldShowFullDescription = Boolean(product.description) && !isDescriptionTooSimilar;

  const suitableForTags = (() => {
    const tags = getProductSuitableForTags(product);
    const order: ProductIntentKey[] = [
      'home',
      'kitchen',
      'plastics',
      'restaurants',
      'shops',
      'cleaning',
      'packaging',
      'bulk',
      'appliances',
      'furnishings',
    ];
    return order.filter((key) => tags.includes(key)).slice(0, 6);
  })();

  const missingOptions = hasVariants
    ? options.filter((option) => !selectedOptionIds[option.id]).map((option) => option.name)
    : [];

  const stockLabel = (() => {
    if (hasVariants && !isSelectionComplete) {
      return { tone: 'amber', text: `حدد ${missingOptions.join(' و ')} لمعرفة التوفر` };
    }
    if (isUnavailable) {
      return { tone: 'red', text: 'غير متوفر حاليًا' };
    }
    if (!displayTrackStock) {
      return { tone: 'green', text: 'متوفر' };
    }
    if (displayStockQuantity <= 5) {
      return { tone: 'amber', text: `كمية محدودة (${displayStockQuantity} قطعة)` };
    }
    return { tone: 'green', text: `متوفر في المخزون (${displayStockQuantity} قطعة)` };
  })();

  const stockBadgeClass =
    stockLabel.tone === 'green'
      ? 'border-green-200 bg-green-50 text-green-700'
      : stockLabel.tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-red-200 bg-red-50 text-red-700';

  const stockDotClass =
    stockLabel.tone === 'green'
      ? 'bg-green-500'
      : stockLabel.tone === 'amber'
        ? 'bg-amber-500'
        : 'bg-red-500';

  function renderVariantOptions({ showMissingMessage = false } = {}) {
    if (!hasVariants) return null;

    return (
      <div className="space-y-3">
        {options.map((option) => (
          <div key={option.id} className="space-y-2">
            <div className="text-sm font-semibold">{option.name}</div>
            <div className="flex flex-wrap gap-2">
              {(option.values || []).map((value) => {
                const isSelected = selectedOptionIds[option.id] === value.id;
                const state = getOptionValueState(option.id, value.id);
                const isDisabled =
                  !isSelected && (!state.isAvailable || !state.hasMatchingVariant || !state.hasInStockVariant);
                const isOutOfStock = state.hasMatchingVariant && !state.hasInStockVariant;

                return (
                  <button
                    key={value.id}
                    type="button"
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    onClick={() => handleSelectOption(option.id, value.id)}
                    className={[
                      'min-w-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                      'disabled:cursor-not-allowed disabled:opacity-45',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-background hover:border-primary/60',
                    ].join(' ')}
                  >
                    <span className="block break-words">{value.value}</span>
                    {isOutOfStock && (
                      <span className="mt-0.5 block text-[11px] font-normal opacity-80">غير متوفر</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {showMissingMessage && !isSelectionComplete && (
          <p className="text-sm text-amber-700">
            {missingOptions.length === 1
              ? `يرجى اختيار ${missingOptions[0]} قبل إضافة المنتج للسلة.`
              : 'يرجى اختيار جميع الخيارات قبل إضافة المنتج للسلة.'}
          </p>
        )}
        {isSelectionComplete && (!selectedVariant || variantIsUnavailable) && (
          <p className="text-sm text-red-700">هذا الخيار غير متوفر حاليًا.</p>
        )}
      </div>
    );
  }

  return (
    <section className="container mx-auto px-4 py-8 pb-28 md:py-12 md:pb-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
            <SafeImage
              key={selectedVariant?.image_url || currentImage?.id || `img-${selectedImage}`}
              src={imageSrc}
              fallbackSrc={PLACEHOLDER_PRODUCT}
              alt={currentImage?.alt_text || product.name}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 55vw"
            />
          </div>

          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  className={
                    index === selectedImage
                      ? 'relative aspect-square overflow-hidden rounded-md border-2 border-primary bg-muted'
                      : 'relative aspect-square overflow-hidden rounded-md border bg-muted'
                  }
                >
                  <SafeImage
                    src={safeImageSrc(image.url, PLACEHOLDER_PRODUCT)}
                    fallbackSrc={PLACEHOLDER_PRODUCT}
                    alt={image.alt_text || product.name}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            {product.category && <p className="text-sm text-muted-foreground">{product.category.name}</p>}
            <h1 className="mt-2 break-words text-3xl font-bold tracking-tight">{product.name}</h1>
            {product.marketing_tagline && (
              <p className="mt-2 text-sm font-medium text-muted-foreground">{product.marketing_tagline}</p>
            )}
            {product.short_description && (
              <p className="mt-3 leading-7 text-muted-foreground">{product.short_description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-bold text-primary">{formatPrice(displayPrice)}</span>
            {hasDiscount && (
              <>
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(displayComparePrice || 0)}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                    خصم {discount}%
                  </span>
                  <span className="text-xs text-red-600">
                    وفر {formatPrice((displayComparePrice || 0) - displayPrice)}
                  </span>
                </div>
              </>
            )}
          </div>

          {hasVariants && (
            <div className="space-y-3 rounded-lg border border-primary/10 bg-primary/5 p-3">
              <h2 className="text-sm font-semibold">
                {options.length === 1 ? `اختر ${options[0].name}` : 'اختر خيارات المنتج'}
              </h2>
              {renderVariantOptions()}
            </div>
          )}

          <div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${stockBadgeClass}`}>
              <span className={`h-2 w-2 rounded-full ${stockDotClass}`} />
              {stockLabel.text}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground md:hidden">الكمية</span>
            <div className="flex h-11 items-center rounded-md border">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={quantity <= 1}
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center text-sm font-medium">{quantity}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={quantity >= maxQuantity || maxQuantity <= 0}
                onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              type="button"
              className="hidden h-11 flex-1 md:inline-flex"
              disabled={!canSubmitAddToCart}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="ml-2 h-4 w-4" />
              أضف للسلة
            </Button>
          </div>

          {product.key_features && product.key_features.length > 0 && (
            <div className="border-t pt-5">
              <h2 className="mb-3 font-semibold">مميزات المنتج</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {product.key_features.slice(0, 6).map((feature, index) => (
                  <li key={`${feature}-${index}`} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span className="break-words leading-6">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {shouldShowFullDescription && (
            <details className="border-t pt-5">
              <summary className="cursor-pointer font-semibold">تفاصيل المنتج</summary>
              <p className="mt-3 whitespace-pre-line break-words leading-7 text-muted-foreground">
                {product.description}
              </p>
            </details>
          )}

          <div className="border-t pt-5">
            <h2 className="mb-3 font-semibold">لماذا تختار مؤسسة البرج؟</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Truck, label: 'توصيل لجميع المحافظات' },
                { icon: CreditCard, label: 'الدفع عند الاستلام' },
                { icon: Boxes, label: 'إمكانية طلب كميات' },
                { icon: MessageCircle, label: 'تواصل مباشر عبر واتساب' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-2 rounded-lg border bg-muted/50 p-3 text-center"
                >
                  <item.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium leading-tight">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {suitableForTags.length > 0 && (
            <div className="border-t pt-5">
              <h2 className="mb-3 font-semibold">مناسب لـ</h2>
              <div className="flex flex-wrap gap-2">
                {suitableForTags.map((key) => {
                  const label = INTENT_TAG_CONFIG.find((item) => item.key === key)?.label;
                  if (!label) return null;
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary"
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {whatsappUrl && (
            <div className="border-t pt-5">
              {isUnavailable ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h2 className="mb-2 font-semibold text-amber-800">المنتج غير متوفر حاليًا</h2>
                  <p className="mb-3 text-sm text-amber-800">
                    يمكنك الاستفسار عن توفره قريبًا عبر واتساب.
                  </p>
                  {inquiryUrl && (
                    <a
                      href={inquiryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        trackWhatsAppClick('product_availability_whatsapp', {
                          product_id: product.id,
                          product_name: product.name,
                          product_slug: product.slug,
                          price: displayPrice,
                        });
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      اسأل عن توفره عبر واتساب
                    </a>
                  )}
                </div>
              ) : (
                <>
                  <h2 className="mb-3 font-semibold">اطلب عبر واتساب</h2>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {inquiryUrl && (
                      <a
                        href={inquiryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          trackWhatsAppClick('product_inquiry', {
                            product_id: product.id,
                            product_name: product.name,
                            product_slug: product.slug,
                            price: displayPrice,
                          });
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-green-600 bg-white px-4 py-2.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50"
                      >
                        <MessageCircle className="h-4 w-4" />
                        اسألنا عن هذا المنتج
                      </a>
                    )}
                    {orderUrl && (
                      <a
                        href={orderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          trackWhatsAppClick('product_direct_order', {
                            product_id: product.id,
                            product_name: product.name,
                            product_slug: product.slug,
                            price: displayPrice,
                          });
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                      >
                        <MessageCircle className="h-4 w-4" />
                        اطلبه مباشرة
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {hasVariants && (
        <Sheet open={isVariantSheetOpen} onOpenChange={setIsVariantSheetOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[76vh] overflow-y-auto rounded-t-2xl p-4 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:p-5"
          >
            <SheetHeader className="text-right">
              <SheetTitle>اختر خيارات المنتج</SheetTitle>
              <SheetDescription className="line-clamp-2">
                {product.name}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">السعر:</span>
                <span className="text-lg font-bold text-primary">{formatPrice(displayPrice)}</span>
                {hasDiscount && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(displayComparePrice || 0)}
                  </span>
                )}
              </div>

              {renderVariantOptions({ showMissingMessage: true })}
            </div>

            <SheetFooter className="mt-5 gap-2 sm:flex-row-reverse sm:justify-start sm:space-x-0">
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={!canSubmitAddToCart}
                onClick={handleAddToCart}
              >
                <ShoppingCart className="ml-2 h-4 w-4" />
                إضافة للسلة
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setIsVariantSheetOpen(false)}
              >
                إغلاق
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <div
          className="mx-auto flex max-w-screen-sm items-center gap-3 px-4 py-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
        >
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">السعر</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-primary">{formatPrice(displayPrice)}</span>
              {hasDiscount && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(displayComparePrice || 0)}
                </span>
              )}
            </div>
          </div>

          <Button
            type="button"
            className="h-11 flex-1"
            disabled={!canSubmitAddToCart}
            onClick={handleAddToCart}
          >
            <ShoppingCart className="ml-2 h-4 w-4" />
            {hasVariants && !isSelectionComplete ? 'اختر الخيارات' : 'أضف للسلة'}
          </Button>
        </div>
      </div>
    </section>
  );
}
