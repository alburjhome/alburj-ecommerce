'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clipboard,
  ExternalLink,
  Eye,
  PackageOpen,
  RefreshCw,
  Save,
  Search,
  X,
  Phone,
  MessageCircle,
  MapPin,
  Calendar,
  User,
  CreditCard,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  getAdminOrderDetails,
  getAdminOrders,
  updateAdminOrderState,
} from '@/app/actions/admin-orders';
import type {
  OrderDetailsRecord,
  OrderListFilters,
  OrderListRow,
  OrderStatus,
  PaymentStatus,
} from '@/app/actions/admin-orders';
import { supabase } from '@/lib/supabase';
import { formatPrice, generateWhatsAppLink } from '@/lib/utils';

const statusOptions: Array<{ value: 'all' | OrderStatus; label: string; color: string }> = [
  { value: 'all', label: 'كل الطلبات', color: 'bg-slate-100 text-slate-700' },
  { value: 'pending', label: 'جديد', color: 'bg-amber-100 text-amber-700' },
  { value: 'confirmed', label: 'مؤكد', color: 'bg-blue-100 text-blue-700' },
  { value: 'processing', label: 'قيد التجهيز', color: 'bg-purple-100 text-purple-700' },
  { value: 'shipped', label: 'تم الشحن', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'delivered', label: 'تم التسليم', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'ملغي', color: 'bg-red-100 text-red-700' },
];

const editableStatusOptions: Array<{ value: OrderStatus; label: string; color: string }> = statusOptions.filter(
  (item): item is { value: OrderStatus; label: string; color: string } => item.value !== 'all'
);

const paymentStatusOptions: Array<{ value: PaymentStatus; label: string; color: string }> = [
  { value: 'pending', label: 'بانتظار الدفع', color: 'bg-amber-100 text-amber-700' },
  { value: 'paid', label: 'مدفوع', color: 'bg-green-100 text-green-700' },
  { value: 'failed', label: 'فشل الدفع', color: 'bg-red-100 text-red-700' },
  { value: 'refunded', label: 'مسترجع', color: 'bg-slate-100 text-slate-700' },
];

const statusLabels = editableStatusOptions.reduce<Record<OrderStatus, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<OrderStatus, string>);

const paymentStatusLabels = paymentStatusOptions.reduce<Record<PaymentStatus, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<PaymentStatus, string>);

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ar-JO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: OrderStatus) {
  const option = statusOptions.find(s => s.value === status);
  return option || { label: status, color: 'bg-slate-100 text-slate-700' };
}

function getPaymentBadge(status: PaymentStatus) {
  const option = paymentStatusOptions.find(s => s.value === status);
  return option || { label: status, color: 'bg-slate-100 text-slate-700' };
}

function formatJordanPhone(phone: string): string | null {
  const cleaned = phone.replace(/\s/g, '').replace(/[-]/g, '');
  
  // 07xxxxxxxx -> 9627xxxxxxxx
  if (/^07\d{8}$/.test(cleaned)) {
    return '962' + cleaned.substring(1);
  }
  
  // +9627xxxxxxxx -> 9627xxxxxxxx
  if (/^\+962\d{9}$/.test(cleaned)) {
    return cleaned.substring(1);
  }
  
  // 9627xxxxxxxx -> 9627xxxxxxxx
  if (/^9627\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  
  return null;
}

function getWhatsAppClickUrl(phone: string, message: string): string | null {
  const formatted = formatJordanPhone(phone);
  if (!formatted) return null;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}

function formatItemVariantOptions(item: {
  variant_options?: Record<string, string> | null;
  variant_name?: string | null;
}) {
  if (item.variant_options && Object.keys(item.variant_options).length > 0) {
    return Object.entries(item.variant_options)
      .map(([name, value]) => `${name}: ${value}`)
      .join('\n');
  }

  return item.variant_name || '';
}

function formatBundleSnapshot(item: {
  bundle_items_snapshot?: OrderDetailsRecord['items'][number]['bundle_items_snapshot'];
}) {
  const snapshot = item.bundle_items_snapshot || [];
  if (snapshot.length === 0) return '';

  return snapshot
    .map((bundleItem) => {
      const options =
        bundleItem.variant_options && Object.keys(bundleItem.variant_options).length > 0
          ? ` (${Object.entries(bundleItem.variant_options).map(([name, value]) => `${name}: ${value}`).join('، ')})`
          : '';
      return `- ${bundleItem.product_name}${options} × ${bundleItem.quantity}`;
    })
    .join('\n');
}

function buildOrderSummary(order: OrderDetailsRecord) {
  const itemsWithOptions = order.items
    .map((item, idx) => {
      const options = formatItemVariantOptions(item);
      const bundleSnapshot = formatBundleSnapshot(item);
      return [
        `${idx + 1}. ${item.product_name} × ${item.quantity} — ${formatPrice(Number(item.unit_price))}`,
        (item.item_type || 'product') === 'bundle' ? 'النوع: باكج' : '',
        options,
        bundleSnapshot ? `محتويات الباكج:\n${bundleSnapshot}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const items = order.items
    .map((item, idx) => `${idx + 1}. ${item.product_name} × ${item.quantity} — ${formatPrice(Number(item.unit_price))}`)
    .join('\n');

  const lines = [
    `طلب جديد من مؤسسة البرج`,
    `رقم الطلب: ${order.order_number}`,
    `العميل: ${order.customer_name}`,
    `الهاتف: ${order.customer_phone}`,
    `العنوان: ${order.governorate} — ${order.city} — ${order.address}`,
  ];

  if (order.landmark) {
    lines.push(`علامة مميزة: ${order.landmark}`);
  }

  lines.push('', 'المنتجات:', itemsWithOptions || items);
  lines.push('', `المجموع: ${formatPrice(Number(order.total))}`);

  if (order.notes) {
    lines.push('', `ملاحظات: ${order.notes}`);
  }

  return lines.join('\n');
}

function getWhatsAppGreeting(order: OrderDetailsRecord): string {
  const shortId = order.order_number.slice(-6);
  return `مرحبا ${order.customer_name}، معك مؤسسة البرج بخصوص طلبك رقم ${shortId}. نحتاج تأكيد التفاصيل.`;
}

function getWhatsAppUrl(order: OrderDetailsRecord): string | null {
  if (order.whatsapp_message_url) return order.whatsapp_message_url;
  
  const greeting = getWhatsAppGreeting(order);
  return getWhatsAppClickUrl(order.customer_phone, greeting);
}

function handleWhatsAppClick(
  order: { order_number: string; customer_name: string; customer_phone: string; whatsapp_message_url?: string | null },
  toast: ReturnType<typeof useToast>['toast']
) {
  const shortId = order.order_number.slice(-6);
  const greeting = `مرحبا ${order.customer_name}، معك مؤسسة البرج بخصوص طلبك رقم ${shortId}. نحتاج تأكيد التفاصيل.`;
  
  let url: string | null = null;
  if (order.whatsapp_message_url) {
    url = order.whatsapp_message_url;
  } else {
    url = getWhatsAppClickUrl(order.customer_phone, greeting);
  }
  
  if (!url) {
    toast({
      title: 'رقم الهاتف غير صالح',
      description: 'لا يمكن فتح واتساب: رقم العميل غير مكتوب بالصيغة الأردنية (07xxxxxxxx)',
      variant: 'destructive',
    });
    return;
  }
  window.open(url, '_blank');
}

export function OrdersClient() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [governorates, setGovernorates] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderListFilters['status']>('all');
  const [governorate, setGovernorate] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetailsRecord | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [statusDraft, setStatusDraft] = useState<OrderStatus>('pending');
  const [paymentDraft, setPaymentDraft] = useState<PaymentStatus>('pending');
  const [isSavingState, setIsSavingState] = useState(false);

  const filters = useMemo<OrderListFilters>(
    () => ({
      page,
      search,
      status,
      governorate,
    }),
    [governorate, page, search, status]
  );

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const result = await getAdminOrders(token, filters);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر تحميل الطلبات');
      }

      setOrders(result.data.orders);
      setGovernorates(result.data.governorates);
      setTotal(result.data.total);
      setTotalPages(result.data.totalPages);
    } catch (error) {
      toast({
        title: 'تعذر تحميل الطلبات',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function resetToFirstPage() {
    if (page !== 1) setPage(1);
  }

  async function openDetails(orderId: string) {
    setIsDetailsLoading(true);
    try {
      const token = await getAccessToken();
      const result = await getAdminOrderDetails(token, orderId);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'تعذر تحميل تفاصيل الطلب');
      }

      setSelectedOrder(result.data);
      setStatusDraft(result.data.status);
      setPaymentDraft(result.data.payment_status);
    } catch (error) {
      toast({
        title: 'تعذر تحميل تفاصيل الطلب',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsDetailsLoading(false);
    }
  }

  async function saveOrderState() {
    if (!selectedOrder) return;

    setIsSavingState(true);
    try {
      const token = await getAccessToken();
      const result = await updateAdminOrderState(token, selectedOrder.id, {
        status: statusDraft,
        payment_status: paymentDraft,
      });

      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ حالة الطلب');
      }

      toast({ title: 'تم تحديث حالة الطلب', description: selectedOrder.order_number });
      await loadOrders();
      await openDetails(selectedOrder.id);
    } catch (error) {
      toast({
        title: 'تعذر حفظ حالة الطلب',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSavingState(false);
    }
  }

  async function copySummary() {
    if (!selectedOrder) return;

    try {
      await navigator.clipboard.writeText(buildOrderSummary(selectedOrder));
      toast({ title: 'تم نسخ ملخص الطلب' });
    } catch {
      toast({
        title: 'تعذر نسخ الملخص',
        description: 'المتصفح منع الوصول إلى الحافظة.',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الطلبات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            متابعة طلبات المتجر وتحديث حالة الطلب والدفع.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadOrders} disabled={isLoading}>
          <RefreshCw className="ml-2 h-4 w-4" />
          تحديث
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetToFirstPage();
              }}
              className="pr-9"
              placeholder="بحث برقم الطلب أو اسم العميل أو الهاتف"
            />
          </div>

          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as OrderListFilters['status']);
              resetToFirstPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="حالة الطلب" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={governorate}
            onValueChange={(value) => {
              setGovernorate(value);
              resetToFirstPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="المحافظة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المحافظات</SelectItem>
              {governorates.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="button" variant="outline" onClick={loadOrders} disabled={isLoading}>
            بحث
          </Button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-right font-medium">رقم الطلب</th>
                <th className="px-4 py-3 text-right font-medium">العميل</th>
                <th className="px-4 py-3 text-right font-medium">الهاتف</th>
                <th className="px-4 py-3 text-right font-medium">المنطقة</th>
                <th className="px-4 py-3 text-right font-medium">المجموع</th>
                <th className="px-4 py-3 text-right font-medium">الحالة</th>
                <th className="px-4 py-3 text-right font-medium">الدفع</th>
                <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                <th className="px-4 py-3 text-left font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="border-b">
                    {Array.from({ length: 9 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4">
                        <div className="h-5 rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading &&
                orders.map((order) => {
                  const statusBadge = getStatusBadge(order.status);
                  const paymentBadge = getPaymentBadge(order.payment_status);
                  return (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{order.order_number}</td>
                      <td className="px-4 py-3 font-medium">{order.customer_name}</td>
                      <td className="px-4 py-3" dir="ltr">
                        <span className="text-xs">{order.customer_phone}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">{order.governorate}</td>
                      <td className="px-4 py-3 font-semibold">{formatPrice(Number(order.total))}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${statusBadge.color}`}>
                          {order.status === 'pending' && <Clock className="h-3 w-3" />}
                          {order.status === 'delivered' && <CheckCircle2 className="h-3 w-3" />}
                          {order.status === 'cancelled' && <Ban className="h-3 w-3" />}
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${paymentBadge.color}`}>
                          {paymentBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(order.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleWhatsAppClick(order, toast)}
                            title="فتح واتساب"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isDetailsLoading}
                            onClick={() => openDetails(order.id)}
                          >
                            <Eye className="ml-1 h-4 w-4" />
                            تفاصيل
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {!isLoading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <PackageOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              {search || status !== 'all' || governorate !== 'all' ? 'لا توجد طلبات مطابقة' : 'لا توجد طلبات حاليًا'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search || status !== 'all' || governorate !== 'all'
                ? 'جرب تغيير البحث أو إزالة الفلاتر'
                : 'الطلبات القادمة من السلة ستظهر هنا'}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            إجمالي النتائج: <span className="font-medium text-foreground">{total}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              السابق
            </Button>
            <span>
              صفحة {page} من {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              التالي
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
          ))}

        {!isLoading &&
          orders.map((order) => {
            const statusBadge = getStatusBadge(order.status);
            const paymentBadge = getPaymentBadge(order.payment_status);
            return (
              <div key={order.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{order.order_number}</p>
                    <p className="font-semibold">{order.customer_name}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusBadge.color}`}>
                    {statusBadge.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span dir="ltr">{order.customer_phone}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{order.governorate} — {order.city}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatPrice(Number(order.total))}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${paymentBadge.color}`}>
                      {paymentBadge.label}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-green-600"
                      onClick={() => handleWhatsAppClick(order, toast)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openDetails(order.id)}
                    >
                      تفاصيل
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {formatDateTime(order.created_at)}
                </p>
              </div>
            );
          })}

        {!isLoading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <PackageOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              {search || status !== 'all' || governorate !== 'all' ? 'لا توجد طلبات مطابقة' : 'لا توجد طلبات حاليًا'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {search || status !== 'all' || governorate !== 'all'
                ? 'جرب تغيير البحث أو إزالة الفلاتر'
                : 'الطلبات القادمة من السلة ستظهر هنا'}
            </p>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 p-2 sm:p-4">
          <div className="mx-auto mt-10 w-[calc(100vw-1rem)] max-w-6xl rounded-lg border bg-background shadow-xl sm:w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-4 sm:px-5">
              <div>
                <h2 className="text-lg font-semibold">تفاصيل الطلب {selectedOrder.order_number}</h2>
                <p className="text-sm text-muted-foreground">{formatDateTime(selectedOrder.created_at)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedOrder(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-5">
                {/* Customer Info */}
                <section className="rounded-lg border p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <User className="h-4 w-4 text-muted-foreground" />
                    بيانات العميل والعنوان
                  </h3>
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground text-xs block">الاسم الكامل</span>
                      <span className="font-medium">{selectedOrder.customer_name}</span>
                    </div>
                    <div className="p-2 rounded bg-muted/50 flex items-center justify-between">
                      <div>
                        <span className="text-muted-foreground text-xs block">رقم الهاتف</span>
                        <span dir="ltr">{selectedOrder.customer_phone}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600"
                        onClick={() => handleWhatsAppClick(selectedOrder, toast)}
                        title="فتح واتساب"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                    {selectedOrder.customer_email && (
                      <div className="p-2 rounded bg-muted/50">
                        <span className="text-muted-foreground text-xs block">البريد الإلكتروني</span>
                        <span>{selectedOrder.customer_email}</span>
                      </div>
                    )}
                    <div className="p-2 rounded bg-muted/50 md:col-span-2">
                      <span className="text-muted-foreground text-xs block">العنوان الكامل</span>
                      <span>{selectedOrder.governorate} — {selectedOrder.city} — {selectedOrder.address}</span>
                    </div>
                    {selectedOrder.landmark && (
                      <div className="p-2 rounded bg-muted/50">
                        <span className="text-muted-foreground text-xs block">علامة مميزة</span>
                        <span>{selectedOrder.landmark}</span>
                      </div>
                    )}
                    {selectedOrder.notes && (
                      <div className="p-2 rounded bg-amber-50 border border-amber-200 md:col-span-2">
                        <span className="text-amber-700 text-xs block">ملاحظات الطلب</span>
                        <span className="text-amber-900">{selectedOrder.notes}</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Order Items - Desktop Table */}
                <section className="rounded-lg border p-4 hidden md:block">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    المنتجات ({selectedOrder.items.length})
                  </h3>
                  {selectedOrder.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد منتجات ضمن هذا الطلب.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b text-muted-foreground">
                          <tr>
                            <th className="py-2 text-right font-medium">المنتج</th>
                            <th className="py-2 text-right font-medium">الكمية</th>
                            <th className="py-2 text-right font-medium">سعر الوحدة</th>
                            <th className="py-2 text-right font-medium">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrder.items.map((item) => (
                            <tr key={item.id} className="border-b last:border-0">
                              <td className="py-3">
                                <div className="font-medium">{item.product_name}</div>
                                {(item.item_type || 'product') === 'bundle' && (
                                  <span className="mt-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                    باكج
                                  </span>
                                )}
                                {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                    {Object.entries(item.variant_options).map(([name, value]) => (
                                      <div key={`${item.id}-${name}`}>
                                        <span className="font-medium">{name}:</span> {value}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {item.variant_name && (
                                  <div className="text-xs text-muted-foreground">{item.variant_name}</div>
                                )}
                                {item.product_sku && (
                                  <div className="text-xs text-muted-foreground font-mono">SKU: {item.product_sku}</div>
                                )}
                                {(item.item_type || 'product') === 'bundle' && item.bundle_items_snapshot && item.bundle_items_snapshot.length > 0 && (
                                  <div className="mt-2 rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                                    <div className="font-medium text-foreground">محتويات الباكج</div>
                                    <div className="mt-1 whitespace-pre-line">{formatBundleSnapshot(item)}</div>
                                  </div>
                                )}
                              </td>
                              <td className="py-3">{item.quantity}</td>
                              <td className="py-3">{formatPrice(Number(item.unit_price))}</td>
                              <td className="py-3 font-semibold">{formatPrice(Number(item.total_price))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Order Items - Mobile Cards */}
                <section className="md:hidden space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    المنتجات ({selectedOrder.items.length})
                  </h3>
                  {selectedOrder.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد منتجات ضمن هذا الطلب.</p>
                  ) : (
                    selectedOrder.items.map((item) => (
                      <div key={item.id} className="rounded-lg border p-3">
                        <div className="font-medium mb-1">{item.product_name}</div>
                        {(item.item_type || 'product') === 'bundle' && (
                          <span className="mb-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            باكج
                          </span>
                        )}
                        {item.variant_options && Object.keys(item.variant_options).length > 0 && (
                          <div className="mb-2 space-y-0.5 text-xs text-muted-foreground">
                            {Object.entries(item.variant_options).map(([name, value]) => (
                              <div key={`${item.id}-${name}`}>
                                <span className="font-medium">{name}:</span> {value}
                              </div>
                            ))}
                          </div>
                        )}
                        {item.variant_name && (
                          <div className="text-xs text-muted-foreground mb-2">{item.variant_name}</div>
                        )}
                        {(item.item_type || 'product') === 'bundle' && item.bundle_items_snapshot && item.bundle_items_snapshot.length > 0 && (
                          <div className="mb-2 rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                            <div className="font-medium text-foreground">محتويات الباكج</div>
                            <div className="mt-1 whitespace-pre-line">{formatBundleSnapshot(item)}</div>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.quantity} × {formatPrice(Number(item.unit_price))}</span>
                          <span className="font-semibold">{formatPrice(Number(item.total_price))}</span>
                        </div>
                      </div>
                    ))
                  )}
                </section>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-[84px] lg:self-start">
                {/* Status Control */}
                <section className="rounded-lg border p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    حالة الطلب والدفع
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-sm text-muted-foreground">حالة الطلب</p>
                      <Select value={statusDraft} onValueChange={(value) => setStatusDraft(value as OrderStatus)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {editableStatusOptions.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="mb-1.5 text-sm text-muted-foreground">حالة الدفع</p>
                      <Select
                        value={paymentDraft}
                        onValueChange={(value) => setPaymentDraft(value as PaymentStatus)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentStatusOptions.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" onClick={saveOrderState} disabled={isSavingState} className="w-full">
                      <Save className="ml-2 h-4 w-4" />
                      {isSavingState ? 'جاري الحفظ...' : 'حفظ التحديثات'}
                    </Button>
                  </div>
                </section>

                {/* Order Summary */}
                <section className="rounded-lg border p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    ملخص المبالغ
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المجموع الفرعي</span>
                      <span>{formatPrice(Number(selectedOrder.subtotal))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الشحن</span>
                      <span>{formatPrice(Number(selectedOrder.shipping_cost))}</span>
                    </div>
                    {Number(selectedOrder.discount) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>الخصم</span>
                        <span>-{formatPrice(Number(selectedOrder.discount))}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 font-semibold text-base">
                      <span>الإجمالي</span>
                      <span className="text-primary">{formatPrice(Number(selectedOrder.total))}</span>
                    </div>
                  </div>
                </section>

                {/* Quick Actions */}
                <section className="rounded-lg border p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    إجراءات سريعة
                  </h3>
                  <div className="space-y-2">
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => handleWhatsAppClick(selectedOrder, toast)}
                    >
                      <MessageCircle className="ml-2 h-4 w-4" />
                      فتح واتساب للعميل
                    </Button>
                    <Button type="button" variant="secondary" onClick={copySummary} className="w-full">
                      <Clipboard className="ml-2 h-4 w-4" />
                      نسخ ملخص الطلب
                    </Button>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
