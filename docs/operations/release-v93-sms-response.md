## تکمیل بررسی با ورود مالک

پس از ورود عادی مالک، در 2026-10-28T13:33:20Z آزمون خواندن نشست مدیر و تنظیمات اتصال/کلید فعال روی دامنه PASS شد؛ پایش 13:33:22Z نیز PASS با restart0/error0 است. NOT RUN زمان بازگشایی در پایین سابقه است و اکنون این بررسی تکمیلی انجام شده است.

# انتشار v93b — اصلاح تشخیص پاسخ پیامک

وضعیت **DEPLOYED**؛ دامنه https://shahrahsystem.ir/، بازگشایی 2026-10-28T13:27:26.379Z. مالک پس از آزمون، انتشار همین نسخه و ذخیرهٔ GitHub با حفظ نسخه‌های قبلی را صریحاً مجاز کرد.

## ۱. نیاز و نتیجه

سرویس فراز، پیامک را می‌پذیرفت ولی پاسخ object آن در سامانه خطا شناخته می‌شد. فقط FARAZ_PUBLIC در sms-transport.ts به دو شکل دقیق scalar data و own data.id محدود شد. HTTP200/201، success، شناسهٔ معتبر و کنترل timeout/body/redirect/secret حفظ‌اند. لاگ‌ها و سهمیه‌های قبلی بازنویسی، بازپخش یا صفر نشدند. پذیرش سرویس، معادل اثبات تحویل همهٔ گوشی‌ها نیست.

## ۲. هویت و محدوده

- manifest: a79c07ceee1cab254f315e64defa29bb266a229de5e75ad23e7b7332e509ea0a
- plan: 9f466e75302f155cd6eebdcc5e94ccf3521fe656158e767841b953516e601c26
- publisher SHA: f062900cf2a6b6cdb0deceeb2ac7609e10d135665ef6bf138fddc0fb8a260f83
- source: work/sms-response-v93-20261028/source، از freeze واقعی v92c؛ فقط parser تغییر اجرایی دارد. frontend runtime assets و storage-cli بایت‌یکسان‌اند؛ metadata ساخت جداست. خرید و ۱۵۷ ورودی محافظت‌شدهٔ checkout آن محفوظ و منتشرنشده‌اند.

## ۳. آزمون

۷۶۱/۷۶۱ SQLite و۷۶۱/۷۶۱ JSON، lint/build/proof و مرورگر desktop/390 PASS؛ پاسخ متن/پترن در۲۰۰/۲۰۱، scalar، شناسهٔ نامعتبر، 429/timeout/قطع پاسخ، OTP، reminder، چهار گردش و مجوزها پوشش دارند. بازبین مستقلِ خواندنی یافته‌های شناسه، محرمانگی و lease را بسته است؛ اجرای تست/انتشار توسط primary انجام شد.

Linux Node22 با exact B: نصب، backup/restore مستقل خارج سرور، partial/receipt قبلی، یک یادآوری موعدرسیده با envelopeجدید، سهمیهٔ پر و CLAIMED/UNKNOWN تاریخی و roll-forward CURRENT پس از درخواست تازه PASS؛ پیام واقعی از lab نرفت. تغییر ناشر فقط حذف گرم‌کردن تکراری LIVE است: strict کل state زیر TEST_ONLY، سپس یک شروع LIVE و تطبیق مجزای scheduler.

## ۴. بکاپ و حفظ داده

بکاپ سازگار **۲۱۰ فایل**، بازیابی مستقل SQLite/code/files/vault خارج سرور و جفت کلید جاری PASS؛ inventory جدید vault دو فایل دارد. قبل از LIVE تمامCURRENT، رمز، کاربران، نقش‌ها، شرکت‌ها، سقف‌ها، مسیرها، حساب‌ها، فایل‌ها و تنظیمات برابر بودند. پس از LIVE تمام بخش‌های غیر reminder برابر و تمام claim/logهای قبلی محفوظ بودند؛ در پنجرهٔ کنترل **0** تلاش جدیدِ reminder ثبت شد. کلید، شماره خط و تنظیمات ۸تا۲۱ و سقف دو پیام عوض نشدند؛ guard عمومی سایر سرویس‌ها بسته است. هیچ DB یا vault از Staging منتقل نشد.

## ۵. توقف کنترلی و محدودیت صریح

preflight نشست مدیر داشت؛ مالک پیش از بکاپ از آن خارج شد. نصب با strictCURRENT/assets/401 سالم بود، ولی ناشر تاریخی به نبود نشست قبلی مدیر خورد و در maintenance بسته ماند. این شکست احراز هویت محصول نبود. از ساختن token، تغییر رمز، تغییر نشست یا حذف عمومی guard استفاده نشد.

ادامه‌دهندهٔ مستقل hash-pinned، فقط همین failure را پذیرفت: install admitted/FAILED_CLOSED، TEST_ONLY، صفر نشست مدیر در before/current، hash کلCURRENT، auth/UI/storage یکسان جز parser، runtime/config/lock، lease PID/start/nonce، vault، manifest/assets و401. بازسنجی پس از await و قبل از promotion انجام شد. سناریو در lab با logout عادی مدیر و شکست طبیعی install بازتولید شد؛ تغییر ایمنیِ hash/lease نیز جدا آزموده شد. policySHA=c662608fab66be5030f3ea729c37725df9e8589b66ccadac170ba9edabb282c6.

آزمون خواندن پنل با نشست زنده و تنظیمات وابسته به آن هنگام بازگشایی **NOT RUN_NO_EXISTING_SESSION** بود؛ به‌جای PASS ساختگی، auth سالم روی exactB در Linux و عدم تغییر auth و سلامت/انکار ناشناس ثبت شدند. دعوت ورود عادی مالک برای smoke تکمیلی ارسال شد. سابقهٔ نصب BLOCKED حفظ شده است. maintenance تا بازگشایی بالا طول کشید؛ بازگشت دادهٔ قدیمی انجام نشد.

## ۶. سلامت و بازگشت

سلامت gateway/backend، هویت فایل‌ها، SQLite quick_check=ok، 401 ناشناس، صفر restart و صفر امضای خطای سرور PASS. صفحهٔ HTTPS در مرورگر باز شد. آزمون مالی مصنوعی، reset رمز و تکرار پیام قبلی روی Production اجرا نشد؛ آزمون فشار تازه ادعا نمی‌شود.

اگر نیاز به recovery باشد، فقط ناشر و plan frozen بالا، CURRENT data/files/vault و binary سازگار v93b استفاده شوند؛ restore بکاپ قدیمی روی ثبت تازه، downgrade ناآگاه یا replay پیام ممنوع است. recover/rollforward در lab با ثبت تازه، partial، فیش و ledger تمرین شده‌اند. بازکردن traffic و LIVE پس از recovery گیت‌های جدا دارند.

## ۷. GitHub و شواهد

مالک ذخیرهٔ source دقیق منتشرشده و نسخهٔ قبلی را مجاز کرده است. snapshot عمومی از تاریخچهٔ موجود و با branch/tag تازه ساخته می‌شود؛ main و tagهای قبلی بازنویسی نمی‌شوند. data/vault/key/session/PII و ops خصوصی داخل GitHub نمی‌روند. رکورد نهایی commit/tag/asset در GITHUB-SNAPSHOT.md ثبت شود؛ GitHub بکاپ دیتابیس خصوصی نیست.

شواهد خصوصی: full-b-*.json/log، final-verification.json، lab-*/zero-*، continuation-private-error-regression.json، prepared-b.json، production-*.log، offserver-b-*.json و production-public-v93b.png؛ نسخهٔ پیشین و بکاپ‌ها محفوظ‌اند.
