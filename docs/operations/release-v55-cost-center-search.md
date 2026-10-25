# v55 — جست‌وجوی مرکز هزینه

## دامنه و پذیرش

درخواست مالک۲۰۲۶/۱۰/۲۴: تمام انتخابگرهای مرکز هزینه علاوه بر فهرست معمول، جست‌وجوی نام/کد داشته باشند؛ سپس تست و انتشار همین تغییر روی نسخهٔ اصلی. اجازهٔ انتشار صریح در پیام تکمیلی «روی همان نسخه اصلی ... هم لیست ... هم جستجو» داده شد؛ نیاز به تأیید تکراری همان محدوده نیست. سایر اطلاعات، دسترسی‌ها، الزام‌ها و ظاهر فعلی حفظ شوند.

تغییر فقط UI است: native select و optionها عیناً نگه داشته شده و ذره‌بین/تایپ برای جست‌وجو اضافه می‌شود. پنجرهٔ جست‌وجو از overflow جدول خارج است؛ query هرگز value یا متن آزاد ثبت‌شونده نیست. نام و کد با ارقام فارسی/لاتین و ی/ک جست‌وجو می‌شوند؛ صفرهای ابتدایی حفظ‌اند. فقط option مجاز فعلی قابل انتخاب است؛ Enter جست‌وجو فرم را ثبت نمی‌کند. فهرست بدون سرچ نیز همچنان کار می‌کند.

پنج محل: ثبت تکی، ثبت گروهی، ویرایش متقاضی، ویرایش سرپرست/حسابداری، دستور خارج سامانه. value در چهار مسیر name و در review همان ID است؛ خالیِ review یعنی بدون تغییر. selected قدیمیِ خارج فهرست و disabled محفوظ است. scope و مراکز فعال از همان caller/server می‌آیند. فرم دستی/مساعدهٔ تکی یا گزارش که انتخابگر مرکز ندارند، فیلد تازه نمی‌گیرند. مدل، schema، API و server.ts تغییر نمی‌کنند.

## گیت

RED معتبر روی artifact v54b: `ops/work/hardening-ui-cost-center-red-v55-20261024`، نبود کنترل جست‌وجو اثبات شد. تست جدید pure برای alias/کد/نام/صفر و query ناموجود؛ مرورگر واقعی برای هر۵محل و دو مرحله review، حفظ native value/required/scope، ذخیره و reload، keyboard/Enter/Esc/Tab، popup در جدول و mobile. regressionهای فرم قبلی بدون تغییر assertion اجرا شوند. فقط دادهٔ مصنوعی و خروجی شبکه بسته.

مرجع کار `app=C:/Users/reza/Desktop/khazaneh`؛ `ops=C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh`؛ evidence در `ops/work/cost-center-search-v55-20261024`. شاخه `codex/cost-center-search-v55`، HEAD مبنا6d5882b؛ تغییرات قبلی و بکاپ چهار فایل UI در evidence/before محفوظ‌اند. commit/push جدید مجاز نشده است. Production مبنا v54b با manifest c04924ad… است. نتیجهٔ اجرا و انتشار پس از گیت به همین سند افزوده شود؛ این متن به‌تنهایی PASS یا انتشار نیست.

## نتیجهٔ نهایی — PASS / DEPLOYED

نسخهٔ v55، manifest=`86778ed21002a4d1ec37f63c59a2074452b5085e62b06b42829f7598cf0a7566` در `2026-10-24T12:40:01.303Z` (۱۶:۱۰:۰۱ تهران) روی `https://shahrahsystem.ir` باز شد. مسیر کد `/home/shahrahsystem_dev/khazaneh-release-86778ed21002`؛ همان SQLite/schema1 و vault جاری، بدون migration/reset یا تغییر داده/اختیار. تطبیق raw کل state در startup، تمام کاربران/رمز/نشست/نقش/سوابق مالی/پیوست‌ها را عیناً برابر نشان داد؛ از جمله تنظیم شرکتِ سرپرست و انتساب‌های تازهٔ مالک که پس از v54 ثبت شده بودند. هیچ تنظیم نقش یا user assignment در این نسخه انجام نشد.

| وضعیت | کنترل | مدرک |
|---|---|---|
| PASS | build و typecheck پایدار و freeze، تطبیق source و بسته | evidence/build.log؛ artifact `ops/work/domain-release-multi-role-cost-center-v55-20261024` و build proof |
| PASS | ۲۹ تست pure/API مرتبط، صفر fail/skip؛ مرکز هزینه، نقش/شرکت، denied، race/failure/reload و فرم | evidence/focused-final.json و log؛ run-check-v55.cjs با server.cjs منجمد و SQLite مصنوعی |
| PASS | هشت مسیر مرورگر واقعی با دادهٔ مصنوعی | ops/work/hardening-ui-cost-center-v55b-20261024/result.json؛ cost-center-search، single-payment-required، request-edit، request-details، external-entry، request-form-reset، bank-reason-journey، menu-permissions |
| PASS | اجرای نهایی جست‌وجو و تصویر موبایل پس از بسته‌شدن کامل Sidebar | ops/work/hardening-ui-cost-center-v55c-20261024/cost-center-search/result.json؛ همهٔ۵محل، دو مرحله review، مقدار name/ID، native list، query ناموجود، Enter بدون ثبت، Esc/Tab، disabled، جدول و RTL |
| PASS | Staging مستقل، backup/restore دادهٔ جاری، رمز/vault محفوظ، gate/admin/logout/relogin/۱۶asset | evidence/staging-transfer.json و staging-login/result.json |
| PASS | backend و storage-cli دقیقاً byte-identical با v54b | SHA server.cjs=`a1eff1f2cf30e027b257d5c4334be158bed17bae1b7082b2f0cdbcd64ba58436`؛ SHA storage-cli.cjs=`16b535eefbdacf51379c3cda7b07a1bc362922414cff01f540febf670e82b211` |
| PASS | بکاپ تازه کد/config/DB/فایل/vault و restore مستقل هم روی سرور و هم خارج آن | ریشهٔ خصوصی `ops/private/release-v53-cost-center-production-20261024`؛ ۵۹فایل و ackها؛ backup manifest=`bf50197c90a0339836d39ed7b26f5a9903f54c677400ccdfc525017822272c21` |
| PASS | سایت باز؛ quick_check=ok، نشست موجود مدیر، فایل‌ها، API匿名401، مرورگر desktop/mobile/apex/www | releaseEvidence/post-release-readonly.json و public-browser/result.json؛ `releaseEvidence=ops/work/production-v55-20261024` |
| NOT RUN | full suite مجدد، فشار یا financial/login/logout زنده و تماس بیرونی | متناسب با UI-only بودن تغییر؛ شاهد full۴۱۷تست هر adapter و Linux rollbackCURRENT v54 برای backend/storage/ناشر **هم‌هش و بدون تغییر** بازاستفاده شد، نه به‌عنوان اجرای تازهٔ v55 |
| NOT RUN | مهاجرت یا تمرین مالی تازهٔ Linux برای v55 | هیچ schema/API/backend عوض نشده؛ بازگشت همان کد byte-identical با DB/vault جاری است. restore تازه و startup raw برابر در انتشار فعلی واقعاً اجرا شدند. |

شکست RED روی v54b باقی است. نخستین تست v55 تا ذخیرهٔ همهٔ مسیرها گذشت ولی در انتها روی فرم خارج‌سامانهٔ ثبت‌شده/قفل‌شده، جست‌وجو می‌خواست؛ طبق حفاظت idempotency آن فرم تا «ثبت مورد جدید» عمداً disabled است. تست این حالت را صریحاً بررسی و سپس reset مجاز را انجام داد؛ محصول/حفاظت برای سبزشدن تست تغییر نکرد. اجرای موبایل نهایی منتظر پایان transition موجود Sidebar است؛ screenshot میانی به‌عنوان شاهد نهایی استفاده نشود.

بازبین مستقل واقعی فقط کد مرتبط را خواند؛ یافتهٔ ضروری گزارش نکرد. موارد پیشنهادی برای شاهد focus/keyboard/portal/disabled در مرورگر اجرا شدند؛ مرور را اجرای تست معرفی نمی‌کنیم. هیچ dependency تازه‌ای نصب، API یا permission گسترش، یا تاریخچه‌ای بازنویسی نشد.

## انتشار، نگهداری و بازگشت

plan SHA=`4707b8e0e2259048aef2cece530708ca4068c608be88fd0bb6a2625c31704b78`، control root=`/home/shahrahsystem_dev/khazaneh-upgrade-86778ed21002-v53`. ناشر آزموده‌شدهٔ unchanged `upgrade-preserve-v53.cjs`، SHA=`f25127818de13f4d3597971bcdf97cf0a4cb26b6b834c8508c05884be7053aa3`؛ v53 در نام ابزار، نسخهٔ پروتکل است. پنجرهٔ ورودی بستهٔ apex/www، drain درخواست و inquiry، خروج تمیز نویسنده، بکاپ/restore تازه و خارج سرور، install همان artifact، vault ack، سپس open اجرا شد. هر دو host در پنجره برای / و health و state پاسخ503 دادند؛ پس از بازگشایی200/401 مناسب برگشتند. بکاپ‌های قبلی حذف نشدند.

نسخهٔ بازگشت کد v54b با manifest=`c04924ad94ba0b14026a0778bf15ebfa53de64b5a4ff0fbe08ef393f5afa94b6` محفوظ است. تحت اختیار معتبر و pin/lock جاری، Node22 و همان ناشر control root را با plan SHA بالا و فاز `rollback` اجرا کنید؛ این مسیر DB و vault **جاری** را نگه می‌دارد و هرگز snapshot قدیمی را روی ثبت‌های جدید restore نمی‌کند. طبق قرارداد قبلی، rollback شبکهٔ استعلام را می‌بندد؛ فعال‌سازی مجدد پس از بررسی. بازیابی اضطراری crash با فاز recover محافظه‌کارانه و بدون بازکردن خودکار ورودی است. شکست gate یا تغییر config خارج plan نباید با overwrite دور زده شود.

Staging جاری `ops/private/permanent-staging-cost-center-v55` در `http://127.0.0.1:55120/`، همان رمزها/داده/vault قبلی با بکاپ است؛ داده یا کلید Production به آن منتقل نشد. استفاده: فهرست معمول مرکز هزینه یا ذره‌بین کنار آن؛ نام یا کد تایپ و نتیجه انتخاب شود. تایپ روی selectِ متمرکز نیز جست‌وجو را باز می‌کند. در فرم‌های بدون مرکز هزینه فیلدی اضافه نشده است.

تحویل مستقل از چت: releaseEvidence/final-evidence.json و handover-final/source-v55-released.tgz با inventory/hash و restore مستقل؛ ابزارهای لازم در handover-final/ops-tools. آرشیو source شامل DB، رمز، snapshot یا کلید خصوصی نیست. commit/push جدید NOT RUN.
