# کنترل انتشار v50 — ۲۰۲۶/۱۰/۲۳

مجوز جاری مالک: آزمون نهایی مهم، ذخیره آخرین نسخه آزموده‌شده در GitHub و **انتشار مشروط به عبور gateها**. این اجازه برای همین تحویل، بر محدودیت قبلی «فقط Staging» مقدم است؛ مجوز انتشار دائمی آینده یا فعال‌کردن سرویس بیرونی نیست.

## هویت

- نسخه زنده پیش از ارتقا: v28، Git `cb8b87b8f5a53e49b28f955e52e56932a2689fd4`، manifest `b26471c412d1a58c9eaa8e7ab4acb80f5c96274da0453712c1c7e6dd2a591f73`؛ بررسی تازه SSH،۳۰فایل،یک writer SQLite وgatewayonline تأیید شد.
- بسته نهایی آزموده‌شده: [manifest v50](../../releases/v50/release-manifest.json)، SHA `abd40ac3ff0a1da8fcc8e9e5a71d50d2fb5c72e455851b77c2f83826b8a7f314`،۳۸خروجی،۱۳۲منبع؛ SHA فایل منبع و SHA Git دو هویت متفاوت‌اند.
- تصمیم و اصلاحات نهایی: [ADR-017](../decisions/ADR-017-release-notification-audience-and-report-scheduling.md). اصلاحات v29–v49 و شواهد Staging قبلی محفوظ‌اند؛ دوباره از صفر پیاده‌سازی نشدند.

## شواهد پیش از انتشار

`ops = C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh`؛ فایل‌های واقعی/بکاپ‌ها/تنظیمات خصوصی عمداً در Git نیستند.

| کنترل | وضعیت | شاهد |
|---|---|---|
| TypeScript و build پایدار | PASS | npm run build؛ build-proof و sourceFiles همان بسته |
| suite کامل روی بسته نهایی | PASS | ۳۷۶ آزمون SQLite و۳۷۶ JSON؛ ops/work/release-readiness-v50-20261023/native-final-{sqlite,json}.log |
| مرورگر واقعی و API/SQLite | PASS |۱۲مسیر مهم: SMS/اعلان/نشست،گزارش،ویرایش،حذف،چندنقشی،رد،اصلاح خزانه،خارج‌سامانه،نوبت‌پرداخت،pasteفیش،retry؛ hardening-ui-readiness-v50-final و focused-final |
| شکست‌های آزمون قدیمی | FAIL | دوselector/fixture قدیمی در اجرای نخست نهایی؛ شاهد شکست محفوظ. تست حذف ازdata-record-codeجدول فعلی استفاده می‌کند؛ تست ویرایش مرکزِشرکت مجازfixtureمی‌سازد،نه اعطای ضمنی شرکت تازه. بازتست هر دو PASS؛ رفتار/assertion مالی حذف نشد. |
| routing و مجوزهای اعلان | PASS | بازتولید پیامک اشتباه روی artifact v49؛ unit/API/browser و بازبینی مستقل خواندنی، با سنجش مجوز مرحله و شرکت هنگام ارسال |
| لغو دسترسی وسط گزارش | PASS | report-concurrency-api با scheduler gate واقعی و API: لغوexport→403،logout→401،بدونreportجزئی |
| وابستگی runtime | PASS | npm audit --omit=dev،صفرآسیب‌پذیری گزارش‌شده؛ dependency-audit.json؛ نه تضمین نبود آسیب‌پذیری ناشناخته |
| Linux،۶۰کاربر مستقل+۱۰k | PASS | hardening-linux-load-readiness-v50-final-20261023؛۱٬۳۹۲درخواست،۱۵تیم چهارنقشی+۳خواننده گزارش هم‌زمان،صفرخطای غیرمنتظره/مغایرت مالی،restartوretryPASS |
| Staging دائمی | PASS | http://127.0.0.1:55120/؛ همان artifact؛gateUTF8/303/کوکیHttpOnlyStrict/admin/خروج‌ورود/۱۸asset؛ داده،رمز وvaultازv49محفوظ |
| ارتقا و rollback داده جاری | PASS | privatePM2lab v28→v50؛backup/restore مستقل و خارجسرور؛ فقط۴کلیدpermissionجدیدطبققرارداد،دیگرتمامفیلدهایکسان؛ پرداخت۵۰۰۰/مانده۷۰۰۰پسارتقا وretry409پسrollbackمحفوظ |
| انتشار Production | NOT RUN | این سند آمادگی است؛ نتیجه نهایی باید پس از انتشار به‌روزرسانی شود. |

## عملکرد و محدودیت صریح

نسخه اولیه این مرحله با همان بار۶۰نشست/۱۰k وreport، ثبتp95≈۱۵٫۸ثانیه وqueuep95≈۱۳٫۶ثانیه شکست خورد. جست‌وجوی تکراری فیش O(n²) اصلاح شد؛ محاسبه گزارش با حفظ validation/ledger به event loop فرصت می‌دهد؛ حساب تقویمی تکراری کش محدود دارد. Timeoutیاامنیت/معیار تغییر نکرد.

بسته نهایی: ثبت p50=۳۰۷۷ms،p95=۴۴۰۵ms،p99=۴۸۵۶ms؛ صفp95=۳۸۵۰ms؛ اجرایفرمانp95=۱۰۹ms؛خواندنمعمولp95=۱۱۲۸ms؛reportp95=۷۰۱۴ms؛توانموج≈۱۳٫۸درخواست/s. معیار۵ثانیه،ثبت پایدار باصفوهیدریشن است،نهACKصوری.

آغاز سرد۶۰کاربر/۱۰k،p95≈۳۰٫۹ثانیه بود و جدا گزارش شد؛ به‌عنوان ثبت سریع معرفی نمی‌شود. چهار هسته سرور ودو هسته مولد جدا،heapسرور۱GiB،خروجی شبکه مسدود وdatadirمصنوعی؛ این ظرفیت قطعی Production یا soak/۱۰۰کاربر/۱۰۰هزارسابقه/XLSXمرورگر نیست. تعدادواقعی نهایی۱۰٬۰۸۸ردیف،۱۰٬۰۲۳فیش،۱۰٬۰۳۰رویدادپرداخت بود. سقفRAM/deadlineآزمون وPIDProductionدرتماماجراثابت/سالمماندند.

## حفاظت و بازگشت

ناشرهای قدیمی raw/makeRaw برای ارتقا ممنوع‌اند. ناشر نسخه‌دار تازه `ops/tools/upgrade-preserve-v50.cjs` فقط SQLite **جاری** را نگه می‌دارد؛ schema1 تغییر نمی‌کند. قرارداد `KHZ-STATE-COMPAT-v50-001` فقط مقداردهی چهارکلیداختیارجدیدِفاقد مقدار را مجاز می‌داند: گزارش برایadmin/accounting/treasury،مدیریت/استعلام/تأییدنامبانکیفقطadmin؛falseصریح و تماماختیاراتقبلی محفوظ‌اند. بانک،مبالغ،فیش،تاریخچه،کاربر،رمز وکلید واقعی ازStagingبهProductionمنتقل نمی‌شوند.

پنجره نگهداری: pinکد/config/runtime/listener → بستنgatewayوdrain → توقفwriterباexit0وآزادشدنlease → SQLitebackupسازگار+کلtree/کد/config → restoreمستقلوdownloadخارجسرور → اجرایهمانبستهرویDBجاری → تطبیقallfieldsبه‌جزenrichmentمصوب →smoke →open/monitor. rollback کد با DB/vault **جاری** است؛ restoreبکاپقبلانتشاررویثبت‌هایجدید ممنوع. شکست/crash فقط ازintentمعتبر وPID/starttime/nonce بازیابی می‌شود و recoveryورودی را خودکار باز نمی‌کند.

پیامک و بانک واقعی در آزمون خاموش‌اند؛ ارسال واقعی پیامک و استعلام پولی Production **NOT RUN** و guard فعلی باید بدون مجوز جدید حفظ شود. PINاشتباه/OTP/کلیددرلاگ/Git/تصویرمنتشر نشد. بازبینی مستقل به معنی گواهی امنیت یا اثبات همه سناریوهای آینده نیست.
