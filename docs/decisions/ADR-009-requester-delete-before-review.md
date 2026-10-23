# ADR-009 — حذف درخواست توسط سازنده پیش از رسیدگی

Accepted — تصمیم صریح مالک۲۰۲۶/۱۰/۲۳؛ پیاده‌سازی/آزمون محلی و Staging مجاز، Production در انتظار پذیرش نسخه.

## قرارداد و حفاظت

کنار ویرایشِ درخواست خود کاربر، «حذف درخواست» با تأیید صریحِ پنجره نشان داده شود؛ هر دو فقط تا اولین اقدام موفق بررسی‌کننده بعدی، نه صرف مشاهده. همان وضعیت/سابقه ویرایش ADR-003، مجوز نوع درخواست، شرکت، مالکیت و نسخه جاری در صف نوشتن سرور دوباره کنترل شوند. برگشت/رد/ویرایش بررسی‌کننده/تأیید و هر اثر پرداخت، حذف را می‌بندد. admin حق حذف درخواست شخص دیگری از این مسیر نمی‌گیرد.

مالک تأیید کرد: حذف از همه فهرست‌ها و صف‌های عملیاتی، با حفظ اصل رکورد، پیوست و سابقه حذف؛ پاک‌کردن قطعی یا بازیابی خودکار نیست. در گروه هر کودک دست‌نخورده مستقل است؛ سایر کودکان حتی اگر بررسی/پرداخت شده‌اند محفوظ می‌مانند. وضعیت و جمع و تعداد گروه فقط از ردیف‌های فعال محاسبه شوند؛ حذف آخرین کودک، والد را هم از نمایش خارج می‌کند.

## طرح محدود

رکورد تکی در همان collection، بسته و با زمان/actor/نسخه حذف محفوظ می‌ماند. کودک گروه از items فعال به deletedItems خصوصی همان والد منتقل می‌شود؛ اصل محتوا/پیوست/هویت حفظ و رویداد حذف به تاریخچه افزوده می‌شود. DTO عمومی هرگز deletedItems را برنمی‌گرداند؛ state، پاسخ مستقیم batch، اعلان مرتبط و دریافت فایل باید این مرز را رعایت کنند. تاریخچه خصوصی، مجوز دسترسی تازه یا صفحه بایگانی عمومی ایجاد نمی‌کند. schema SQLite/collection جدید یا بازنویسی داده قبلی لازم نیست؛ فیلدهای افزوده optional و رکوردهای قدیمی دست‌نخورده‌اند. rollback دودویی قدیمی ممکن است رکورد Closed را در سوابق قدیمی نشان دهد؛ برای انتشار تنها بازگشت به binary آگاه از این قرارداد/roll-forward پذیرفته است، نه restore داده قدیمی.

## پذیرش و کارها

- مجاز: پرداخت/مساعده تکی، کودکان هر دو گروه، بدون سرپرست، مشاهده صرف، حذف بعد از ویرایش خود سازنده.
- غیرمجاز: کاربر دیگر/actor جعلی/شرکت نامجاز/مجوز لغوشده، نسخه کهنه، تاریخچه مبهم، بررسی شروع‌شده و آثار مالی/پیوست مالی متصل.
- دوام: reload/restart، تکرار حذف بدون رویداد دوباره، دو تب، مسابقه حذف با بررسی/ویرایش و شکست commit با حفظ کامل state.
- ارتباط‌ها: مبالغ/تعداد/وضعیت فعال گروه، سایر کودکان، پیوست خصوصی و اعلان‌ها؛ پاسخ state عادی/delta و پاسخ مستقیم batch بدون بازگشت آرشیو.
- UI: اندازه/رنگ/RTL کنش‌های ردیف موجود، تأیید/انصراف، خطا/درحال ثبت و موبایل؛ API و مرورگر واقعی با داده مصنوعی.

شواهد اجرا پس از آزمون در ops/work/requester-delete-20261023 ثبت می‌شود؛ ops طبق Baseline. کد اولیه۱۱۰فایل با recovery manifest `91f862896b1396f8d405a12abe17e89f76fc181aa155e64e996524a0715f987a` محفوظ شد. هیچ Production یا داده واقعی مجاز به تغییر نیست.

## آخرین نتیجهٔ محلی و Staging — v32، ۲۰۲۶/۱۰/۲۳

**PASS اجرای تازه؛ Production و پذیرش مالک: NOT RUN.** مدل با همان فیلدهای optional مصوب بازیابی شد، hash=`fb9cba51841f90e8b361c1fac0243cdd695f098d3e460123e15daaf718d70291` و طی build،۲۰۸تست هر adapter و۱۴مسیر مرورگر دوباره برنگشت. حذف واقعی از فرم در Staging v32،reload،خروج از فهرست فعال و حفظ Closed/مبلغ/audit در SQLite PASS؛ قرارداد حذف/مجوز/نگهداری و schema تغییر نکردند.

دلیل شکست typecheck، نبود همین قرارداد در bytes قدیمی HEAD اثبات شد؛ فرایند تاریخی بازنویسنده هنوز شناسایی نشده و ردیابی کرنل بدون Administrator مسدود است. ادعای شناسایی/توقف آن نداریم. build اکنون typecheck و hash ورودی پیش/پس و خروجی دارد؛ provision سورس/سرور/رابط ناسازگار را رد می‌کند و خودکار فایل را بازنویسی نمی‌کند. بازبین مستقل دو ضعف guard را معتبر دانست؛ اصلاح و تست شدند و closure یافتهٔ ضروری باز ندارد.

Staging تازه=`ops/private/permanent-staging-model-bank-v32`؛ manifest=`56af5d37c91bc34c62743b58d544f6784bec2bdc910ad06e9cc46d671ddc6a7e`؛ راهنمای آزمون و شواهد/بازیابی: `ops/work/model-staging-repair-verified-20261023/CHECKPOINT.md`. v30 بدون حذف/بازنویسی محفوظ و متوقف است. رکوردهای BLOCKED پایین تاریخی‌اند و جایگزین این وضعیت تازه نیستند. بازگشت آینده همچنان باید با قرارداد حذف سازگار و حفظ‌کنندهٔ نوشتن‌های جدید باشد.

## سابقهٔ نتیجهٔ محلی و Staging — v30، ۲۰۲۶/۱۰/۲۳

**BLOCKED — یکپارچگی checkout فعلی، نه Staging:** پس از gateهای موفق و فعال‌سازی v30، watcher در `2026-10-23T07:48:06Z` خالی‌شدن کوتاه و بازنویسی دوباره مدل به hash قبلی HEAD را ثبت کرد. بررسی نهایی تمام source/file hashهای manifest، فقط drift همین `src/types/treasury.ts` را یافت؛۳۰فایل artifact ثابت و آزموده‌شده سالم‌اند. بنابراین PASSهای زیر به snapshot آزموده‌شده مربوطند، **نه ادعای سلامت typecheck سورس جاری**. بازنویسی خودکار دوباره انجام نمی‌دهیم؛ علت/نویسنده هنوز نامعلوم است. ردیابی Kernel-File ویندوز با خطای Access denied و نیاز Administrator مسدود شد؛ سیاست/مجوز ویندوز را تغییر ندادیم. `ops/work/requester-delete-20261023/final-evidence.json` مرجع وضعیت نهایی، source-observed-final نسخهٔ کد مشاهده‌شده و restore-model-contract.patch قرارداد بازیابی لازم را حفظ می‌کنند. Staging ثابت برای امتحان مالک در دسترس است؛ تحویل نهایی سورس/انتشار Production تا رفع این تداخل مسدود است.

**PASS** — candidate v30؛ manifest `8303ef3daef6f8763a6030c7f4c75f8c95fc962bb92c663548fccef8337b6db2`، HEAD `cb8b87b8f5a53e49b28f955e52e56932a2689fd4`، شاخه `codex/requester-delete`، dirty؛ بدون commit/push. اصلاحات ورودی فرم‌ها و دروازه خصوصی v29 حفظ شدند. npm run lint (tsc --noEmit) و npm run build PASS؛ warning تازه‌ای در ساخت نبود. suite کامل۱۹۹/۱۹۹ در هر یک از JSON و SQLite روی artifact نهایی PASS، بدون skip.۸مسیر واقعی مرورگر با API واقعی/SQLite: request-delete،request-edit،review-rejection،multi-role،requester-tracking-menu،payment-recovery،session-state-isolation وform-input-journey، همگی PASS. desktop/mobile حذف دیده و بررسی شدند.

API اختصاصی۸مورد و unit۲مورد، مالکیت/مجوز جاری/شرکت/actor/نسخه، سابقه مبهم، اتصال رسید، پنج اقدام بررسی‌کننده، حذف بعد ویرایش خود سازنده/بدون سرپرست، کودک مستقل هر دو نوع گروه/کودک پرداخت‌شده، حذف آخرین کودک، مستقیم batch و اعلان/SMS، رقابت حذف با ویرایش/بررسی/حذف دیگر، شکست commit و restart را پوشش می‌دهند. هیچ audit/مبلغ/پیوست مالی از sibling حذف یا تغییر نمی‌کند. دو شکست اولیه regression اعلان از fixture حداقلی فاقد سه collection مالی بود؛ فقط همان fixture با collection خالی منسجم شد و تمام assertionها حفظ شدند. یک VALID P2 بازبین مستقل درباره اعلان قدیمی والد با جمع قبلی رفع و regression شد؛ بازبین در closure یافته ضروری بازی ندارد و فقط خوانده است.

برگشت مدل واقعاً دو بار به bytes نسخه HEAD مشاهده شد، نه اثبات دخالت مالک. فایل write-time دوم `2026-10-23T07:35:06.804Z` بود. بررسی محدود scripts/build/test hooks/reviewer و hardlink، نویسنده را مشخص نکرد؛ **علت تاریخی/فرایند نویسنده BLOCKED/تأییدنشده** است، نه علت حدسی. پس از اجازه ادامه مالک، فقط فیلدهای optional مصوب بازیابی شدند؛ hash کنونی مدل `fb9cba51841f90e8b361c1fac0243cdd695f098d3e460123e15daaf718d70291` پیش/پس typecheck،build،هر دو suite و مرورگر ثابت ماند. watcher موقت فقط hash/metadata ثبت کرده و منبع را بازنویسی نمی‌کند؛ final verification باید تمام source hashes را دوباره تطبیق دهد، نه صرف HEAD.

Staging فعال تازه: `ops/private/permanent-staging-request-delete-v30`؛ URL `http://127.0.0.1:55120/`، credential تصادفی فقط ACCESS.txt خصوصی همین root. v29 با داده/credential خودش محفوظ و STOPPED است.۵کاربر و داده پایه کاملاً TEST،SQLite/نشست/فایل جدا، خروجی بانک/پیامک/شبکه بیرونی مسدود؛ هیچ داده یا رمز Production منتقل نشد. smoke واقعی دروازه، UTF-8، admin/logout/relogin/CSS/JS و ثبت فرم واقعی→حذف→reload→حفظ Closed/audit در SQLite PASS.

شواهد: `ops/work/requester-delete-20261023/verified-final-{json,sqlite}.log`، `staging-login-v30/result.json` و `staging-delete-v30/result.json`؛ مرورگر۸مسیر در `ops/work/hardening-ui-request-delete-v30-final/result.json`. نمونه RED قدیمی route404 و checkpoint توقف قبلی محفوظ‌اند؛ معیار نهایی نتیجه نسخه نهایی بالاست، نه نتایج قدیمی.

بازتولید: با env مستقل زیر ops/work و TREASURY_TEST_SERVER=مسیر server.cjs همین artifact، `node --import ./tests/native-types.mjs --test tests/*.test.ts`؛ adapter با TREASURY_TEST_STORAGE=json|sqlite و پورت اصلی55230 (فرم55231،حذف55232). root هر اجرا تازه باشد. مرورگر از ops/tools/hardening-ui.mjs ARTIFACT NEW_OUTPUT CASES؛ smoke Staging از tools/staging/login-journey.cjs و request-delete-check.cjs با root/out صریح. هیچ فرمان تست بدون محیط صریح اجرا نشود.

**NOT RUN** — Linux/فشار/soak تازه و gate انتشار Production؛ این مأموریت فقط پذیرش Staging است. **تأیید مالک برای v30: منتظر؛ Production: بدون اتصال یا تغییر.** schema فیزیکی SQLite تغییر نکرد؛ حذف‌های منطقی برای سازگاری داده به binary آگاه از این قرارداد نیاز دارند. rollback به binary v28/v29 روی داده دارای حذف مجاز نیست؛ انتشار آینده باید roll-forward/بازگشت سازگار با حفظ نوشتن‌های تازه داشته باشد، نه restore قدیمی.
