'use client';

import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, Award, MessageCircle, Package, Check, Truck, CreditCard, Boxes, HelpCircle } from 'lucide-react';
import { ProductWithDetails } from '@/types';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_PRODUCT, safeImageSrc } from '@/lib/image-utils';
import { calculateDiscountPercentage, formatPrice } from '@/lib/utils';
import useCartStore from '@/stores/cart';
import { getWhatsAppLink } from '@/lib/store-settings';
import { getProductSuitableForTags, INTENT_TAG_CONFIG, type ProductIntentKey } from '@/lib/product-intents';
import { trackWhatsAppClick } from '@/lib/analytics';

interface ProductDetailProps {
  product: ProductWithDetails;
  whatsappNumber?: string | null;
}

export function ProductDetail({ product, whatsappNumber }: ProductDetailProps) {
  const cartStore = useCartStore();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Prevent hydration mismatch with cart store
  useEffect(() => {
    const rehydrate = (cartStore as any).rehydrate;
    if (typeof rehydrate === 'function') {
      rehydrate();
    }
    setHasHydrated(true);
  }, [cartStore]);

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

  const currentImage = images[selectedImage] || images[0];
  const imageSrc = safeImageSrc(currentImage?.url, PLACEHOLDER_PRODUCT);
  const hasDiscount = Boolean(product.compare_price && product.compare_price > product.price);
  const discount = hasDiscount
    ? calculateDiscountPercentage(product.price, product.compare_price || product.price)
    : 0;
  const maxQuantity = product.track_stock && !product.allow_backorders ? product.stock_quantity : 99;
  const canAddToCart = maxQuantity > 0 || product.allow_backorders;
  const isUnavailable = Boolean(product.track_stock && !product.allow_backorders && product.stock_quantity <= 0);

  function handleAddToCart() {
    if (!canAddToCart || !hasHydrated) return;

    cartStore.addItem({
      product_id: product.id,
      variant_id: null,
      name: product.name,
      price: product.price,
      quantity,
      image: imageSrc,
      stock_quantity: product.stock_quantity,
    });
    cartStore.openCart();
  }

  const productUrl = typeof window !== 'undefined' ? window.location.href : '';
  const inquiryText = `مرحبا، أريد الاستفسار عن المنتج:\n${product.name}\nالسعر: ${formatPrice(product.price)}\nالرابط: ${productUrl}`;
  const orderText = `مرحبا، أريد طلب:\n${product.name}\nالكمية: ${quantity}\nالسعر: ${formatPrice(product.price)}\nالرابط: ${productUrl}`;
  const whatsappUrl = getWhatsAppLink(whatsappNumber);
  const inquiryUrl = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(inquiryText)}` : null;
  const orderUrl = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(orderText)}` : null;

  const marketingBadgeConfig = (badge: string) => {
    switch (badge) {
      case 'bestselling':
        return { label: 'الأكثر طلبًا', className: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'offer':
        return { label: 'عرض', className: 'bg-red-100 text-red-700 border-red-200' };
      case 'new':
        return { label: 'جديد', className: 'bg-green-100 text-green-700 border-green-200' };
      case 'wholesale':
        return { label: 'سعر جملة', className: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'limited':
        return { label: 'كمية محدودة', className: 'bg-purple-100 text-purple-700 border-purple-200' };
      default:
        return null;
    }
  };

  const marketingTagline = (product as any).marketing_tagline as string | null | undefined;
  const keyFeatures = ((product as any).key_features as unknown[] | null | undefined) || [];
  const productBadges = ((product as any).product_badges as unknown[] | null | undefined) || [];
  const resolvedBadges = productBadges
    .map((badge) => (typeof badge === 'string' ? badge : null))
    .filter(Boolean) as string[];
  const resolvedFeatures = keyFeatures
    .map((feature) => (typeof feature === 'string' ? feature : null))
    .filter(Boolean) as string[];

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
    const ordered = order.filter((key) => tags.includes(key));
    return ordered.slice(0, 6);
  })();

  return (
    <section className="container mx-auto px-4 py-8 pb-28 md:py-12 md:pb-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
            <SafeImage
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
            {product.category && (
              <p className="text-sm text-muted-foreground">{product.category.name}</p>
            )}
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{product.name}</h1>
            {Boolean(marketingTagline) && (
              <p className="mt-2 text-sm font-medium text-muted-foreground">{marketingTagline}</p>
            )}

            {resolvedBadges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {resolvedBadges.slice(0, 5).map((badge) => {
                  const config = marketingBadgeConfig(badge);
                  if (!config) return null;
                  return (
                    <span
                      key={badge}
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${config.className}`}
                    >
                      {config.label}
                    </span>
                  );
                })}
              </div>
            )}
            {product.short_description && (
              <p className="mt-3 text-muted-foreground">{product.short_description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-bold text-primary">{formatPrice(product.price)}</span>
            {hasDiscount && (
              <>
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(product.compare_price || 0)}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                    خصم {discount}%
                  </span>
                  <span className="text-xs text-red-600">
                    وفر {formatPrice((product.compare_price || 0) - product.price)}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="rounded-lg border bg-card p-3 text-sm">
            {product.track_stock ? (
              product.stock_quantity > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-green-700">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  متوفر في المخزون ({product.stock_quantity} قطعة)
                </span>
              ) : product.allow_backorders ? (
                <span className="inline-flex items-center gap-1.5 text-amber-700">
                  <HelpCircle className="h-4 w-4" />
                  متاح للطلب المسبق
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-red-700">
                  <span className="h-2 w-2 rounded-full bg-red-500"></span>
                  غير متوفر حالياً
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                متوفر
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
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
                disabled={quantity >= maxQuantity}
                onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button type="button" className="h-11 flex-1" disabled={!canAddToCart} onClick={handleAddToCart}>
              <ShoppingCart className="ml-2 h-4 w-4" />
              أضف للسلة
            </Button>
          </div>

          {product.description && (
            <div className="border-t pt-5">
              <h2 className="mb-2 font-semibold">وصف المنتج</h2>
              <p className="whitespace-pre-line leading-7 text-muted-foreground">{product.description}</p>
            </div>
          )}

          {resolvedFeatures.length > 0 && (
            <div className="border-t pt-5">
              <h2 className="mb-3 font-semibold">مميزات المنتج</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {resolvedFeatures.slice(0, 6).map((feature, idx) => (
                  <li key={`${idx}-${feature}`} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span className="leading-6">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Trust Bar */}
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

          {/* Suitable For */}
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

          {/* WhatsApp CTA */}
          {whatsappUrl && (
            <div className="border-t pt-5">
              {isUnavailable ? (
                <>
                  <h2 className="mb-3 font-semibold text-amber-700">المنتج غير متوفر حالياً</h2>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="mb-3 text-sm text-amber-800">
                      هذا المنتج نفدت كميته. يمكنك الاستفسار عن توفره قريبًا عبر واتساب.
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
                            price: product.price,
                          });
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                      >
                        <MessageCircle className="h-4 w-4" />
                        اسأل عن توفره عبر واتساب
                      </a>
                    )}
                  </div>
                </>
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
                            price: product.price,
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
                            price: product.price,
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <div className="mx-auto flex max-w-screen-sm items-center gap-3 px-4 py-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}>
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">السعر</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-primary">{formatPrice(product.price)}</span>
              {hasDiscount && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(product.compare_price || 0)}
                </span>
              )}
              {hasDiscount && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  خصم {discount}%
                </span>
              )}
            </div>
          </div>

          <Button
            type="button"
            className="h-11 flex-1"
            disabled={!canAddToCart}
            onClick={handleAddToCart}
          >
            <ShoppingCart className="ml-2 h-4 w-4" />
            أضف للسلة
          </Button>

          {whatsappUrl && (isUnavailable ? inquiryUrl : orderUrl) && (
            <a
              href={(isUnavailable ? inquiryUrl : orderUrl) as string}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackWhatsAppClick('product_sticky_cta', {
                  product_id: product.id,
                  product_name: product.name,
                  product_slug: product.slug,
                  price: product.price,
                });
              }}
              className="inline-flex h-11 items-center justify-center rounded-md bg-green-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              <MessageCircle className="ml-2 h-4 w-4" />
              {isUnavailable ? 'اسألنا عن توفره' : 'اطلب عبر واتساب'}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
