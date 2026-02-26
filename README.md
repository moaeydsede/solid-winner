# Financial Analytics SUITE (PRO+)

نسخة **Accounting‑Grade** بقاعدة بيانات احترافية + تقارير CFO جاهزة للطباعة + Multi‑currency + Period Close.

## الدخول
- Email: `admin@acc.local`
- Password: `Admin123`
- Admin UID: `46iC2fVDFEcP2mF859JyNyshpDz1`

## الشاشات (من ☰)
### Legacy (متوافق مع النسخة السابقة)
- Dashboard (KPIs من collection: transactions)
- تسجيل البيانات (CRUD)

### PRO+ Accounting Engine v2
- **CFO Reports**: P&L / Balance Sheet / Cash Flow + Waterfall + Drill‑down + Export PDF/Excel
- **Chart of Accounts (COA)**
- **Documents** (Invoices/Vouchers) + Document Lines + Auto‑post Journal Entries
- **Period Close**: إقفال شهري يمنع أي تعديل على الفترة (Client + Firestore Rules)
- **FX Rates**: Multi‑currency + أسعار صرف
- **Budgets**: Import ميزانية + Budget vs Actual
- **Alerts PRO**: Acknowledged / Snooze + alerts_log

## هيكلة قاعدة البيانات (Firestore)
كل البيانات تحت:
`companies/{companyId}/...`

- `chartOfAccounts`
- `journalEntries` + `journalEntries/{id}/lines`
- `documents` + `documents/{id}/documentLines`
- `customers` / `suppliers`
- `periodClosings`
- `exchangeRates`
- `budgets` + `budgets/{id}/lines`
- `alerts` + `alerts_log`

> ملاحظة: تم ترك `transactions` للـ Legacy فقط.

## GitHub Pages
ارفع كل الملفات في جذر الريبو (بدون مجلدات) ثم فعّل Pages من main / root.
ابدأ من:
- `login.html`

## ملفات Firebase المهمة
- `firestore.rules` (Rules + Period Close lock)
- `firestore.indexes.json` (Indexes)

## PWA / Offline
- `manifest.json` + `service-worker.js` + `pwa.js`
- Firestore offline persistence مفعّل Best‑effort

