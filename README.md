# ارتق (Ertaki)

تطبيق متابعة حفظ القرآن الكريم — جوال (Flutter) + لوحة مشرف (Next.js) + API (NestJS) + PostgreSQL/SQLite.

## المسار المحلي المفضّل (Windows)

```bat
git clone <remote-url> "D:\work stuff\Ertaki-Project"
cd /d "D:\work stuff\Ertaki-Project"
```

التطوير السحابي يعتمد على الـ git remote ولا يحتاج وصولاً لقرص Windows.

## المتطلبات

- Node.js 20+
- Flutter 3.27+ (للجوال)
- اختياري: Docker لتشغيل PostgreSQL

## التشغيل السريع (تطوير بدون أسرار)

الافتراضي: **SQLite** للـ API — لا حاجة لـ Postgres أو مفاتيح سحابية.

### 1) الواجهة الخلفية

```bash
cd api
npm install
npm run start:dev
```

API: [http://127.0.0.1:43124/api](http://127.0.0.1:43124/api)

حسابات البذور (كلمة المرور جميعاً `password123`):

| الدور | الهاتف |
|---|---|
| مشرف | `0500000001` |
| معلم | `0500000002` |
| طالب | `0500000003` |

### 2) لوحة المشرف (ويب)

```bash
cd admin
npm install
npm run dev
```

لوحة المشرف: [http://127.0.0.1:43123](http://127.0.0.1:43123)

اضبط عند الحاجة: `NEXT_PUBLIC_API_URL=http://127.0.0.1:43124/api`

### 3) تطبيق الجوال

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE=http://127.0.0.1:43124/api
```

على محاكي Android استخدم غالباً `http://10.0.2.2:43124/api`.

## PostgreSQL (اختياري)

```bash
docker compose up -d
cd api
set DB_TYPE=postgres
set DATABASE_URL=postgres://ertaki:ertaki@localhost:5432/ertaki
set TYPEORM_SYNC=true
npm run start:dev
```

## قرارات منتج مقفولة (ملخص)

- التقارير اليومية: معلم/مشرف فقط — الطلبة لا يرون تقارير الزملاء
- لا تعديل بعد الإرسال
- لا مواعيد إغلاق/تقصير زمني في MVP (النموذج جاهز لاحقاً)
- القسط لكل طالب
- عواقب التقصير من جدول الإعدادات فقط

التفاصيل: مستندات المشروع `docs/mvp-plan.md` و `docs/decisions.md`.

## هيكل المستودع

```
api/      NestJS + TypeORM (SQLite/Postgres)
admin/    Next.js supervisor console (RTL عربي)
mobile/   Flutter (Android + iOS)
docker-compose.yml
```
