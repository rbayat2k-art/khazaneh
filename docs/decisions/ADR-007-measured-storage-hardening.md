# ADR-007 — دوام و ظرفیت ذخیره‌سازی، نامزد محلی ۲۰۲۶/۱۰/۲۱

وضعیت فعلی: **Accepted/Deployed v28،۲۰۲۶/۱۰/۲۲**؛ SQLite فعال شد. مرجع نسخه/آزمون و محدودیت‌ها [Baseline](../engineering/BASELINE.md) و بخش بالای [production-hardening](../operations/production-hardening.md) است. بخش‌های v22 و پایین سوابق تصمیم/آزمون‌اند؛ ادعای «Production هنوزJSONاست» در آن‌ها تاریخی است، نه وضعیت فعلی. محصول فعال Git ندارد؛ هویت آن manifest است. این به‌روزرسانی فقط سند است و انتشار تازه‌ای انجام نمی‌دهد.

checkpoint جاری **v22،۲۲اکتبر** بر سوابق پایین مقدم است: manifest=`6c160ee10eaf9a53bdce3f90fb8df6a045a0cc0f7beb1cee350ccc51dd5ba270`؛۱۷۰تست هرadapter،۱۷UI/APIواقعی ودو تکرارraw-onboarding PASS،tsc/build/audit۰advisory PASS. transportصفحه‌ای/delta bounded است؛مجوز جاری،baseline فقطdiff وstateعملیاتی کلاینت فقطحافظه. selection/ID/delta فقط باproof ورودیimmutable/currentselection بازاستفاده می‌شوند،نهauth/session/filedecision. cacheمشتقID یک بودجه مستقلِ **مجموع۱۲۰kارجاع/حداکثر۶۴entry** دارد؛proofمثبتreceiptها Weak وفقط مالیِ branded است،نهpermission/manual/fullgrant. shutdown پسHTTPclose نیزtail وbackgroundwrites راdrain می‌کند. فشار کاملWindows ثبت۴٫۴۲۹/read۱٫۵۰۱s PASS؛**Linux ثبت۵٫۴۶۰/read۲٫۳۱۹s FAIL**؛cold۳۰–۵۰s وکل‌graph/چندنویسنده هنوز محدودیت‌اند. PM2lab خصوصی PASS،نهfull-appcutover؛rawlive وpublisher نهایی NOT RUN. Production همان02f1/JSON وبدون تغییر؛تصمیم مالک همه داده فعلی را آزمایشی اعلام کرده وrawجداadmin با رمز ثابت محفوظ است. مهاجرت یا تعویض حدسی DB صرفاً برایسبزکردن latency انجام نشد؛ماتریس نهایی/شواهد/ادامه دقیق درproduction-hardening است.

checkpoint۲۲اکتبر: نامزد نهایی محلی015e4038،۱۲۶تست در هر دو adapter و۱۶سناریوی UI/API واقعی PASS؛ gate ظرفیت۱۰k در اجرای50a73 FAIL (ثبت deadline۱۵٫۱۹۲s و صف تا۱۴٫۰۴۲s). این تفاوت نسخه در سند وضعیت تفکیک شده و آزمون قبلی به نسخه آخر نسبت داده نمی‌شود. SQLite هنوز **فقط نامزد** است؛ Production همانJSON/02f1 باقی ماند. مرحله ناتمام، محدودکردن پاسخ کامل state و query/file contract سازگار است، نه مهاجرت زنده یا تعویض حدسی دوباره DB.

ادامه۲۲اکتبر، v13 (manifest516f5f168976): پروتکل opt-in صفحه‌ای/delta با مرز مجوز جاری، finish و بازسازی فقط حافظه کلاینت اضافه شد؛ schema/APIlegacy مالی عوض نشد. normalization بدون تغییر و ترتیب ثابتSQLite دیگر بازنویسی/Map تکراری ندارند؛ entity شرکت همچنان conjunctive است.۱۲۶تست اصلی به۱۴۲ رسیدند، همه در هر adapter PASS. فشار v12 ثبت۱۰۰/۱۰k=۳٫۹۹۳s PASS اما cold۳۴٫۷۷۷s و mixed read۲٫۰۹۲s همچنان ضعف‌اند؛ ظرفیت نهایی v13 NOT RUN. Linux22+SQLite و rollback دادهٔ جاری روی یک رکورد **مصنوعی جدا** PASS؛ Production همچنان02f1/JSON و cutover نهایی BLOCKED. جزئیات و شواهد تازه در checkpoint اصلی‌اند؛ PostgreSQL صرفاً برای دورزدن هزینه پاسخ کامل انتخاب نشده است.

## شاهد و انتخاب مرحله‌ای

پروفایل CPU ایزوله، clone/parse کل state و save کل JSON را گلوگاه نشان داد. حذف خواندن تکراری، draft خصوصی Immer، normalization افزایشی و compact JSON، p95 صدکاربر را از حدود۱۳–۱۵ به۵٫۳–۶٫۳ثانیه رساند ولی gate نوشتن۵ثانیه همچنان FAIL شد. افزایش timeout یا پاسخ پیش از commit پذیرفته نیست.

نامزد SQLite بومی Node، برای یک میزبان/یک نویسنده، هر رکورد اصلی را جدا و زیررکوردهایش را بدون تغییر قرارداد داخل JSON نگه می‌دارد. schema مالی کاملاً نرمال‌شده نیست. collectionهای ناشناخته، ترتیب، شناسه‌ها، تاریخچه و پیوست inline عیناً حفظ می‌شوند. کل تغییر collectionها/نسخه/تاریخچه/رسید در یک transaction است؛ WAL + synchronous FULL، احراز جاری در ابتدای نوبت و انتشار حافظه فقط پس از commit معتبر. نبود DB، schema ناشناخته، import نیمه‌تمام، تغییر خارجی یا کلید تکراری fail-closed هستند. fallback/reset خودکار ممنوع.

PostgreSQL برای چندمیزبان/چندنویسنده مسیر معقول بعدی است، اما بدون اندازه‌گیری و نیاز عملیاتی انتخاب نمی‌شود؛ هزینه نگهداری، مهاجرت قرارداد سرویس و cutover دارد. SQLite مشکل ارسال کل سوابق در هر پاسخ یا نگهداشت کل state در حافظه را حل نمی‌کند؛ ظرفیت رشد فقط با آزمون تعیین می‌شود، نه نام فناوری.

## مرز تغییر و بازگشت

`TREASURY_STORAGE_MODE=json|sqlite` صریح است؛ پیش‌فرض فعلی JSON. activation خودکار انجام نمی‌شود. CLI ساخته‌شده در release: `storage-cli.cjs import|export|backup ABS_SOURCE ABS_NEW_DESTINATION`. import/export قفل exclusive همان `.server-lock.json` برنامه را تا پایان دارند و در حضور هر قفل موجود متوقف می‌شوند. پیش از transfer نویسنده باید واقعاً متوقف باشد؛ قفل ناشناس/زنده را حذف نکنید. hash canonical تمام محتوا قبل/بعد یکسان است؛ تکراری‌ها merge نمی‌شوند.

Rollback بعد از نوشتن‌های جدید: توقف نویسنده → export **SQLite جاری** به JSON جدید → تطبیق کامل → تغییر کد/تنظیمات به JSON جاری → شروع/کنترل سلامت. استفاده از JSON پیش از مهاجرت باعث از دست‌رفتن ثبت‌های تازه می‌شود و ممنوع است. بکاپ WAL با API SQLite یا VACUUM INTO است، نه کپی تنها فایل اصلی. بکاپ پیش از نخستین write روز، نگهداشته می‌شود؛ بکاپ خارج میزبان و restore آزموده‌شده جایگزین آن نیستند.

## بازبینی

بازبین مستقل خواندنی، race امضای پس از COMMIT، پذیرش فایل schema-only، baseline normalization ذخیره‌نشده و نام/عمر قفل transfer را یافت؛ همگی VALID و با آزمون بازتولید/اصلاح محلی ثبت شدند. این بازبینی جای اجرای gates و تمرین cutover/rollback روی بسته نهایی را نمی‌گیرد. Node22 میزبان از `node:sqlite` پشتیبانی می‌کند، ولی آن را Experimental اعلام می‌کند؛ نتیجه Windows/Node24 اثبات هم‌ارزی Linux/Node22 نیست.
