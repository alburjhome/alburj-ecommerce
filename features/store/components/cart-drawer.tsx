'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, X, Package } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import useCartStore from '@/stores/cart';
import { PLACEHOLDER_PRODUCT, safeImageSrc } from '@/lib/image-utils';
import { formatPrice } from '@/lib/utils';
import { CartCheckout } from './cart-checkout';

export function CartDrawer() {
  // Use selectors for stable references and granular re-renders
  const items = useCartStore((state) => state.items);
  const isOpen = useCartStore((state) => state.isOpen);
  const closeCart = useCartStore((state) => state.closeCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const getTotalPrice = useCartStore((state) => state.getTotalPrice);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const rehydrate = useCartStore((state) => state.rehydrate);

  const [showCheckout, setShowCheckout] = useState(false);
  // Show empty state until hydration completes to avoid SSR/CSR mismatch
  const hydratedItems = hasHydrated ? items : [];
  const total = hasHydrated ? getTotalPrice() : 0;

  useEffect(() => {
    if (!hasHydrated && rehydrate) {
      rehydrate();
    }
  }, [hasHydrated, rehydrate]);

  if (showCheckout) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
        <SheetContent side="left" className="w-full sm:max-w-md [&>button]:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Checkout</SheetTitle>
            <SheetDescription>Enter delivery details and send the order to WhatsApp.</SheetDescription>
          </SheetHeader>
          <CartCheckout onBack={() => setShowCheckout(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent side="left" className="w-full sm:max-w-md flex flex-col p-0 [&>button]:hidden">
        <div className="flex items-center justify-between gap-4 border-b px-4 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            <h2 className="text-lg font-bold">سلة المشتريات</h2>
            {hasHydrated && hydratedItems.length > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                {hydratedItems.length}
              </span>
            )}
          </div>
          <SheetClose asChild>
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
              aria-label="إغلاق السلة"
            >
              <X className="h-5 w-5" />
            </button>
          </SheetClose>
        </div>

        <SheetHeader className="sr-only">
          <SheetTitle>سلة المشتريات</SheetTitle>
          <SheetDescription>Review cart items, adjust quantities, or continue to checkout.</SheetDescription>
        </SheetHeader>

        {hydratedItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Package className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">سلتك فارغة حاليًا</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-[260px]">
              أضف المنتجات التي تريدها ثم أرسل الطلب عبر واتساب.
            </p>
            <Button asChild className="w-full max-w-[200px]" onClick={closeCart}>
              <a href="/products">تصفح المنتجات</a>
            </Button>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
              {hydratedItems.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg border">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-md overflow-hidden shrink-0 bg-background">
                    <SafeImage
                      src={safeImageSrc(item.image, PLACEHOLDER_PRODUCT)}
                      fallbackSrc={PLACEHOLDER_PRODUCT}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="font-medium text-sm line-clamp-2 leading-5">{item.name}</h4>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {formatPrice(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 bg-background rounded-md border">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-none rounded-r-md"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-none rounded-l-md"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.stock_quantity}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t px-4 pt-4 pb-5 space-y-4 bg-muted/30">
              {/* Cart Summary */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>عدد المنتجات:</span>
                  <span>{hydratedItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>المجموع:</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  الشحن يُحسب حسب المنطقة عند إكمال الطلب.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setShowCheckout(true)}
                >
                  إكمال الطلب
                  <ArrowRight className="h-4 w-4 mr-2" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={closeCart}
                >
                  متابعة التسوق
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
