import Link from 'next/link';
import { LineChart, MessageCircle, Package, MousePointerClick } from 'lucide-react';
import { requireAdminServer } from '@/lib/admin-auth-server';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';
import { WHATSAPP_CLICK_SOURCE_LABELS_AR } from '@/lib/analytics-labels';

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
  product_slug: string | null;
  bundle_name: string | null;
  use_case: string | null;
  needs_count: number | null;
  has_bundle: boolean | null;
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

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function normalizeRange(value: unknown): 'today' | '7d' | '30d' {
  if (value === 'today') return 'today';
  if (value === '30d') return '30d';
  return '7d';
}

function rangeLabel(value: 'today' | '7d' | '30d') {
  if (value === 'today') return 'اليوم';
  if (value === '30d') return 'آخر 30 يوم';
  return 'آخر 7 أيام';
}

function sourceLabel(source: string) {
  return WHATSAPP_CLICK_SOURCE_LABELS_AR[source] || source;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminServer();

  const supabase = createSupabaseServerClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const sevenDaysStart = new Date(now);
  sevenDaysStart.setDate(sevenDaysStart.getDate() - 6);
  sevenDaysStart.setHours(0, 0, 0, 0);

  const thirtyDaysStart = new Date(now);
  thirtyDaysStart.setDate(thirtyDaysStart.getDate() - 29);
  thirtyDaysStart.setHours(0, 0, 0, 0);

  const sp = (await searchParams) || {};
  const range = normalizeRange(Array.isArray(sp.range) ? sp.range[0] : sp.range);
  const rangeStart = range === 'today' ? todayStart : range === '30d' ? thirtyDaysStart : sevenDaysStart;

  const [todayCountResult, last7CountResult, last30CountResult, rangeEventsResult, latest20Result] =
    await Promise.all([
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
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysStart.toISOString()),
      supabase
        .from('whatsapp_click_events')
        .select('id, source, product_name, product_slug, use_case, needs_count, has_bundle, bundle_name, created_at')
        .gte('created_at', rangeStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000),
      supabase
        .from('whatsapp_click_events')
        .select('id, source, product_name, product_slug, bundle_name, use_case, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

  const todayCount = todayCountResult.count || 0;
  const last7Count = last7CountResult.count || 0;
  const last30Count = last30CountResult.count || 0;

  const rangeEvents = ((rangeEventsResult.data || []) as any[]).map((row) => row as WhatsAppClickRow);
  const latest20 = ((latest20Result.data || []) as any[]).map((row) => row as WhatsAppClickRow);

  const totalRange = rangeEvents.length;
  const sources = countBy(rangeEvents.map((e) => e.source));
  const bestSource = sources[0]?.key || null;
  const bestSourceCount = sources[0]?.count || 0;

  const productCounts = new Map<string, { name: string; slug: string | null; count: number }>();
  for (const event of rangeEvents) {
    const name = event.product_name?.trim();
    if (!name) continue;
    const existing = productCounts.get(name);
    const slug = event.product_slug || existing?.slug || null;
    const next = { name, slug, count: (existing?.count || 0) + 1 };
    productCounts.set(name, next);
  }
  const topProducts = Array.from(productCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const topProduct = topProducts[0] || null;

  const quickOrderEvents = rangeEvents.filter((e) => e.source === 'quick_order');
  const quickOrderCount = quickOrderEvents.length;
  const quickOrderUseCases = countBy(quickOrderEvents.map((e) => e.use_case));
  const topUseCase = quickOrderUseCases[0]?.key || null;
  const quickOrderNeedsCounts = countBy(quickOrderEvents.map((e) => (e.needs_count === null ? null : String(e.needs_count))));
  const topNeedsCount = quickOrderNeedsCounts[0]?.key || null;
  const quickOrderHasBundleCount = quickOrderEvents.filter((e) => e.has_bundle === true).length;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">التحليلات</h1>
        <p className="mt-1 text-sm text-muted-foreground">إحصائيات ضغطات واتساب (تجميع آمن بدون بيانات حساسة).</p>
      </div>

      <div className="flex flex-wrap items-center gap-2" dir="rtl">
        <Link
          href={{ pathname: '/admin/analytics', query: { range: 'today' } }}
          className={
            range === 'today'
              ? 'rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'
              : 'rounded-full border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted'
          }
        >
          اليوم
        </Link>
        <Link
          href={{ pathname: '/admin/analytics', query: { range: '7d' } }}
          className={
            range === '7d'
              ? 'rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'
              : 'rounded-full border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted'
          }
        >
          آخر 7 أيام
        </Link>
        <Link
          href={{ pathname: '/admin/analytics', query: { range: '30d' } }}
          className={
            range === '30d'
              ? 'rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'
              : 'rounded-full border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted'
          }
        >
          آخر 30 يوم
        </Link>
        <span className="text-xs text-muted-foreground">({rangeLabel(range)})</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
            <p className="min-w-0 text-sm text-muted-foreground">آخر 30 يوم</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LineChart className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 break-words text-2xl font-bold">{last30Count}</p>
        </div>

        <div className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">ضغطات Quick Order</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MessageCircle className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 break-words text-2xl font-bold">{quickOrderCount}</p>
          <p className="mt-2 text-xs text-muted-foreground">الفترة: {rangeLabel(range)}</p>
        </div>

        <div className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">أفضل مصدر</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MousePointerClick className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 break-words text-2xl font-bold">{bestSourceCount}</p>
          <p className="mt-2 text-xs text-muted-foreground">{bestSource ? sourceLabel(bestSource) : '—'}</p>
        </div>

        <div className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">أكثر منتج ضغطًا</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 break-words text-2xl font-bold">{topProduct?.count || 0}</p>
          <p className="mt-2 text-xs text-muted-foreground">{topProduct?.name || '—'}</p>
        </div>
      </div>

      {totalRange === 0 && (
        <div className="rounded-lg border bg-card p-10 text-center">
          <p className="text-sm font-semibold">لا توجد ضغطات واتساب ضمن هذه الفترة.</p>
          <p className="mt-2 text-xs text-muted-foreground">اختر فترة أخرى أو جرّب بعد وصول زيارات للموقع.</p>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">أفضل مصادر الضغطات</h2>
              <p className="text-sm text-muted-foreground">{rangeLabel(range)} - حسب المصدر مع النسبة.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {sources.map((item) => {
              const pct = percent(item.count, totalRange);
              return (
                <div key={item.key} className="rounded-md border px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 text-sm font-semibold">{sourceLabel(item.key)}</p>
                    <div className="shrink-0 text-xs text-muted-foreground">{pct}%</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                    <span className="ml-2 shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      {item.count}
                    </span>
                  </div>
                </div>
              );
            })}

            {sources.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                لا توجد ضغطات واتساب ضمن هذه الفترة.
              </div>
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
            <table className="w-full min-w-[660px] text-sm">
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
                      <td className="py-3 font-medium">{sourceLabel(event.source)}</td>
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
            <h2 className="text-lg font-semibold">أفضل المنتجات</h2>
            <p className="text-sm text-muted-foreground">{rangeLabel(range)} - المنتجات الأكثر ضغطًا على واتساب.</p>
          </div>
          <Link href="/products" className="text-sm font-medium text-primary hover:underline">
            فتح المتجر
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="py-2 text-right font-medium">المنتج</th>
                <th className="py-2 text-right font-medium">الضغطات</th>
                <th className="py-2 text-right font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((item) => (
                <tr key={item.name} className="border-b last:border-0">
                  <td className="py-3 font-medium">{item.name}</td>
                  <td className="py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      {item.count}
                    </span>
                  </td>
                  <td className="py-3">
                    {item.slug ? (
                      <Link
                        href={`/product/${item.slug}`}
                        className="inline-flex items-center justify-center rounded-md border bg-card px-3 py-1 text-xs font-semibold hover:bg-muted"
                      >
                        فتح المنتج
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {topProducts.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">لا توجد بيانات ضمن هذه الفترة.</div>
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">أداء Quick Order</h2>
            <p className="text-sm text-muted-foreground">{rangeLabel(range)} - تحليل مبسط لصفحة جهّز طلبك.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">عدد الضغطات</p>
            <p className="mt-2 text-2xl font-bold">{quickOrderCount}</p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">أكثر use_case</p>
            <p className="mt-2 text-base font-semibold">{topUseCase || '—'}</p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">الأكثر شيوعًا (needs_count)</p>
            <p className="mt-2 text-base font-semibold">{topNeedsCount ? `${topNeedsCount}` : '—'}</p>
          </div>
        </div>

        <div className="mt-4 rounded-md border p-4">
          <p className="text-sm font-semibold">باقة ضمن Quick Order</p>
          <p className="mt-2 text-sm text-muted-foreground">
            ضغطات تحتوي `has_bundle=true`:
            <span className="mr-2 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
              {quickOrderHasBundleCount}
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}
