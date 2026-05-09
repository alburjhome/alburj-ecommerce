import Link from 'next/link';
import { LineChart, MessageCircle, Package } from 'lucide-react';
import { requireAdminServer } from '@/lib/admin-auth-server';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';

const SOURCE_LABELS: Record<string, string> = {
  product_inquiry: 'سؤال عن منتج',
  product_direct_order: 'طلب منتج مباشرة',
  product_sticky_cta: 'زر واتساب الثابت',
  quick_order: 'الطلب السريع',
  homepage_shop_cta: 'زر واتساب (الرئيسية)',
  homepage_bundle: 'باقة (الرئيسية)',
  mobile_menu_whatsapp: 'واتساب (القائمة)',
  footer_whatsapp: 'واتساب (الفوتر)',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ar-JO', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type WhatsAppClickRow = {
  id: string;
  source: string;
  product_name: string | null;
  bundle_name: string | null;
  use_case: string | null;
  created_at: string;
};

function countBy<T extends string>(values: Array<T | null | undefined>) {
  const map = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    map.set(value, (map.get(value) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export default async function AdminAnalyticsPage() {
  await requireAdminServer();

  const supabase = createSupabaseServerClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const sevenDaysStart = new Date(now);
  sevenDaysStart.setDate(sevenDaysStart.getDate() - 6);
  sevenDaysStart.setHours(0, 0, 0, 0);

  const [todayCountResult, last7CountResult, last7EventsResult, latest20Result] = await Promise.all([
    supabase
      .from('whatsapp_click_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('whatsapp_click_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysStart.toISOString()),
    supabase
      .from('whatsapp_click_events')
      .select('source, product_name, use_case, bundle_name, created_at')
      .gte('created_at', sevenDaysStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('whatsapp_click_events')
      .select('id, source, product_name, bundle_name, use_case, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const todayCount = todayCountResult.count || 0;
  const last7Count = last7CountResult.count || 0;

  const last7Events = ((last7EventsResult.data || []) as any[]).map((row) => row as WhatsAppClickRow);
  const latest20 = ((latest20Result.data || []) as any[]).map((row) => row as WhatsAppClickRow);

  const sources = countBy(last7Events.map((e) => e.source));
  const topProducts = countBy(last7Events.map((e) => e.product_name)).slice(0, 10);

  const quickOrderEvents = last7Events.filter((e) => e.source === 'quick_order');
  const quickOrderCount = quickOrderEvents.length;
  const quickOrderUseCases = countBy(quickOrderEvents.map((e) => e.use_case));
  const topUseCase = quickOrderUseCases[0]?.key || null;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">التحليلات</h1>
        <p className="mt-1 text-sm text-muted-foreground">إحصائيات ضغطات واتساب (تجميع آمن بدون بيانات حساسة).</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">ضغطات اليوم</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MessageCircle className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 break-words text-2xl font-bold">{todayCount}</p>
        </div>

        <div className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">آخر 7 أيام</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LineChart className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 break-words text-2xl font-bold">{last7Count}</p>
        </div>

        <div className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">الطلب السريع</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MessageCircle className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 break-words text-2xl font-bold">{quickOrderCount}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            أكثر استخدام: {topUseCase ? topUseCase : '—'}
          </p>
        </div>

        <div className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">أكثر المنتجات ضغطًا</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 break-words text-2xl font-bold">{topProducts[0]?.count || 0}</p>
          <p className="mt-2 text-xs text-muted-foreground">{topProducts[0]?.key || '—'}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">المصادر (آخر 7 أيام)</h2>
              <p className="text-sm text-muted-foreground">توزيع الضغطات حسب المصدر.</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {sources.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                <p className="text-sm font-medium">{SOURCE_LABELS[item.key] || item.key}</p>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  {item.count}
                </span>
              </div>
            ))}

            {sources.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات بعد.</div>
            )}
          </div>
        </section>

        <section className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">آخر 20 ضغطة</h2>
              <p className="text-sm text-muted-foreground">أحدث الأحداث المسجّلة.</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="py-2 text-right font-medium">الوقت</th>
                  <th className="py-2 text-right font-medium">المصدر</th>
                  <th className="py-2 text-right font-medium">تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {latest20.map((event) => {
                  const details = event.product_name || event.bundle_name || event.use_case || '—';
                  return (
                    <tr key={event.id} className="border-b last:border-0">
                      <td className="py-3 text-muted-foreground">{formatDateTime(event.created_at)}</td>
                      <td className="py-3 font-medium">{SOURCE_LABELS[event.source] || event.source}</td>
                      <td className="py-3">{details}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {latest20.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">لا توجد بيانات بعد.</div>
          )}
        </section>
      </div>

      <section className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">أكثر المنتجات (آخر 7 أيام)</h2>
            <p className="text-sm text-muted-foreground">المنتجات الأكثر ضغطًا على واتساب.</p>
          </div>
          <Link href="/products" className="text-sm font-medium text-primary hover:underline">
            فتح المتجر
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {topProducts.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-md border px-3 py-2">
              <p className="text-sm font-medium">{item.key}</p>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                {item.count}
              </span>
            </div>
          ))}

          {topProducts.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground md:col-span-2">لا توجد بيانات بعد.</div>
          )}
        </div>
      </section>
    </div>
  );
}
