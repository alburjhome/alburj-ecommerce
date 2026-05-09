import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { AnalyticsScripts } from '@/components/analytics-scripts';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'مؤسسة البرج - منتجات بلاستيكية وأدوات منزلية',
  description: 'مؤسسة البرج - وجهتك الأولى للمنتجات البلاستيكية، الأدوات المنزلية، والأجهزة الكهربائية في الأردن. توصيل سريع، أسعار مميزة، وخدمة ممتازة.',
  keywords: 'مؤسسة البرج, منتجات بلاستيكية, أدوات منزلية, أجهزة كهربائية, الأردن, تسوق اونلاين',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'مؤسسة البرج - منتجات بلاستيكية وأدوات منزلية',
    description: 'وجهتك الأولى للمنتجات البلاستيكية، الأدوات المنزلية، والأجهزة الكهربائية في الأردن',
    type: 'website',
    locale: 'ar_JO',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('store_settings')
    .select('meta_pixel_id, ga4_measurement_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const settings = data as { meta_pixel_id: string | null; ga4_measurement_id: string | null } | null;

  const metaPixelId = settings?.meta_pixel_id ?? null;
  const ga4MeasurementId = settings?.ga4_measurement_id ?? null;

  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <body className={`${cairo.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AnalyticsScripts metaPixelId={metaPixelId} ga4MeasurementId={ga4MeasurementId} />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
