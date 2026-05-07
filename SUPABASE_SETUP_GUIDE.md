# دليل إعداد Supabase الحقيقي

## ⚠️ هام: أمان مفتاح الخدمة (Service Role Key)

### ✅ الوضع الآمن الحالي:
- `SUPABASE_SERVICE_ROLE_KEY` **ليس** له بادئة `NEXT_PUBLIC_` → يبقى في السيرفر فقط
- `createServerClient()` يُستخدم فقط في `app/actions/checkout.ts` (Server Action)
- `lib/supabase.ts` يُصدّر `supabase` (Anon Key) للواجهة + `createServerClient` (Service Key) للسيرفر

### ❌ إذا كان المفتاح مكشوفًا:
```env
# خطأ فادح - لا تفعل هذا:
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=do-not-use-this
```

---

## 📋 ترتيب تنفيذ SQL في Supabase Editor

### الخطوة 1: تشغيل Initial Schema
**ملف:** `00000000000000_initial_schema.sql`

```sql
-- 1. التحقق من uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. إنشاء جداول بالترتيب:
-- profiles → categories → subcategories → products → product_images 
-- → product_variants → shipping_rates → orders → order_items → banners → store_settings

-- 3. إضافة البيانات الأولية:
-- - store_settings (مؤسسة البرج)
-- - shipping_rates (محافظات الأردن)

-- 4. إنشاء الدوال:
-- - generate_order_number()  ← توليد تلقائي BURJ-YYYYMMDD-XXXX
-- - update_updated_at_column()

-- 5. إنشاء Triggers للـ updated_at
```

### الخطوة 2: تشغيل RLS Policies
**ملف:** `00000000000001_rls_policies.sql`

```sql
-- 1. تفعيل RLS على جميع الجداول
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- ... إلخ

-- 2. إنشاء سياسات SELECT:
-- - Active items: متاحة للجميع
-- - All items: Admin فقط

-- 3. إنشاء سياسات INSERT/UPDATE/DELETE:
-- - Admin فقط (عبر فحص role في profiles)
```

### الخطوة 3: تشغيل Storage Buckets
**ملف:** `00000000000002_storage_buckets.sql`

```sql
-- محاولة إنشاء Buckets (قد تفشل بدون صلاحيات كافية):
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('products', 'products', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- إذا فشلت: أنشئ يدويًا من Dashboard → Storage → Buckets

-- إنشاء Storage Policies (RLS للـ Storage):
-- - SELECT: Public (true)
-- - INSERT/UPDATE/DELETE: Admin فقط
```

---

## 🔧 إنشاء Admin User

### الطريقة 1: عبر Supabase Dashboard
1. اذهب إلى Authentication → Users
2. أنشئ مستخدم جديد بالبريد وكلمة المرور
3. خذ UUID الخاص بالمستخدم
4. اذهب إلى SQL Editor ونفّذ:

```sql
INSERT INTO profiles (id, email, role, full_name, phone)
VALUES (
  'uuid-الذي-نزلته',
  'admin@example.com',
  'admin',
  'مدير النظام',
  '079xxxxxxxxx'
)
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

### الطريقة 2: عبر SQL مباشرة
```sql
-- إذا كان لديك مستخدم موجود وترقيه لأدمن
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

---

## 🧪 قائمة الاختبارات

### اختبارات Public (بدون تسجيل دخول)

| الاختبار | الكود/الخطوة | النتيجة المتوقعة |
|---------|------------|----------------|
| قراءة الأقسام النشطة | `supabase.from('categories').select('*').eq('is_active', true)` | ✅ نجاح |
| قراءة المنتجات النشطة | `supabase.from('products').select('*').eq('is_active', true)` | ✅ نجاح |
| قراءة البانرات النشطة | `supabase.from('banners').select('*').eq('is_active', true)` | ✅ نجاح |
| قراءة أسعار الشحن | `supabase.from('shipping_rates').select('*').eq('is_active', true)` | ✅ نجاح |
| إنشاء طلب جديد | استخدام Server Action `createOrder()` | ✅ نجاح + توليد order_number تلقائي |

### اختبارات Security (يجب أن تفشل)

| الاختبار | الكود/الخطوة | النتيجة المتوقعة |
|---------|------------|----------------|
| إضافة منتج بدون أدمن | `supabase.from('products').insert({...})` | ❌ 403 RLS Policy Error |
| تعديل منتج بدون أدمن | `supabase.from('products').update({...})` | ❌ 403 RLS Policy Error |
| قراءة كل الطلبات | `supabase.from('orders').select('*')` | ❌ 403 (على الأقل فارغة أو 403) |
| تعديل role لنفسك | `supabase.from('profiles').update({role: 'admin'})` | ❌ 403 RLS Policy Error |

### اختبارات Admin (يجب أن تنجح)

| الاختبار | الخطوة | النتيجة المتوقعة |
|---------|--------|----------------|
| تسجيل دخول أدمن | افتح `/admin/login` | ✅ نجاح + توجيه للـ dashboard |
| عرض Dashboard | افتح `/admin/dashboard` | ✅ يظهر بدون إعادة توجيه |
| قراءة الطلبات | من لوحة الأدمن | ✅ تظهر قائمة الطلبات |
| تعديل shipping_rates | تحديث سعر محافظة | ✅ يتم الحفظ |
| إضافة منتج | إنشاء منتج جديد | ✅ يتم الإنشاء |

### اختبارات Storage

| الاختبار | الخطوة | النتيجة المتوقعة |
|---------|--------|----------------|
| عرض صورة منتج | فتح URL مباشر | ✅ تظهر الصورة |
| رفع صورة بدون أدمن | محاولة POST | ❌ 403 Unauthorized |
| رفع صورة بأدمن | من لوحة الأدمن | ✅ ينجح |
| حذف صورة بأدمن | حذف من Storage | ✅ ينجح |

---

## 🔐 فحص أمني نهائي

### تأكد من عدم وجود Service Role في:
- [ ] أي ملف في `app/` (ما عدا `actions/`)
- [ ] أي ملف في `components/`
- [ ] أي ملف في `features/`
- [ ] أي ملف في `lib/` يُستخدم من الواجهة

### الملفات التي يجب استخدام Anon Key فقط:
- `app/admin/login/page.tsx` ✅ (يستخدم `supabase` client)
- `app/admin/dashboard/page.tsx` ✅ (يستخدم `supabase` client)
- كل components في `features/store/components/` ✅

### الملفات التي يجوز فيها Service Role:
- `app/actions/checkout.ts` ✅ (Server Action فقط)
- `app/api/` routes (إذا أنشأتها لاحقًا) ✅

---

## 📊 التقرير النهائي للاختبارات

### بعد تشغيل migrations:
```
✅ الملفات نفّذت بدون أخطاء SQL
✅ الجداول ظهرت في Table Editor
✅ RLS مفعّل على جميع الجداول
✅ Storage Buckets موجودة
```

### بعد اختبارات Public:
```
✅ قراءة Categories نجحت
✅ قراءة Products نجحت
✅ إنشاء Order نجح (مع توليد تلقائي BURJ-YYYYMMDD-XXXX)
✅ WhatsApp URL تولّد بشكل صحيح
```

### بعد اختبارات Security:
```
✅ محاولة إضافة منتج فشلت (403)
✅ محاولة قراءة Orders فشلت (فارغ أو 403)
✅ محاولة تعديل role فشلت (403)
```

### بعد اختبارات Admin:
```
✅ تسجيل دخول Admin نجح
✅ Dashboard يعمل
✅ إدارة Products/Categories تنجح
✅ Storage upload/delete يعمل
```

---

## 🆘 استكشاف الأخطاء

### مشكلة: "RLS Policy Error"
**الحل:** تأكد من تشغيل `00000000000001_rls_policies.sql` كامل

### مشكلة: "Bucket not found"
**الحل:** أنشئ Buckets يدويًا من Dashboard → Storage → New Bucket

### مشكلة: "Failed to fetch products" في checkout
**الحل:** تأكد أن:
1. المنتجات موجودة في DB
2. `is_active = true`
3. Server Action تستخدم `createServerClient()`

### مشكلة: Order number not generated
**الحل:** تأكد من تشغيل دالة `generate_order_number()` في migration

---

## 📞 للدعم

إذا واجهت أي مشكلة، افحص:
1. Console logs في المتصفح
2. Network tab (اختراعات 403 تعني مشاكل RLS)
3. Supabase Dashboard → Logs
4. SQL Editor → Try Queries مباشرة
