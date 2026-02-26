# Financial Analytics SUITE (ULTRA+)

مشروع تحاليل مالية احترافي على GitHub Pages + Firebase (Auth + Firestore) **بدون أي مجلدات**.

## الملفات
- login.html
- index.html (Dashboard + Alerts + Quick Variance)
- monthly.html (تفريغ شهري + Waterfall + مقارنة شهر/ربع/نصف/سنة)
- variance.html (Variance Analysis فترتين + YoY)
- ar-ap.html (AR/AP Aging + Cohort تحصيل)
- alerts.html (إعداد قواعد التنبيهات)
- styles.css / app.js / README.md

## CSV/Excel Import
أعمدة أساسية:
- date (YYYY-MM-DD)
- type
- amount
- category (اختياري)

### أنواع P&L / Cash
sale, cogs, expense, other_income, other_expense, tax, receipt, payment

### أنواع AR/AP
ar_invoice, ar_payment, ap_invoice, ap_payment

أعمدة إضافية مفيدة:
- entity (العميل/المورد)
- due_date (للـ invoices)
- ref

## Firestore
- transactions
- settings/main (مدخلات ميزانية اختيارية)
- settings/alerts (قواعد تنبيهات)

## GitHub Pages
ارفع كل الملفات إلى جذر الريبو ثم فعّل Pages من main/root.
