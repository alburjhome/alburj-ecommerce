import Link from 'next/link';
import { Phone, MapPin, Mail, Clock, Facebook, Instagram } from 'lucide-react';

interface FooterSettings {
  store_name: string;
  store_description: string | null;
  whatsapp_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
}

interface FooterProps {
  settings?: FooterSettings | null;
}

function normalizePhoneHref(value: string | null | undefined) {
  if (!value || value.includes('X')) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `tel:+${digits.startsWith('00') ? digits.slice(2) : digits}`;
}

export function Footer({ settings }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const storeName = settings?.store_name || 'مؤسسة البرج';
  const description =
    settings?.store_description ||
    'وجهتك الأولى للمنتجات البلاستيكية، الأدوات المنزلية، والأجهزة الكهربائية في الأردن.';
  const contactPhone = settings?.contact_phone || settings?.whatsapp_number || null;
  const phoneHref = normalizePhoneHref(contactPhone);
  const contactEmail = settings?.contact_email || 'info@alburj.jo';
  const address = settings?.address || 'الأردن - عمان';

  const footerLinks = {
    shop: [
      { href: '/products', label: 'جميع المنتجات' },
      { href: '/categories', label: 'الأقسام' },
      { href: '/products', label: 'العروض الخاصة' },
    ],
    support: [
      { href: '/#contact', label: 'تواصل معنا' },
      { href: '/#contact', label: 'الشحن والتوصيل' },
      { href: '/#contact', label: 'خدمة العملاء' },
    ],
  };

  return (
    <footer id="contact" className="bg-muted mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-primary">{storeName}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
            <div className="flex gap-3">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">تسوق</h4>
            <ul className="space-y-2">
              {footerLinks.shop.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">خدمة العملاء</h4>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">معلومات التواصل</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm">
                <MapPin className="h-5 w-5 text-primary shrink-0" />
                <span className="text-muted-foreground">{address}</span>
              </li>
              {phoneHref && contactPhone && (
                <li className="flex items-center gap-3 text-sm">
                  <Phone className="h-5 w-5 text-primary shrink-0" />
                  <a
                    href={phoneHref}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {contactPhone}
                  </a>
                </li>
              )}
              <li className="flex items-center gap-3 text-sm">
                <Mail className="h-5 w-5 text-primary shrink-0" />
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {contactEmail}
                </a>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <Clock className="h-5 w-5 text-primary shrink-0" />
                <span className="text-muted-foreground">السبت - الخميس: 9 ص - 7 م</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© {currentYear} {storeName}. جميع الحقوق محفوظة.</p>
            <div className="flex items-center gap-4">
              <Link href="/#contact" className="hover:text-primary transition-colors">
                سياسة الخصوصية
              </Link>
              <Link href="/#contact" className="hover:text-primary transition-colors">
                شروط الاستخدام
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
