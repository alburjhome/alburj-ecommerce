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

const statusOptions: Array<{ value: 'all' | OrderStatus; label: string }> = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'confirmed', label: 'مؤكد' },
  { value: 'processing', label: 'قيد التجهيز' },
  { value: 'shipped', label: 'تم الشحن' },
  { value: 'delivered', label: 'تم التسليم' },
  { value: 'cancelled', label: 'ملغي' },
];

const editableStatusOptions: Array<{ value: OrderStatus; label: string }> = statusOptions.filter(
  (item): item is { value: OrderStatus; label: string } => item.value !== 'all'
);

const paymentStatusOptions: Array<{ value: PaymentStatus; label: string }> = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'paid', label: 'مدفوع' },
  { value: 'failed', label: 'فشل الدفع' },
  { value: 'refunded', label: 'مسترجع' },
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

function statusClass(status: OrderStatus) {
  if (status === 'delivered' || status === 'confirmed') {
    return 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700';
  }

  if (status === 'cancelled') {
    return 'rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700';
  }

  return 'rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700';
}

function paymentClass(status: PaymentStatus) {
  if (status === 'paid') {
    return 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700';
  }

  if (status === 'failed' || status === 'refunded') {
    return 'rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700';
  }

  return 'rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground';
}

function buildOrderSummary(order: OrderDetailsRecord) {
  const items = order.items
    .map((item) => `- ${item.product_name} x${item.quantity} = ${formatPrice(Number(item.total_price))}`)
    .join('\n');

  return [
    `طلب #${order.order_number}`,
    `العميل: ${order.customer_name}`,
    `الهاتف: ${order.customer_phone}`,
    `العنوان: ${order.governorate} - ${order.city} - ${order.address}`,
    order.landmark ? `علامة مميزة: ${order.landmark}` : '',
    '',
    'المنتجات:',
    items,
    '',
    `المجموع الفرعي: ${formatPrice(Number(order.subtotal))}`,
    `الشحن: ${formatPrice(Number(order.shipping_cost))}`,
    `الإجمالي: ${formatPrice(Number(order.total))}`,
    order.notes ? `ملاحظات: ${order.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function getWhatsAppUrl(order: OrderDetailsRecord) {
  return order.whatsapp_message_url || generateWhatsAppLink(order.customer_phone, buildOrderSummary(order));
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

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="border-b bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-right font-medium">رقم الطلب</th>
                <th className="px-4 py-3 text-right font-medium">العميل</th>
                <th className="px-4 py-3 text-right font-medium">الهاتف</th>
                <th className="px-4 py-3 text-right font-medium">المحافظة</th>
                <th className="px-4 py-3 text-right font-medium">المدينة</th>
                <th className="px-4 py-3 text-right font-medium">الإجمالي</th>
                <th className="px-4 py-3 text-right font-medium">حالة الطلب</th>
                <th className="px-4 py-3 text-right font-medium">الدفع</th>
                <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                <th className="px-4 py-3 text-left font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="border-b">
                    {Array.from({ length: 10 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4">
                        <div className="h-5 rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading &&
                orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{order.order_number}</td>
                    <td className="px-4 py-3 font-medium">{order.customer_name}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {order.customer_phone}
                    </td>
                    <td className="px-4 py-3">{order.governorate}</td>
                    <td className="px-4 py-3">{order.city}</td>
                    <td className="px-4 py-3 font-medium">{formatPrice(Number(order.total))}</td>
                    <td className="px-4 py-3">
                      <span className={statusClass(order.status)}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={paymentClass(order.payment_status)}>
                        {paymentStatusLabels[order.payment_status] || order.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
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
                ))}
            </tbody>
          </table>
        </div>

        {!isLoading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <PackageOpen className="h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">لا توجد طلبات</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              لا توجد نتائج مطابقة للبحث أو الفلاتر الحالية.
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

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="mt-10 w-full max-w-5xl rounded-lg border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">تفاصيل الطلب {selectedOrder.order_number}</h2>
                <p className="text-sm text-muted-foreground">{formatDateTime(selectedOrder.created_at)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedOrder(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_340px]">
              <div className="space-y-5">
                <section className="rounded-lg border p-4">
                  <h3 className="font-semibold">بيانات العميل والعنوان</h3>
                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">الاسم: </span>
                      {selectedOrder.customer_name}
                    </p>
                    <p>
                      <span className="text-muted-foreground">الهاتف: </span>
                      <span dir="ltr">{selectedOrder.customer_phone}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">البريد: </span>
                      {selectedOrder.customer_email || '-'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">المحافظة: </span>
                      {selectedOrder.governorate}
                    </p>
                    <p>
                      <span className="text-muted-foreground">المدينة: </span>
                      {selectedOrder.city}
                    </p>
                    <p>
                      <span className="text-muted-foreground">العنوان: </span>
                      {selectedOrder.address}
                    </p>
                    <p>
                      <span className="text-muted-foreground">علامة مميزة: </span>
                      {selectedOrder.landmark || '-'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">ملاحظات: </span>
                      {selectedOrder.notes || '-'}
                    </p>
                  </div>
                </section>

                <section className="rounded-lg border p-4">
                  <h3 className="font-semibold">المنتجات</h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="border-b text-muted-foreground">
                        <tr>
                          <th className="py-2 text-right font-medium">المنتج</th>
                          <th className="py-2 text-right font-medium">SKU</th>
                          <th className="py-2 text-right font-medium">الكمية</th>
                          <th className="py-2 text-right font-medium">سعر الوحدة</th>
                          <th className="py-2 text-right font-medium">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items.map((item) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="py-3 font-medium">
                              {item.product_name}
                              {item.variant_name && (
                                <span className="block text-xs text-muted-foreground">{item.variant_name}</span>
                              )}
                            </td>
                            <td className="py-3 text-muted-foreground">{item.product_sku || '-'}</td>
                            <td className="py-3">{item.quantity}</td>
                            <td className="py-3">{formatPrice(Number(item.unit_price))}</td>
                            <td className="py-3 font-medium">{formatPrice(Number(item.total_price))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <aside className="space-y-4">
                <section className="rounded-lg border p-4">
                  <h3 className="font-semibold">الحالة</h3>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="mb-1 text-sm text-muted-foreground">حالة الطلب</p>
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
                      <p className="mb-1 text-sm text-muted-foreground">حالة الدفع</p>
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
                      {isSavingState ? 'جاري الحفظ...' : 'حفظ الحالة'}
                    </Button>
                  </div>
                </section>

                <section className="rounded-lg border p-4">
                  <h3 className="font-semibold">المبالغ</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المجموع الفرعي</span>
                      <span>{formatPrice(Number(selectedOrder.subtotal))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الشحن</span>
                      <span>{formatPrice(Number(selectedOrder.shipping_cost))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الخصم</span>
                      <span>{formatPrice(Number(selectedOrder.discount))}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>الإجمالي</span>
                      <span>{formatPrice(Number(selectedOrder.total))}</span>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border p-4">
                  <h3 className="font-semibold">واتساب</h3>
                  <div className="mt-3 space-y-2">
                    <Button asChild variant="outline" className="w-full">
                      <a href={getWhatsAppUrl(selectedOrder)} target="_blank" rel="noreferrer">
                        <ExternalLink className="ml-2 h-4 w-4" />
                        فتح واتساب
                      </a>
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
