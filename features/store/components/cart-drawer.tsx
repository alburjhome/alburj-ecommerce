'use client';

import { useState } from 'react';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import useCartStore from '@/stores/cart';
import { PLACEHOLDER_PRODUCT, safeImageSrc } from '@/lib/image-utils';
import { formatPrice } from '@/lib/utils';
import { CartCheckout } from './cart-checkout';

export function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeItem, getTotalPrice } = useCartStore();
  const [showCheckout, setShowCheckout] = useState(false);
  const total = getTotalPrice();

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
            <h2 className="text-lg font-bold">سلة المشتريات ({items.length})</h2>
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

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">السلة فارغة</p>
            <Button onClick={closeCart} className="mt-4" variant="outline">
              مواصلة التسوق
            </Button>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 bg-muted rounded-lg">
                  <div className="relative w-20 h-20 rounded-md overflow-hidden shrink-0">
                    <SafeImage
                      src={safeImageSrc(item.image, PLACEHOLDER_PRODUCT)}
                      fallbackSrc={PLACEHOLDER_PRODUCT}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
                    <p className="text-primary font-semibold mt-1">
                      {formatPrice(item.price)}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.stock_quantity}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t px-4 pt-4 pb-4 space-y-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>المجموع:</span>
                <span className="text-primary">{formatPrice(total)}</span>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={() => setShowCheckout(true)}
              >
                إتمام الطلب
                <ArrowRight className="h-4 w-4 mr-2" />
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={closeCart}
              >
                مواصلة التسوق
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
