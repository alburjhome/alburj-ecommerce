'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import useCartStore from '@/stores/cart';
import { formatPrice } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { JORDAN_GOVERNORATES } from '@/types';
import { createOrder } from '@/app/actions/checkout';
import { Truck, CreditCard, MessageCircle } from 'lucide-react';

interface CartCheckoutProps {
  onBack: () => void;
}

export function CartCheckout({ onBack }: CartCheckoutProps) {
  // Use selectors for stable references
  const items = useCartStore((state) => state.items);
  const getTotalPrice = useCartStore((state) => state.getTotalPrice);
  const clearCart = useCartStore((state) => state.clearCart);
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [isShippingLoading, setIsShippingLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    governorate: '',
    city: '',
    address: '',
    landmark: '',
    notes: '',
  });

  const subtotal = getTotalPrice();
  const hasValidShippingRate =
    typeof shippingCost === 'number' && !shippingError && !isShippingLoading;
  const total = subtotal + (shippingCost ?? 0);

  useEffect(() => {
    let isMounted = true;

    async function loadShippingRate() {
      if (!formData.governorate) {
        setShippingCost(null);
        setShippingError(null);
        setIsShippingLoading(false);
        return;
      }

      setShippingCost(null);
      setShippingError(null);
      setIsShippingLoading(true);

      const { data, error } = await supabase
        .from('shipping_rates')
        .select('rate')
        .eq('governorate', formData.governorate)
        .eq('is_active', true)
        .maybeSingle<{ rate: number }>();

      if (!isMounted) return;

      setIsShippingLoading(false);

      if (error) {
        setShippingError('تعذر تحميل سعر الشحن. الرجاء المحاولة مرة أخرى.');
        return;
      }

      if (!data) {
        setShippingError('الشحن غير متاح لهذه المحافظة حالياً.');
        return;
      }

      setShippingCost(data.rate);
    }

    loadShippingRate();

    return () => {
      isMounted = false;
    };
  }, [formData.governorate]);

  const validateForm = () => {
    const errors: string[] = [];
    if (!formData.customer_name.trim()) {
      errors.push('الاسم الكامل مطلوب');
    }
    if (!formData.customer_phone.trim()) {
      errors.push('رقم الهاتف مطلوب');
    } else if (!/^07[0-9]{8}$/.test(formData.customer_phone.trim())) {
      errors.push('رقم الهاتف يجب أن يكون 10 أرقام ويبدأ بـ 07');
    }
    if (!formData.governorate) {
      errors.push('المحافظة مطلوبة');
    }
    if (!formData.city.trim()) {
      errors.push('المدينة مطلوبة');
    }
    if (!formData.address.trim()) {
      errors.push('العنوان التفصيلي مطلوب');
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast({
        title: 'الرجاء إكمال البيانات',
        description: validationErrors.join(' • '),
        variant: 'destructive',
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: 'السلة فارغة',
        description: 'أضف منتجات للسلة قبل إتمام الطلب',
        variant: 'destructive',
      });
      return;
    }

    if (!hasValidShippingRate) {
      toast({
        title: 'تعذر تحديد سعر الشحن',
        description: shippingError || 'اختر محافظة يتوفر لها سعر شحن قبل إرسال الطلب.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Use Server Action for secure checkout
      // All prices are verified server-side from database
      const result = await createOrder({
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        governorate: formData.governorate,
        city: formData.city,
        address: formData.address,
        landmark: formData.landmark || null,
        notes: formData.notes || null,
        items: items.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          item_type: item.item_type || 'product',
          name: item.name,
          quantity: item.quantity,
          price: item.price, // Client price for reference - server verifies
          variant_name: item.variant_name || null,
          selected_options: item.selected_options || null,
          sku: item.sku || null,
          bundle_items: item.bundle_items || null,
        })),
      });

      if (!result.success) {
        if (result.error?.includes('whatsapp') || result.error?.includes('واتساب')) {
          toast({
            title: 'رقم واتساب المتجر غير مضبوط',
            description: 'يرجى التواصل معنا مباشرة.',
            variant: 'destructive',
          });
        } else {
          throw new Error(result.error || 'فشل إنشاء الطلب');
        }
        return;
      }

      // Open WhatsApp with server-generated message
      if (result.whatsappUrl) {
        window.open(result.whatsappUrl, '_blank');
      }

      setIsSuccess(true);
      clearCart();

      toast({
        title: 'تم إرسال الطلب',
        description: `رقم الطلب: ${result.order?.order_number}`,
      });
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'حدث خطأ أثناء إرسال الطلب. الرجاء المحاولة مرة أخرى.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">تم إرسال طلبك!</h2>
        <p className="text-muted-foreground mb-6">
          تم توجيهك إلى واتساب لإتمام الطلب. سنتواصل معك قريباً.
        </p>
        <Button onClick={onBack}>مواصلة التسوق</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">إتمام الطلب</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-auto space-y-4">
        <div>
          <Label htmlFor="name">الاسم الكامل *</Label>
          <Input
            id="name"
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            placeholder="الاسم الثلاثي"
            className="text-base"
            required
          />
        </div>

        <div>
          <Label htmlFor="phone">رقم الهاتف *</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            value={formData.customer_phone}
            onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
            placeholder="مثال: 0791234567"
            className="text-base"
            required
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            يجب أن يكون 10 أرقام ويبدأ بـ 07
          </p>
        </div>

        <div>
          <Label>المحافظة *</Label>
          <Select
            value={formData.governorate}
            onValueChange={(value) => setFormData({ ...formData, governorate: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر المحافظة" />
            </SelectTrigger>
            <SelectContent>
              {JORDAN_GOVERNORATES.map((gov) => (
                <SelectItem key={gov.name} value={gov.name}>
                  {gov.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {shippingError && (
            <p className="mt-1 text-xs text-destructive">{shippingError}</p>
          )}
        </div>

        <div>
          <Label htmlFor="city">المدينة *</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="مثال: عبدون، شارع المدينة المنورة"
            className="text-base"
            required
          />
        </div>

        <div>
          <Label htmlFor="address">العنوان التفصيلي *</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="اسم الشارع، رقم المبنى"
            required
          />
        </div>

        <div>
          <Label htmlFor="landmark">علامة مميزة (اختياري)</Label>
          <Input
            id="landmark"
            value={formData.landmark}
            onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
            placeholder="بالقرب من مسجد/مدرسة/محل معروف"
            className="text-base"
          />
        </div>

        <div>
          <Label htmlFor="notes">ملاحظات إضافية (اختياري)</Label>
          <Input
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="وقت توصيل مفضل، طلبات خاصة..."
            className="text-base"
          />
        </div>

        {/* Order Summary */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>المجموع الفرعي:</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>الشحن:</span>
            <span>
              {isShippingLoading
                ? 'جاري تحميل...'
                : shippingCost === null
                  ? 'اختر المحافظة'
                  : formatPrice(shippingCost)}
            </span>
          </div>
          <div className="flex justify-between font-semibold text-lg">
            <span>الإجمالي:</span>
            <span className="text-primary">{formatPrice(total)}</span>
          </div>
        </div>

        {/* Trust Box */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            بعد إرسال الطلب عبر واتساب، سيتواصل معك فريق مؤسسة البرج لتأكيد التفاصيل.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 bg-background px-2 py-1 rounded">
              <Truck className="h-3 w-3" />
              توصيل لجميع المحافظات
            </span>
            <span className="inline-flex items-center gap-1 bg-background px-2 py-1 rounded">
              <CreditCard className="h-3 w-3" />
              الدفع عند الاستلام
            </span>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isSubmitting || !hasValidShippingRate}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              جاري تجهيز الطلب...
            </>
          ) : (
            <>
              <MessageCircle className="h-4 w-4 mr-2" />
              إرسال الطلب عبر واتساب
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
