import Link from 'next/link';
import { Package, ShoppingCart, Timer, TrendingUp, Warehouse } from 'lucide-react';
import { requireAdminServer } from '@/lib/admin-auth-server';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';
import { formatPrice } from '@/lib/utils';

interface LatestOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  status: string;
  created_at: string;
}

interface LowStockProduct {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ar-JO', {
    month: 'short',
    day: 'numeric',
  });
}

export default async function AdminDashboardPage() {
  await requireAdminServer();

  const supabase = createSupabaseServerClient();
  const [
    productsCountResult,
    ordersCountResult,
    pendingOrdersCountResult,
    salesResult,
    latestOrdersResult,
    lowStockResult,
  ] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    (supabase.from('orders') as any).select('total').in('status', ['confirmed', 'delivered']),
    (supabase.from('orders') as any)
      .select('id, order_number, customer_name, total, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    (supabase.from('products') as any)
      .select('id, name, sku, stock_quantity')
      .eq('track_stock', true)
      .lte('stock_quantity', 5)
      .order('stock_quantity', { ascending: true })
      .limit(5),
  ]);

  const productsCount = productsCountResult.count || 0;
  const ordersCount = ordersCountResult.count || 0;
  const pendingOrdersCount = pendingOrdersCountResult.count || 0;
  const salesTotal = ((salesResult.data || []) as Array<{ total: number }>).reduce(
    (sum, order) => sum + Number(order.total),
    0
  );
  const latestOrders = (latestOrdersResult.data || []) as LatestOrder[];
  const lowStockProducts = (lowStockResult.data || []) as LowStockProduct[];

  const cards = [
    {
      label: 'عدد المنتجات',
      value: productsCount,
      icon: Package,
      href: '/admin/products',
    },
    {
      label: 'عدد الطلبات',
      value: ordersCount,
      icon: ShoppingCart,
      href: '/admin/orders',
    },
    {
      label: 'طلبات قيد الانتظار',
      value: pendingOrdersCount,
      icon: Timer,
      href: '/admin/orders',
    },
    {
      label: 'مبيعات مؤكدة/مسلمة',
      value: formatPrice(salesTotal),
      icon: TrendingUp,
      href: '/admin/orders',
    },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">لوحة التحكم</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          نظرة تشغيلية مختصرة على المنتجات والطلبات والمبيعات.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => {
          const Icon = item.icon;

          return (
            <Link key={item.label} href={item.href} className="min-w-0 rounded-lg border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <p className="min-w-0 text-sm text-muted-foreground">{item.label}</p>
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-4 break-words text-2xl font-bold">{item.value}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">آخر 5 طلبات</h2>
              <p className="text-sm text-muted-foreground">أحدث الطلبات الواردة من checkout.</p>
            </div>
            <Link href="/admin/orders" className="text-sm font-medium text-primary hover:underline">
              عرض الكل
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="py-2 text-right font-medium">رقم الطلب</th>
                  <th className="py-2 text-right font-medium">العميل</th>
                  <th className="py-2 text-right font-medium">الإجمالي</th>
                  <th className="py-2 text-right font-medium">الحالة</th>
                  <th className="py-2 text-right font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {latestOrders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="py-3 font-mono text-xs">{order.order_number}</td>
                    <td className="py-3 font-medium">{order.customer_name}</td>
                    <td className="py-3">{formatPrice(Number(order.total))}</td>
                    <td className="py-3">{order.status}</td>
                    <td className="py-3 text-muted-foreground">{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {latestOrders.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">لا توجد طلبات بعد.</div>
          )}
        </section>

        <section className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 text-amber-700">
              <Warehouse className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">مخزون منخفض</h2>
              <p className="text-sm text-muted-foreground">منتجات بكمية 5 أو أقل.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {lowStockProducts.map((product) => (
              <Link
                key={product.id}
                href={`/admin/products/${product.id}/edit`}
                className="block rounded-md border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sku || 'بدون SKU'}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                    {product.stock_quantity}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {lowStockProducts.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              لا توجد منتجات منخفضة المخزون حاليًا.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
