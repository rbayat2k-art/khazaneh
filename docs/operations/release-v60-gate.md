# درخواست انتشار v60 — BLOCKED، نه DEPLOYED

تاریخ۲۰۲۶/۱۰/۲۵. مالک ذخیرهٔ نسخهٔ جاری دامنه در GitHub، سپس انتشار آخرین Stage و بررسی کد را صریحاً خواست. مجوز انتشار موجود است، اما گیت صحیح بودن candidate برقرار نیست؛ Production stop/install/restart/config-write/data-write انجام نشد. پیشنهاد رفع یافته‌ها، مجوز اصلاح یا پذیرش ضمنی ریسک نیست.

## ۱. نسخه‌ها و محدوده

Production با SSH خواندنی و تطبیق تمام خروجی‌ها، v57b با manifest=`309c04c79a22058188487f07b6a283e3793e0497e01054f6252ca0f680a19b21` تأیید شد. Stage v60 همچنان RUNNING با manifest=`1f7e43279cd0985cfbf3b0b5b6dafd5b44c36ea7ffdaa34bf4cff08a9d582c9f` است. [تحویل Stage](staging-v60-windows-json.md) مرجع گیت۴۷۸تایی هر adapter، نه ادعای پوشش عیوب شناخته‌شده است.

## ۲. ذخیره GitHub — PASS

[Release v57b](https://github.com/rbayat2k-art/khazaneh/releases/tag/v57b)، commit=`7e5b48e19834524a53e53cb057301a311425691c`، شاخه `codex/production-v57b-snapshot`، annotated tag=`v57b`. parent همان main موجود `6d5882b5d27a8f600b714cb4d1f3c97831cb7bc6` است؛ بدون force، تغییر main، checkout یا stageکردن تغییرات dirty مالک. SHA tag object=`add6df63aff4181c4906c6c60a00fd3f3cac8f62`. refهای remote و target release با commit تأیید شدند.

منبع کامل از `ops/work/bank-catalog-v57-20261024/source-deploy`، نه handover-final ناقص و نه checkout جدیدv60، انتخاب شد. هر۱۱۳منبع manifest و۱۳۸ورودی build-proof دقیقاً برابر؛ تست/سند از همان source-deploy هستند و build-input هش‌شده معرفی نمی‌شوند.۲۸۹فایل عمومی شامل manifest و یادداشت snapshot با Git index مستقل و hash-object بدون تبدیل newline ذخیره شدند؛ payload واقعی commit با blobهای انتخابی برابر است. داده، vault، کلید، رمز، session، فیش واقعی، node_modules و privateops خارج‌اند. بررسی مستقل source/template/image و scan محدود، secret/PII واقعی تأییدشده نیافت؛ literalهای آزمون منفی FALSE POSITIVE بودند، نه مجوز انتشار داده واقعی.

ZIP همان۳۷خروجی frozen + manifest، بدون rebuild، با تک‌تک entryها تطبیق شد. SHA256=`cacc01410432b45c192099bd8276bf98b51d7cd2bf06485ef1687aeba332e0ab` و اندازه۱۷۲۱۴۰۶بایت؛ digest asset GitHub نیز برابر است. این snapshot کد/بسته است، نه بکاپ دیتابیس.

## ۳. گیت تشخیصی تازه — FAIL / VALID

بازتولید روی **همان artifact v60**، SQLite مستقل، پورت۵۵۲۵۰، داده/کاربر مصنوعی و خروجی بیرونی مسدود انجام شد. نه Stage و نه Production رکورد آزمایشی نگرفتند. شاهد خصوصی `ops/work/release-v60-20261025/ui-release-blockers/result.json`:

- F01: دو چرخه برگشت برای اصلاح؛ نسخه۲/مبلغ مصنوعی۱۳۰۰۰ وجود داشت. فرم کهنه با expectedVersion۱/مبلغ۱۱۰۰۰ باید409 می‌شد، اما200 شد و نسخه۳ با مبلغ۱۱۰۰۰ ثبت شد؛ lost update تأیید شد. پرداخت نهایی یا عبور از تأیید ادعا نمی‌شود، اما اصلاح جدیدتر از دست می‌رود.
- F03: DTO خزانه canExportReports=false بود؛ مرورگر واقعی همچنان XLSX عملیاتی دانلود کرد. این مسیر محلی است، نه bypass endpoint گزارش سرور؛ افشای داده پنهان یا شرکت غیرمجاز ثابت نشده، اما لغو اختیار خروجی رعایت نمی‌شود.

این دو در v57b نیز موجود بودند و regression جدید v60 نیستند؛ قدمت به معنی پذیرش ریسک نیست. مرور مستقل آن‌ها را VALID و نیازمند رفع یا تصمیم آگاهانهٔ صریح دانست. F02/F04/F05 قدیمی نیز رفع‌شده معرفی نمی‌شوند. [بررسی کد](../engineering/code-review-v60.md) دامنه و اولویت را توضیح می‌دهد.

## ۴. وضعیت live و حفاظت

preflight و final-readonly در06:50:05Z و06:57:28Z: همان manifest/تمام فایل‌ها، configSHA=`53b736e509460e9cb0a55138b3af08fa5a03ed67159c62b7e9e0184cde31117f` و همان PIDهای backend2446750/gateway2447026؛ PM2 online، SQLite/schema۱ و quick_check=ok، صفر inquiry منتظر. اطلاعات و credential در خروجی چاپ نشد. نشست معتبر مدیر برای smoke خواندنی موجود نبود؛ این مجوز ساخت token، تغییر رمز یا احیای حساب نیست. این بررسی خواندنی سلامت کامل یا ورود کاربر را اثبات نمی‌کند.

هیچ maintenance/cutover یا بکاپ انتقالی جدید Production شروع نشد؛ بکاپ‌های قبلی محفوظ‌اند. source/رمز/نقش/داده/vault/config جاری تغییر نکردند. فقط Git object/ref/public release و شواهد/اسناد محلی ساخته شدند.

## ۵. recovery لازم پیش از ادامه

حداقل تمرین Linux برای candidate اصلاح‌شده: همان artifact، SQLite واقعیِ مستقل، شبکه بیرونی بسته، backup→restore مستقل، برابری کامل اطلاعات/credential/access، startup و write→restart→read؛ ماتریس مرتبط کارباز/مسیرهای نوعی/حساب مبدأ مشترک. Windows PASS جای این تمرین نیست.

rollback سادهٔ binary به v57b پس از اولین نوشتن جدید امن فرض نشود: v57b metadata شرکت manual را مستقل از صاحب حساب نمی‌خواند و override مسیر نوعی را اجرا نمی‌کند. schema۱ به‌تنهایی سازگاری معنایی نیست. recovery باید maintenance و roll-forward سازگار با CURRENT state/vault باشد؛ روشن‌کردن DB منجمد root قبلی یا restore بکاپ قدیمی روی ثبت‌های تازه ممنوع است.

## ۶. ادامهٔ پیشنهادی

ابتدا مجوز اصلاح F01/F03؛ تغییرهای کوچک با تست RED/denied/race/reload، Stage تازه و پذیرش مالک برای همان candidate. سپس تمرین Linux، بکاپ جاری/restore مستقل و انتشار با gateهای کامل. پاک‌سازی کد مرده با اصلاح این دو یا انتشار مخلوط نشود. این رکورد برای ادامهٔ کار است، نه درخواست تکراری مجوز انتشار v60 بدون تغییر.

## ۷. NOT RUN / محدودیت

اصلاح محصول، نصب/حذف dependency، پاک‌سازی کد، Linux rehearsal تازه، Production deployment/backup-transfer/post-deploy smoke، تماس واقعی و pressure/soak تازه: NOT RUN. چون انتشار متوقف شد، ممیزی بعدِ انتشار انجام‌شده معرفی نمی‌شود؛ بررسی اولیهٔ کد قبل از ادامه ثبت شد. هیچ تضمین صفر باگ یا ممیزی کامل امنیت/کد ارائه نمی‌شود.
