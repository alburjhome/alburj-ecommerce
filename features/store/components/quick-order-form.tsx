'use client';

import { useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getWhatsAppLink } from '@/lib/store-settings';
import { trackWhatsAppClick } from '@/lib/analytics';

type UseCase = 'البيت' | 'مطعم أو كافيه' | 'محل' | 'مكتب' | 'مطبخ' | 'كمية أو عرض';

type Need =
  | 'منظفات وورقيات'
  | 'تغليف'
  | 'بلاستيكيات'
  | 'أدوات منزلية ومطبخ'
  | 'أجهزة كهربائية'
  | 'مفروشات وبياضات'
  | 'مستلزمات مطاعم ومحلات';

const USE_CASES: UseCase[] = ['البيت', 'مطعم أو كافيه', 'محل', 'مكتب', 'مطبخ', 'كمية أو عرض'];

const NEEDS: Need[] = [
  'منظفات وورقيات',
  'تغليف',
  'بلاستيكيات',
  'أدوات منزلية ومطبخ',
  'أجهزة كهربائية',
  'مفروشات وبياضات',
  'مستلزمات مطاعم ومحلات',
];

type BundleKey = 'restaurant' | 'shop' | 'bulk' | 'kitchen' | 'home';

type SuggestedBundle = {
  key: BundleKey;
  badge: string;
  title: string;
  description: string;
  items: string[];
};

function getSuggestedBundle(input: { useCase: UseCase | null; needs: Need[] }): SuggestedBundle | null {
  const { useCase, needs } = input;
  const hasNeed = (need: Need) => needs.includes(need);

  const candidates: SuggestedBundle[] = [];

  if (useCase === 'مطعم أو كافيه' || hasNeed('تغليف') || hasNeed('مستلزمات مطاعم ومحلات')) {
    candidates.push({
      key: 'restaurant',
      badge: 'اقتراح مناسب لك',
      title: 'باقة تجهيز مطعم أو كافيه',
      description: 'مستلزمات تغليف وورقيات ومنظفات مناسبة للمطاعم والكافيهات.',
      items: ['علب تغليف', 'أكواب وأكياس', 'مناديل وورقيات', 'منظفات يومية'],
    });
  }

  if (useCase === 'محل' || hasNeed('بلاستيكيات') || hasNeed('تغليف') || hasNeed('مستلزمات مطاعم ومحلات')) {
    candidates.push({
      key: 'shop',
      badge: 'اقتراح مناسب لك',
      title: 'باقة المحلات',
      description: 'مستلزمات يومية للمحلات من تغليف وبلاستيكيات ومنظفات.',
      items: ['أكياس وتغليف', 'بلاستيكيات', 'منظفات', 'ورقيات'],
    });
  }

  if (useCase === 'كمية أو عرض' || needs.length > 3) {
    candidates.push({
      key: 'bulk',
      badge: 'اقتراح مناسب لك',
      title: 'باقة الكميات والعروض',
      description: 'اختيارات مناسبة للكميات بأسعار أفضل حسب التوفر.',
      items: ['منتجات كميات', 'عروض متاحة', 'تغليف وورقيات', 'مستلزمات حسب الطلب'],
    });
  }

  if (useCase === 'مطبخ' || hasNeed('أدوات منزلية ومطبخ')) {
    candidates.push({
      key: 'kitchen',
      badge: 'اقتراح مناسب لك',
      title: 'باقة المطبخ والبيت',
      description: 'أدوات منزلية ومستلزمات مطبخ عملية للاستخدام اليومي.',
      items: ['أدوات مطبخ', 'حافظات وتنظيم', 'بلاستيكيات منزلية', 'مستلزمات يومية'],
    });
  }

  if (useCase === 'البيت' || hasNeed('منظفات وورقيات')) {
    candidates.push({
      key: 'home',
      badge: 'اقتراح مناسب لك',
      title: 'باقة تنظيف البيت',
      description: 'منظفات وورقيات أساسية للاستخدام اليومي في المنزل.',
      items: ['منظفات يومية', 'ورقيات', 'أكياس نفايات', 'أدوات تنظيف'],
    });
  }

  if (candidates.length === 0) return null;

  const priority: BundleKey[] = ['restaurant', 'shop', 'bulk', 'kitchen', 'home'];
  return candidates.sort((a, b) => priority.indexOf(a.key) - priority.indexOf(b.key))[0] || null;
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-full border border-primary bg-primary/10 px-4 py-2 text-sm font-semibold text-primary'
          : 'rounded-full border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted'
      }
    >
      {children}
    </button>
  );
}

export function QuickOrderForm({ whatsappNumber }: { whatsappNumber: string | null }) {
  const [useCase, setUseCase] = useState<UseCase | null>(null);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [notes, setNotes] = useState('');
  const [bundleApplied, setBundleApplied] = useState(false);

  const whatsappUrl = getWhatsAppLink(whatsappNumber);

  const suggestedBundle = useMemo(() => {
    return getSuggestedBundle({ useCase, needs });
  }, [needs, useCase]);

  const message = useMemo(() => {
    const selectedUseCase = useCase || 'غير محدد';
    const selectedNeeds = needs.length ? needs : ['غير محدد'];
    const safeNotes = notes.trim() || 'لا يوجد';

    const bundleBlock = suggestedBundle
      ? `الباقة المقترحة:\n${suggestedBundle.title}\n\nتشمل:\n- ${suggestedBundle.items.join('\n- ')}\n\n`
      : '';

    return `مرحبا، أريد تجهيز طلب من مؤسسة البرج:\n\n${bundleBlock}الاستخدام:\n${selectedUseCase}\n\nالاحتياجات:\n- ${selectedNeeds.join(
      '\n- '
    )}\n\nملاحظات:\n${safeNotes}\n\nأريد معرفة الأسعار والتوفر.`;
  }, [needs, notes, suggestedBundle, useCase]);

  const whatsappHref = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(message)}` : null;

  const canSend = Boolean(whatsappHref && useCase && needs.length > 0);

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-base font-semibold">أنت تشتري لـ؟</h2>
        <p className="mt-1 text-sm text-muted-foreground">اختر خيار واحد.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {USE_CASES.map((item) => (
            <Chip key={item} active={useCase === item} onClick={() => setUseCase(item)}>
              {item}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold">ماذا تحتاج؟</h2>
        <p className="mt-1 text-sm text-muted-foreground">يمكنك اختيار أكثر من خيار.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {NEEDS.map((item) => {
            const active = needs.includes(item);
            return (
              <Chip
                key={item}
                active={active}
                onClick={() => {
                  setNeeds((prev) => (active ? prev.filter((n) => n !== item) : [...prev, item]));
                }}
              >
                {item}
              </Chip>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold">ملاحظات إضافية</h2>
        <p className="mt-1 text-sm text-muted-foreground">اختياري. مثال: اكتب الكمية أو المنتج الذي تبحث عنه</p>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-3 flex w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="مثال: أحتاج 10 علب تغليف + رول مطبخ بالجملة"
        />
      </div>

      {suggestedBundle && (
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {suggestedBundle.badge}
            </span>
          </div>
          <h3 className="text-base font-bold">{suggestedBundle.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{suggestedBundle.description}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {suggestedBundle.items.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                <span className="leading-6">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            يمكنك تعديل الطلب أو إضافة ملاحظات قبل الإرسال.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={bundleApplied}
              onClick={() => {
                const block = `الباقة المقترحة: ${suggestedBundle.title}\nتشمل:\n- ${suggestedBundle.items.join(
                  '\n- '
                )}`;
                setNotes((prev) => {
                  const trimmed = prev.trim();
                  if (!trimmed) return block;
                  if (trimmed.includes(block)) return trimmed;
                  return `${block}\n\n${trimmed}`;
                });
                setBundleApplied(true);
              }}
            >
              استخدم هذه الباقة
            </Button>
          </div>
        </div>
      )}

      {!whatsappUrl ? (
        <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
          رقم واتساب غير مفعّل حاليًا
        </div>
      ) : (
        <a
          href={canSend ? whatsappHref! : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={
            canSend
              ? 'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700'
              : 'inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground'
          }
          onClick={(e) => {
            if (!canSend) {
              e.preventDefault();
              return;
            }

            trackWhatsAppClick('quick_order', {
              use_case: useCase ?? 'غير محدد',
              needs_count: needs.length,
              has_bundle: Boolean(suggestedBundle),
            });
          }}
        >
          <MessageCircle className="h-5 w-5" />
          أرسل الطلب عبر واتساب
        </a>
      )}

      <div className="text-xs text-muted-foreground">
        ملاحظة: لا يتم حفظ أي بيانات — سيتم إرسال طلبك مباشرة عبر واتساب.
      </div>
    </div>
  );
}
