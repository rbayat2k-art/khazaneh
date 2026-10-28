# انتشار v65d — زنجیرهٔ نوع‌محور سرپرست‌ها و نقش مکمل

وضعیت: PASS / DEPLOYED روی https://shahrahsystem.ir در 2026-10-26T07:35:33.485Z (26/10/2026, 11:05:33 تهران). مالک در همین مأموریت صریحاً تست و انتشار مستقیم همین محدوده را خواست؛ مجوز قدیمی یا درخواست توسعهٔ صرف مبنا نیست. خرید تأییدنشده وارد دامنه نشد.

## ۱. رفتار تحویل‌شده

پرداخت تکی/گروهی زیرمجموعه پس از سرپرست طبق مسیر پرداخت او به حسابداری ادامه می‌دهد؛ مساعده تکی/گروهی پس از سرپرست طبق مسیر مساعده او به مدیر مرحله بعد و سپس حسابداری می‌رود. درخواست خود سرپرست مسیر مستقل قبلی خود را دارد. نقش مکملِ سرپرست در انتخابگر نمایش داده می‌شود؛ نقصِ حساب/مجوز/محدوده/شرکت/سقف با علت کنار گزینهٔ غیرفعال دیده می‌شود. اصل قواعد سقف و scope از نقش اصلی/override شخصی باقی است؛ عضویت مکمل به‌تنهایی سقف مالی ایجاد نمی‌کند. هیچ profile واقعی، نقش، رمز یا routing کاربر تغییر داده نشد.

فقط ثبت جدیدِ چندمرحله‌ای snapshot دارد؛ پرونده‌های موجود جابه‌جا یا backfill نشدند. هر ردیف گروه مسیر/نوبت مستقل دارد. فرم کامل و گزارش مسیر ثابت را نشان می‌دهند؛ برگشت، رد، اصلاح حساس/فنی، اختیار موردی مدیر و حفاظت کارهای باز با آن سازگارند. اعلان عملیاتی به نوبت/نسخه/مخاطب جاری مقید است و نام یکسان به معنی یک actor نیست. [ADR-030](../decisions/ADR-030-type-aware-supervisor-chain.md) مرجع تصمیم و حدود است.

## ۲. هویت و محدودهٔ سورس

manifest: 1c8668c7b7f535cd9d81e4a72b8de17fadd068bfa81cfe2ad28c7212443686d9؛ release: /home/shahrahsystem_dev/khazaneh-release-1c8668c7b7f5.
سورس مستقل: C:\Users\reza\Desktop\پروژه‌ها\انتشار موقت khazaneh/work/request-approval-chain-v65-20261026/source، شاخهٔ codex/request-approval-chain-v65، بر مبنای v64b تولید. این worktree شامل تغییرات commit‌نشدهٔ همین تحویل است؛ Git HEAD جای هویت manifest را نمی‌گیرد. canonical checkout خرید v63 و۱۵۷ورودی اجرایی‌اش حفظ شده؛ مستقیم deploy نشود. **پیش از نشر آیندهٔ خرید، v64b و v65d باید ادغام و دوباره آزموده شوند.** پاک‌سازی، commit یا push انجام نشد.

## ۳. شواهد آزمون

فهرست کامل در C:\Users\reza\Desktop\پروژه‌ها\انتشار موقت khazaneh/work/request-approval-chain-v65-20261026/final-evidence.json است. هر۵۲۶تست SQLite/JSON روی v65c واقعی PASS؛ v65d فقط نسبت‌دهی UI با actorId را عوض کرد و server.cjs/storage-cli.cjs byte-identical هستند، proof=backend-reuse-proof.json. هر۱۶تست اختصاصی/راه‌اندازی و۱۴تست تازهٔ marker/اعلان روی artifact نهایی برای هرadapter PASS؛ build/typecheck، مرورگر با ساخت واقعی درخواست و تأیید lead/manager/accounting، هم‌نامی، selector مکمل، اعلان نامی، reload و desktop/mobile PASS. خطای هم‌نامی روی c در browser-red-same-name بازتولید و در browser-d-final02 رفع شد. SMS و Windows در آزمون مصنوعی/مسدود بودند؛ ارسال واقعی ادعا نمی‌شود. دو بازبینی مستقل منبع و بازبینی محدود انتشار خواندنی بودند؛ main تست‌ها را اجرا کرد.

Linux publisher/helper/backend دقیقاً همان bytes آزموده‌شده با c است؛ C:\Users\reza\Desktop\پروژه‌ها\انتشار موقت khazaneh\work\release-v65d-20261026/linux-reuse-proof.json پیوند هویت‌ها را ثبت می‌کند.۱۶کنترل journey، رکورد قدیمی با فیش/پرداخت جزئی، زنجیرهٔ نیمه‌تأیید و پرداخت جزئی تازه، چهار تلاش CURRENT recovery با قطع admission/backup، عدم پذیرش ack کهنه و preinstall abort با حفظ نشست فرزند PASS. دو نقص harness اولیه (fixture با شناسه تکراری و guard وابستهٔ جاافتاده) اصلاح شدند؛ هر دو قبل هر تغییر Production رخ دادند و شکست‌هایشان نگهداری شده‌اند.

## ۴. حفظ داده و بکاپ

بکاپ تازهٔ60فایل شامل code/data/files/config/vault با drain و توقف writer گرفته شد؛ restore مستقل داخل و خارج سرور و hash تمام فایل‌ها PASS. نسخهٔ خارج سرور در private/release-v53-v65d-20261026 با ACL خصوصی است. vault جاری بعد نصب جداگانه restore و opaque bytes آن با بکاپ اولیه برابر بود. startup تمام state را دقیقاً برابر اثبات کرد؛ تعداد permission افزوده0، password/salt/roles/companies/routes/sessions/files/settings محفوظ، schema۱ ثابت و migration/reset نداریم. مقدار/کلید/شمارهٔ بانکی/PII در گزارش نیست.

## ۵. عملیات اجراشده

planSha256=122d188c4ea7f35af05af174d8193c4d9958960c93b0141d4fd5379fab61860b، publisherSha256=928e67dd64cafec1d44e7e5eec64d98f1288dbf91770465e94ce15f6ce43f70f و helperSha256=b9f14f184f1f31eedb7d21cd4922e9fbd0cab75fa1aca0318d273925ddfc975a در C:\Users\reza\Desktop\پروژه‌ها\انتشار موقت khazaneh\work\release-v65d-20261026/prepared.json pin هستند. مراحل واقعی در production-setup/prepare/install/open/verify.log هستند. نصب پس از ack بکاپ مستقل و بازگشایی پس از ack vault انجام شد. سایت با همان داده جاری باز است. هیچ ورود/خروج یا درخواست/پرداخت آزمایشی روی Production ایجاد نشد.

## ۶. بازگشت امن

پس از admission، downgrade به v64b یا restore بکاپ قدیمی روی ثبت جدید ممنوع است. از publisher pin‌شده با plan pin‌شده استفاده شود: ابتدا recover برای بستن/drain، سپس rollforward با **CURRENT DB/files/vault و binary سازگار v65d**؛ پس از کنترل مستقل vault و صحت داده، open. یک نمونهٔ سازگار تازه نیز پیش از بازکردن باید گیت‌هایش سالم باشد. contract نام‌گذاری‌شدهٔ FORWARD_ONLY_CURRENT_STATE_V65C_APPROVAL_CHAIN در d عین قرارداد آزمودهٔ c است؛ معنی آن سازگاری schema۱ زنجیره است، نه الزام به downgrade کد. abort-before-install فقط پیش از admission و بدون marker زنجیره و با **داده جاری** مجاز است. بکاپ v64b برای حفاظت/بررسی است، نه برگرداندن روی نوشته‌های تازه.

## ۷. سلامت نهایی و حدود

public-smoke-final/result.json: دامنه وwww، UTF-8، viewport دسکتاپ/موبایل، hash فایل‌های JS/CSS/hero/قالب و401ناشناس، browserErrors۰ PASS. نشست موجود ADMIN و تنظیمات اتصال از داخل سرور فقط خوانده شدند. PID backend=2569143 وgateway=2569390 بین verify/monitor ثابت؛ restart۰، quick_check=ok و امضای خطای بررسی‌شده۰. پایش از بازگشایی تا 2026-10-26T07:38:20.537Z کوتاه‌مدت است؛ ظرفیت یا سلامت دائمی ادعا نمی‌شود. استعلام/پیامک/پرداخت واقعی یا فشار روی دامنه تست نشد. خرید55120 و Stage خزانه55124 و Stage زنجیره55126 سالم و مستقل‌اند؛ راه ورود خصوصی هر Stage در ACCESS.txt خودش است. داده/رمز/کلید Stageهای قبلی تغییر نکرد.

بررسی خواندنی profile فعلیِ سرپرست مورد بحث پس از نشر نشان داد نقش اصلی REQUESTER، بدون نقش مکمل، scope=SELF_ONLY و سقف تأیید غیرمثبت است. هیچ تنظیمی تغییر نکرد. برای استفاده عملی باید مالک نقش مکمل سرپرست، محدوده مناسب و سقف مالی مصوب را در فرم کاربر ثبت کند؛ عدد یا اختیار مالی به‌جای مالک حدس زده نمی‌شود.