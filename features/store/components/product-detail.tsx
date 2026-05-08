'use client';

import { useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, Award, Home, Store, UtensilsCrossed, Briefcase, MessageCircle, Package } from 'lucide-react';
import { ProductWithDetails } from '@/types';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { PLACEHOLDER_PRODUCT, safeImageSrc } from '@/lib/image-utils';
import { calculateDiscountPercentage, formatPrice } from '@/lib/utils';
import useCartStore from '@/stores/cart';
import { getWhatsAppLink } from '@/lib/store-settings';

interface ProductDetailProps {
  product: ProductWithDetails;
  whatsappNumber?: string | null;
}

export function ProductDetail({ product, whatsappNumber }: ProductDetailProps) {
  const { addItem, openCart } = useCartStore();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

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

  function handleAddToCart() {
    if (!canAddToCart) return;

    addItem({
      product_id: product.id,
      variant_id: null,
      name: product.name,
      price: product.price,
      quantity,
      image: imageSrc,
      stock_quantity: product.stock_quantity,
    });
    openCart();
  }

  const productUrl = typeof window !== 'undefined' ? window.location.href : '';
  const inquiryText = `مرحبا، أريد الاستفسار عن المنتج:\n${product.name}\nالسعر: ${formatPrice(product.price)}\nالرابط: ${productUrl}`;
  const orderText = `مرحبا، أريد طلب:\n${product.name}\nالكمية: ${quantity}\nالسعر: ${formatPrice(product.price)}\nالرابط: ${productUrl}`;
  const whatsappUrl = getWhatsAppLink(whatsappNumber);
  const inquiryUrl = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(inquiryText)}` : null;
  const orderUrl = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(orderText)}` : null;

  return (
    <section className="container mx-auto px-4 py-8 md:py-12">
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
                <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                  خصم {discount}%
                </span>
              </>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4 text-sm">
            {product.track_stock ? (
              product.stock_quantity > 0 ? (
                <span className="text-green-700">متوفر في المخزون: {product.stock_quantity}</span>
              ) : product.allow_backorders ? (
                <span className="text-amber-700">متاح للطلب المسبق</span>
              ) : (
                <span className="text-red-700">غير متوفر حالياً</span>
              )
            ) : (
              <span className="text-green-700">متوفر</span>
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

          {/* Why Choose This Product */}
          <div className="border-t pt-5">
            <h2 className="mb-3 font-semibold">لماذا تختار هذا المنتج؟</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Award, label: 'جودة ممتازة' },
                { icon: Package, label: 'مناسب للاستخدام اليومي' },
                { icon: ShoppingCart, label: 'سعر مناسب' },
                { icon: Award, label: 'توصيل لجميع المحافظات' },
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
          <div className="border-t pt-5">
            <h2 className="mb-3 font-semibold">مناسب لـ</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { icon: Home, label: 'البيت' },
                { icon: Store, label: 'المحلات' },
                { icon: UtensilsCrossed, label: 'المطاعم' },
                { icon: Briefcase, label: 'المكاتب' },
              ].map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5 text-xs font-medium"
                >
                  <item.icon className="h-3.5 w-3.5 text-primary" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {/* WhatsApp CTA */}
          {whatsappUrl && (
            <div className="border-t pt-5">
              <h2 className="mb-3 font-semibold">اطلب عبر واتساب</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                {inquiryUrl && (
                  <a
                    href={inquiryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
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
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                    اطلبه مباشرة
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
