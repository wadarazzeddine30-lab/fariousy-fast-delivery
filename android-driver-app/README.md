# FARIOUSY Driver — مشروع تطبيق الأندرويد (APK)

هذا المشروع الجاهز يُنشئ ملف **`FARIOUSY-Driver.apk`** يشتغل مباشرة على هواتف الموزعين بصلاحيات كاملة:
- تشغيل الكاميرا مباشرة لقراءة الباركود و QR بدون قيود المتصفح أو iFrame
- تصوير مشاكل التوصيل وإرسالها للمدير
- فتح واتساب والاتصال الهاتفي و Google Maps مباشرة
- أيقونة التطبيق الرسمية لـ **FARIOUSY FAST DELIVERY**

---

## الطريقة 1 (بدون تثبيت أي برنامج): البناء السحابي عبر GitHub Actions
1. ارفع المشروع إلى GitHub (يتضمن تلقائياً ملف `.github/workflows/build-driver-apk.yml`).
2. افتح تبويب **Actions** ثم اختر **Build FARIOUSY Driver Android APK**.
3. اضغط **Run workflow** وأدخل رابط الموقع (`https://.../?app=driver`).
4. بعد دقيقتين ستجد ملف **`app-debug.apk`** جاهزاً للتحميل وإرساله للموزعين عبر واتساب!

---

## الطريقة 2: البناء عبر Android Studio أو سطر الأوامر
1. افتح مجلد `android-driver-app` في **Android Studio**.
2. تأكد من رابط السيرفر داخل `app/build.gradle.kts` في السطر `DRIVER_APP_URL`.
3. من القائمة العلوية اختر:
   **Build → Build Bundle(s) / APK(s) → Build APK(s)**
4. أو من الطرفية (Terminal):
   ```bash
   gradle assembleDebug
   ```
   سيظهر ملف الـ APK في:
   `app/build/outputs/apk/debug/app-debug.apk`
