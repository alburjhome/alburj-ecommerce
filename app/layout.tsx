import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'مؤسسة البرج - منتجات بلاستيكية وأدوات منزلية',
  description: 'مؤسسة البرج - وجهتك الأولى للمنتجات البلاستيكية، الأدوات المنزلية، والأجهزة الكهربائية في الأردن. توصيل سريع، أسعار مميزة، وخدمة ممتازة.',
  keywords: 'مؤسسة البرج, منتجات بلاستيكية, أدوات منزلية, أجهزة كهربائية, الأردن, تسوق اونلاين',
  openGraph: {
    title: 'مؤسسة البرج - منتجات بلاستيكية وأدوات منزلية',
    description: 'وجهتك الأولى للمنتجات البلاستيكية، الأدوات المنزلية، والأجهزة الكهربائية في الأردن',
    type: 'website',
    locale: 'ar_JO',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <body className={`${cairo.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
