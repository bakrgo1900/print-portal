# Print Portal — بوابة الطباعة الذاتية

> منصة طباعة ذاتية تعتمد على QR Code — يسكان العميل الكود، يرفع ملفاته، يدفع، وتتم الطباعة أوتوماتيكياً.

---

## نظرة عامة

**Print Portal** هو تطبيق ويب متكامل يُمكّن أصحاب مراكز الطباعة من تقديم خدمة طباعة ذاتية بالكامل دون تدخل بشري. يُثبَّت على كل جهاز طباعة كود QR خاص به، وعند مسحه يُفتح للعميل مباشرةً نموذج رفع الملفات.

---

## كيف يعمل النظام

```
العميل يمسح QR Code
        ↓
يفتح صفحة الرفع مباشرة على موبايله
        ↓
يدخل اسمه ورقم موبايله
        ↓
يرفع الملفات (PDF / Word / صور)
        ↓
النظام يحسب عدد الصفحات والتكلفة تلقائياً
        ↓
العميل يراجع الملخص ويدفع
        ↓
يصل تأكيد الدفع → تُرسَل مهمة الطباعة للجهاز المحدد
        ↓
تتم الطباعة أوتوماتيكياً عبر PrintNode
```

---

## المميزات الرئيسية

### للعميل (User Portal)
- فتح مباشر لصفحة الرفع عند مسح QR — بدون تسجيل دخول
- إدخال الاسم ورقم الموبايل فقط
- رفع ملفات متعددة: PDF، Word (.docx)، JPG، PNG
- عد الصفحات تلقائياً لكل ملف
- تحديد عدد النسخ لكل ملف بشكل مستقل
- ملخص كامل للطلب قبل الدفع (الملفات، الصفحات، النسخ، الإجمالي)
- تتبع حالة الطباعة: `pending → paid → printing → done`

### للأدمن (Admin Panel)
- إدارة أجهزة الطباعة (إضافة / تعديل / حذف)
- توليد QR Code لكل جهاز مع عرض الرابط المشفر
- تحديد سعر الصفحة لكل جهاز بشكل مستقل
- لوحة تحكم بالإحصائيات: إجمالي الطلبات، الإيرادات، الحالات
- قائمة كاملة بجميع مهام الطباعة مع إمكانية التصفية
- إعدادات PrintNode API Key لربط الطابعات

---

## التقنيات المستخدمة

| الطبقة | التقنية |
|--------|---------|
| **Frontend** | React 19 + TypeScript + Tailwind CSS 4 |
| **Backend** | Node.js + Express 4 + tRPC 11 |
| **Database** | MySQL 8 + Drizzle ORM |
| **Auth** | JWT + Manus OAuth (للأدمن فقط) |
| **File Storage** | S3-compatible storage |
| **Page Counting** | pdf-parse (PDF) + mammoth (DOCX) |
| **Print Dispatch** | PrintNode API |
| **QR Generation** | qrcode npm package |
| **Build Tool** | Vite 7 + esbuild |
| **Testing** | Vitest (22 tests) |

---

## هيكل المشروع

```
printportal/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx              # الصفحة الرئيسية
│   │   │   ├── PrintSession.tsx      # صفحة العميل (رفع + دفع)
│   │   │   ├── JobStatus.tsx         # تتبع حالة الطباعة
│   │   │   └── admin/
│   │   │       ├── AdminLayout.tsx   # تخطيط لوحة الأدمن
│   │   │       ├── AdminDashboard.tsx
│   │   │       ├── AdminDevices.tsx  # إدارة الأجهزة + QR
│   │   │       ├── AdminJobs.tsx     # قائمة مهام الطباعة
│   │   │       ├── AdminJobDetail.tsx
│   │   │       └── AdminSettings.tsx # إعدادات PrintNode
│   │   └── App.tsx                   # التوجيه
│
├── server/                    # Node.js Backend
│   ├── routers.ts             # tRPC procedures (API)
│   ├── db.ts                  # Database query helpers
│   ├── uploadRouter.ts        # File upload endpoint (multer)
│   ├── paymentWebhook.ts      # Payment webhook handler
│   ├── printnode.ts           # PrintNode API integration
│   ├── pageCounter.ts         # PDF/DOCX/Image page counting
│   └── _core/                 # Framework core (OAuth, tRPC, Vite)
│
├── drizzle/
│   └── schema.ts              # Database schema
│
└── shared/                    # Shared types & constants
```

---

## روابط الصفحات

| الصفحة | الرابط | الوصول |
|--------|--------|--------|
| الصفحة الرئيسية | `/` | عام |
| بوابة الطباعة (QR) | `/print/:qrToken` | عام |
| تتبع الطلب | `/status/:sessionToken` | عام |
| لوحة الأدمن | `/admin` | أدمن فقط |
| إدارة الأجهزة | `/admin/devices` | أدمن فقط |
| مهام الطباعة | `/admin/jobs` | أدمن فقط |
| الإعدادات | `/admin/settings` | أدمن فقط |

---

## إعداد PrintNode

1. سجّل حساباً مجانياً على [printnode.com](https://printnode.com)
2. ثبّت الـ PrintNode client على جهاز Windows المتصل بالطابعة
3. انسخ الـ API Key من لوحة تحكم PrintNode
4. أدخله في `/admin/settings` في التطبيق
5. عند كل طلب مدفوع، يُرسَل الملف تلقائياً للطابعة المحددة

---

## بوابة الدفع

النسخة الحالية (MVP) تعمل بـ **تأكيد يدوي** للدفع.
لربط بوابة دفع حقيقية، يكفي إرسال POST request لـ:

```
POST /api/payment/webhook
Content-Type: application/json

{
  "sessionToken": "...",
  "status": "paid",
  "transactionId": "..."
}
```

يدعم التطبيق: **Paymob** / **Fawry** / **Stripe** — الـ webhook endpoint جاهز.

---

## الاختبارات

```bash
pnpm test
# 22 tests passing ✅
```

---

## الترخيص

MIT License — مشروع مفتوح المصدر.
