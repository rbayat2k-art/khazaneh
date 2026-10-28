# v57 — فهرست بانک حساب‌های مبدأ و اکسل

## دامنهٔ مصوب

مالک۲۰۲۶/۱۰/۲۴ صریحاً خواست تمام بانک‌های فایل حساب‌های بانکی پذیرفته شوند؛ تست و انتشار همین تغییر با حفظ داده مجاز است. شبای ناقص ردیف۳۷ را مالک اصلاح می‌کند؛ داده یا شناسه حدس زده/تغییر داده نمی‌شود. فایل واقعی هرگز وارد fixture، Git، قالب عمومی یا آزمون سرور نمی‌شود.

مبنای Production همان v55 با manifest=`86778ed21002a4d1ec37f63c59a2074452b5085e62b06b42829f7598cf0a7566` است. source انتشار از snapshot معتبر و restoreشده v55 در `ops/work/production-v55-20261024/handover-final` ساخته می‌شود؛ v56 کارهای باز هنوز فقط Staging و **خارج از مجوز این انتشار** است. تغییرات فعال/داده/رمز/مجوزهای آن حفظ می‌شوند. شاخه کار `codex/bank-catalog-v57`؛ commit/push مجوز تازه ندارد.

## رفتار و حفاظت

فهرست۱۳گزینه قبلی با همان ترتیب/پیش‌فرض حفظ و۱۲نام فایل افزوده می‌شوند؛ این کاتالوگ نمایش/ورود حساب است، نه مرجع صدور مجوز بانکی یا تغییر provider. بلوبانک مستقل از سامان می‌ماند. aliasهای مشخصِ کوتاه/رسمی، فاصله و ی/ک، در importer و مقایسه هویت دوطرفه شناخته می‌شوند؛ fuzzy یا بانک ناشناخته پذیرفته نمی‌شود. رکورد قدیمی، نام، شماره‌ها، پیش‌فرض و روابطش خودکار بازنویسی نمی‌شوند. فرم ویرایش برای مقدار تاریخیِ خارج catalogue گزینه همان مقدار را نگه می‌دارد؛ بانک اول جای آن نمایش داده نمی‌شود.

قرارداد۱۳ستون،۱تا۲۰۰ردیف،Text،اعتبارسنجی شبا/کارت/شماره،مجوزهای جاری، preview بدون نوشتن، CAS و ثبت همه‌یا‌هیچ تغییر نمی‌کنند. template عمومی خالی است و همان۲۵گزینه را دارد. هیچ import واقعی یا تغییر نقش/مبلغ/پرداخت خودکار انجام نمی‌شود. schema SQLite۱ ثابت و migration/reset لازم نیست.

یک finding معتبر بازبین درباره تغییر alias در جمع روکش، با حذف چهار تغییر نامرتبط UI بسته شد؛ محاسبات و ثبت روکش عین مبنا ماندند. فقط فیلتر خواندنی completed و گزینه تاریخی فرم، کنار catalogue و duplicate identity تغییر دارند. بازبین تست اجرا نکرد.

## گیت و شاهد

`ops=C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh`؛ work=`ops/work/bank-catalog-v57-20261024`؛ source مستقل=`work/source-deploy`. گزارش scope، نسخه منجمد، RED/Regression، مرورگر، Linux CURRENT-data rollback، بکاپ/restore، انتشار و health نهایی اینجا لینک/ثبت شوند. **PASS فقط با اجرای واقعی و هویت همان بسته**؛ این بخش به‌تنهایی ادعای انتشار نیست.

معیار: هر۲۵نام و aliasهای فایل در preview/commit مصنوعی پذیرفته؛ Blu≠Saman؛ تکراری رسمی/کوتاه با/بدون شبا/کارت بدون تغییر قبلی؛ تعارض/ناشناس/شبا ناقص/مجوز/نسخه نامعتبر رد؛ template خالی/Text/ستون/validation صحیح؛ reload و فرم قدیمی محفوظ. انتشار به توقف/drain، بکاپ سازگار و restore مستقل داخل/خارج سرور، برابری کامل state در startup و بازگشت با **DB/vault جاری** نیاز دارد، نه restore snapshot قدیمی روی نوشته‌های تازه.

## نتیجهٔ نهایی — PASS / DEPLOYED، v57b

نسخهٔ نهایی در `2026-10-24T17:11:04.172Z` (۲۰:۴۱:۰۴ تهران) روی `https://shahrahsystem.ir` باز شد؛ manifest=`309c04c79a22058188487f07b6a283e3793e0497e01054f6252ca0f680a19b21`، کد `/home/shahrahsystem_dev/khazaneh-release-309c04c79a22`. تمام raw state، رمزها، نشست‌ها، نقش‌ها، اطلاعات مالی، فایل‌ها و کلیدها در startup برابر ماندند؛ همان SQLite/schema۱، بدون seed/reset/migration یا import واقعی. هیچ نقش، پرداخت، نام صاحب حساب یا شمارهٔ واقعی خودکار تغییر نکرد.

۱۲گزینهٔ افزوده: اقتصاد نوین، ایران زمین، رسالت، بلوبانک، پست بانک ایران، توسعه تعاون، دی، سرمایه، سینا، قرض‌الحسنه مهر ایران، گردشگری و مؤسسه اعتباری ملل. این کاتالوگ نام بانک‌های فایل است؛ نه ادعای همهٔ نهادهای بانکی یا صحت شماره‌های واردشده.

`work=ops/work/bank-catalog-v57-20261024`؛ `releaseEvidence=ops/work/production-v57b-20261024`.

| وضعیت | کنترل و شاهد |
|---|---|
| PASS | build/typecheck و freeze مستقل از v55،۱۳۸منبع و۳۷خروجی؛ v56 و `/api/admin/open-work` خارج بسته‌اند. build proof در artifact و scope در `work/scope.json`. |
| PASS | هر۴۲۱تست در SQLite و JSON با **server.cjs نهایی v57b**، صفر fail/skip؛ `work/sqlite-cache-final.json/.log` و `work/json-cache-final.json/.log`. اجرای قبلی v57 هر۴۲۰تست نیز محفوظ است. |
| PASS | ده تست pure متمرکز شامل alias/ناشناس/تکرار و تطبیق لینک نسخه‌دار با hash قالب؛ `work/cache-link-final.json/.log`. RED اولیه بانک‌های تازه و alias را رد می‌کرد؛ لاگ خام RED جداگانه ذخیره نشده است. |
| PASS | ۹مسیر Edge/Playwright روی v57b، فقط دادهٔ مصنوعی و شبکه بسته: قالب خالی۲۵بانکی/Text، preview بدون نوشتن، commit۲۵بانک و skip تکراری قدیمی، retry بدون تغییر پیش‌فرض/شناسه، denied/شبا ناقص، manual duplicate، فرم تاریخی، reload و موبایل؛ `work/ui-api-final-cache/result.json`. |
| PASS | تمرین Linux روی v57: restore، ثبت تازه بانک/پرداخت جزئی/پیوست، retry409 و rollback به v55 با **داده و vault جاری**؛ `work/lab-*.log`. برابری تمام کد اجرایی server/storage با v57b، با نادیده‌گرفتن فقط کامنت مسیر region و تغییر تنها sourceِ لینک، در `work/cache-scope-proof.json` اثبات شد؛ این تمرین اجرای مجدد binary دقیق v57b معرفی نمی‌شود. |
| PASS | بکاپ تازه Production،۵۸فایل، restore مستقل SQLite/code/config/data/vault روی سرور و Windows؛ ریشه خصوصی `ops/private/release-v53-bank-catalog-production-v57b-20261024`، backup manifest=`3f4ce8b9fa7644978c2f75030deae23ca220150ba735891363529b44e3a7d3be` و ackها. بکاپ‌های قبلی محفوظ‌اند. |
| PASS | maintenance هر۶مسیر apex/www، سپس open؛ quick_check=ok، نشست موجود مدیر خواندنی، ناشناس401، تنظیمات/کلیدها محفوظ و asset hash صحیح؛ `releaseEvidence/public-closed.json`، `upgrade-state.json`، `post-release-readonly.json`، `public-open.json`. |
| PASS | مرورگر عمومی desktop/mobile، بدون login/logout یا نوشتن مالی؛ JS/CSS و قالب نسخه‌دار دقیقاً هم‌هش، UTF-8/RTL و بدون overflow/error؛ `releaseEvidence/public-browser/result.json`. |
| NOT RUN | فشار تازه، استعلام/پیامک واقعی، import واقعی یا تغییر دادهٔ Production. پذیرش دستی مالک باقی است؛ E37 را خود مالک اصلاح می‌کند. اعتبارسنجی ضعیف نشده است. |

بازبین مستقل finding روکش را پس از حذف تغییر نامرتبط بست و برای لینک نسخه‌دار finding تازه نداشت؛ تست یا شبکه اجرا نکرد. تغییرات قبلی مالک حفظ‌اند؛ commit/push یا dependency تازه انجام نشد.

### کش و نسخهٔ میانی

v57، manifest=`7daf55d96f631b98389bf4c126b394184bd772bb152ec430e71bbe8512849dff`، ابتدا با state برابر منتشر شد، اما گیت عمومی قالب بدون query را قدیمی دید؛ CDN چهار ساعت کش می‌کرد. آن گیت PASS محسوب نشد. v57b لینک دانلود را به `/templates/bank-accounts-template.xlsx?v=b1d0d78d6fd5` تغییر داد؛ SHA قالب خالی جدید=`b1d0d78d6fd55ea700000108b4052ec27b3da8e4fb699ef26f59b52239bf9b73`. لینک واقعی فرم در مرورگر مستقل و همان URL روی هر دو دامنه عمومی کنترل شدند. binaryهای دو build byte-identical نیستند؛ برابری کد اجرایی با شاهد بالا اثبات شد، نه فرض برابری hash.

### بازگشت و مرز محیط‌ها

plan SHA=`3f8f0d2e3c7d117f124f17e3238a6c572cd39c71d518f22cde05b26aa0074732`، control root=`/home/shahrahsystem_dev/khazaneh-upgrade-309c04c79a22-v53`، ناشر unchanged SHA=`f25127818de13f4d3597971bcdf97cf0a4cb26b6b834c8508c05884be7053aa3`. تحت اختیار معتبر، pin/lock و Node22، همان ناشر با plan SHA و فاز `rollback` کد را به v57 برمی‌گرداند و DB/vault **جاری** و ثبت‌های تازه را حفظ می‌کند. snapshot قدیمی روی ثبت تازه restore نشود. شبکهٔ استعلام در rollback طبق قرارداد قبلی بسته می‌شود؛ فعال‌سازی پس از بررسی. `recover` محافظه‌کارانه و closed است؛ شکست pin با overwrite دور زده نشود. v55 و کنترل بازگشت v57 نیز محفوظ‌اند.

Staging دائمی همچنان v56c با root=`ops/private/permanent-staging-open-work-v56` است؛ این تحویل آن را تغییر یا downgrade نکرد و v56 روی Production منتشر نشد. checkout فعال شامل v56 است؛ از آن به‌جای snapshot مستقل rebuild/deploy نشود. handover نهایی سورس مستقل و شواهد انتشار را نگه می‌دارد، بدون DB/کلید/فایل واقعی مالک.
