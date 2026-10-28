# ذخیرهٔ سورس جاری شاهراه در GitHub — v50

## snapshot مستقل Production v57b —۲۰۲۶/۱۰/۲۵

به درخواست صریح مالک، نسخهٔ واقعی فعلی دامنه در [Release v57b](https://github.com/rbayat2k-art/khazaneh/releases/tag/v57b) محفوظ شد؛ commit=`7e5b48e19834524a53e53cb057301a311425691c`، شاخه `codex/production-v57b-snapshot`، tagv57b، manifest=`309c04c79a22058188487f07b6a283e3793e0497e01054f6252ca0f680a19b21`. parent تاریخچه فعلی حفظ و main/checkout dirty مالک تغییر نکرد. source کامل hash-matched از snapshot v57b است، نه v60؛۲۸۹فایل عمومی و۳۸فایل بستهٔ frozen. assetSHA=`cacc01410432b45c192099bd8276bf98b51d7cd2bf06485ef1687aeba332e0ab` با digest GitHub تطبیق شد. private data/vault/password/session خارج ماند؛ این GitHub save نه بکاپ DB و نه deploy است. [رکورد و محدودیت‌ها](../operations/release-v60-gate.md) مرجع‌اند؛ انتشار v60 به‌علت دو یافته بازتولیدشده متوقف شد. مجوز این snapshot، مجوز دائمی commit/push تغییرهای آینده نیست.

## تحویل v50 — ۲۰۲۶/۱۰/۲۳

مالک ذخیرهٔ آخرین نسخه آزموده‌شده و انتشار مشروط همین تحویل را مجاز کرد. v28 و tag/asset قبلی حفظ شوند؛ force-push/بازنویسی تاریخچه مجاز نیست. محدوده عمومی اکنون `tools/staging/` را نیز شامل می‌شود، چون package.json وbuildبه آن وابسته‌اند؛ فقط سورس عمومی ابزار،نه staging.json/ACCESS/vault/data. [کنترل v50](../operations/release-v50-readiness.md) وmanifestv50هویت جدید را نگه می‌دارند. نبودن privateops درGitآگاهانه است؛ از آننبایدکپیdataset/credential بسازید.

سورس freeze `5cb1859f7dd194dec071b4ff7d0a15fe561bcec1` بدون force به main ارسال شد. همان artifact روی Staging و Production است؛ commit مستندات تحویل پس از آن، کد اجرایی را تغییر نمی‌دهد. بسته عمومی v50 دارای ۳۹ فایل ZIP (۳۸ خروجی و manifest)، با SHA ZIP=`064853e86acb6a4cd947d9897f37d532d1010aa13ff07df6a6721c9cb234f289` و manifest=`abd40ac3ff0a1da8fcc8e9e5a71d50d2fb5c72e455851b77c2f83826b8a7f314` است. manifest شامل ۱۰۷ منبع است؛ تمام entryها و هش‌های ZIP با بسته منجمد تطبیق شدند. tag/release v28 و تاریخچه محفوظ‌اند.

## ثبت تاریخی v28

تاریخ: ۲۰۲۶/۱۰/۲۲. مجوز مالک: ذخیرهٔ تمام فایل‌های پروژهٔ فعال و به‌روز در `https://github.com/rbayat2k-art/khazaneh`. مخزن هنگام بررسی خالی، عمومی و شاخهٔ پیش‌فرض آن `main` بود. این اقدام هیچ انتشار یا تغییر زنده‌ای انجام نمی‌دهد.

## محدوده و هویت

- سورس کامل `src/` و `server.ts`، تست‌های `tests/`، اسناد `docs/`، فایل‌های عمومی/قالب `public/`، طرح تاریخی `prisma/`، فایل‌های build/config و lockfileها ذخیره می‌شوند. وجود Prisma به معنای مصرف آن در Production نیست.
- `releases/v28/release-manifest.json` همان manifest انتشار است: SHA-256 `b26471c412d1a58c9eaa8e7ab4acb80f5c96274da0453712c1c7e6dd2a591f73`؛ ۶۰ فایل منبع و۳۰ فایل خروجی. تمام منابع آن در این snapshot بدون تغییر هستند. AGENTS و مستندات جدید پس از freeze اضافه شده‌اند و ادعای آزمون محصول تازه ندارند.
- بستهٔ خروجی دقیق v28، فقط۳۰ مسیر فهرست‌شده و خود manifest، به‌عنوان asset انتشار GitHub v28 ذخیره می‌شود؛ نه rebuild جدید و نه خروجی ساخته‌شدهٔ نامشخص `dist/` محلی.
- شناسهٔ سورس از `git rev-parse HEAD` و tag/release خوانده شود. manifest SHA، Git SHA نیست؛ commit حاضر به‌تنهایی اثبات نسخهٔ نصب‌شدهٔ سرور نیست.

## خارج از مخزن عمومی

`data/`، `.aistudio/`، node_modules، env واقعی، کلید/گواهی خصوصی، session، hash/salt رمز مدیر، DB، snapshot، بکاپ، فیش یا اطلاعات واقعی و آرشیو عملیات خصوصی ارسال نمی‌شوند. `.env.example` فقط placeholder است. دادهٔ خام نیز چون حاوی اعتبار مدیر است قابل انتشار نیست. بکاپ‌های محلی/سرور محفوظ‌اند؛ این مخزن بکاپ کامل داده نیست.

سورس قدیمی شامل seed نمایشی، شماره‌های نمونه و تصویرهای همان رابط نمایشی است؛ seed دادهٔ زنده یا راه بازگرداندن رمز فعلی admin نیست. در محیط production نبود DB باعث توقف است، نه seed خودکار. clone را خودکار به data زنده یا دامنه متصل نکنید و reset/demo را روی اطلاعات مهم اجرا نکنید. هیچ رمز فعال در این سند ثبت نمی‌شود.

## کنترل انجام‌شده و محدودیت‌ها

- پیش از ویرایش، recovery خصوصیِ۱۳۰ فایل انتخاب‌شده در `ops/work/github-v28-snapshot-20261022/before-git` محفوظ شد؛ هش فهرست `f8b595ac47e835f9e7337ac991fb9f751b232263aeed94eb639c904cf6c21f1b`. `ops` در Baseline تعریف شده است. این recovery فقط فایل‌های پوشش‌داده‌شده را حفظ می‌کند، نه دیتابیس.
- بررسی محدود payload: کشف کلید/token/credential و URL احرازشده، مسیرهای خصوصی، لینک، اعداد نمونه، مشاهدهٔ۸ تصویر عمومی و دو sheet قالب Excel؛ بازبین مستقل خواندنی. چارچوب محدود: ASVS5.0.0 و SSDF1.1 نهایی، بدون ادعای گواهی یا ممیزی کامل محصول.
- تست/build مجدد لازم نبود: تغییر محصول، dependency، schema و runtime نداریم؛ hash تمام۶۰ منبع و۳۰ خروجی با همان v28 تأیید می‌شود. پذیرش‌های قبلی فقط طبق دامنه/محدودیت Baseline معتبرند.
- GitHub جای فایل‌های خصوصیِ عملیات، ابزارهای میزبان، رمز مدیر یا data نیست. اجرای تازه نیازمند Node و dependencyهای lockشده و محیط مستقل است؛ راهنمای آزمون و محدودیت فرمان‌های bare در [Baseline](BASELINE.md) را بخوانید. اسکریپت‌های خصوصی ops با این مخزن قابل بازتولید فرض نشوند.
