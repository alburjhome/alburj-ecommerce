'use client';

import { useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getWhatsAppLink } from '@/lib/store-settings';

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

  const whatsappUrl = getWhatsAppLink(whatsappNumber);

  const message = useMemo(() => {
    const selectedUseCase = useCase || 'غير محدد';
    const selectedNeeds = needs.length ? needs : ['غير محدد'];
    const safeNotes = notes.trim() || 'لا يوجد';

    return `مرحبا، أريد تجهيز طلب من مؤسسة البرج:\n\nالاستخدام:\n${selectedUseCase}\n\nالاحتياجات:\n- ${selectedNeeds.join(
      '\n- '
    )}\n\nملاحظات:\n${safeNotes}\n\nأريد معرفة الأسعار والتوفر.`;
  }, [needs, notes, useCase]);

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
            if (!canSend) e.preventDefault();
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
