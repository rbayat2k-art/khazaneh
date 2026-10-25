# v54b — شرکت‌های مجاز نقش، PASS / DEPLOYED

## دامنه و نتیجه

مجوز صریح مالک در ۲۰۲۶/۱۰/۲۴: افزودن تنظیم شرکت به فرم نقش‌ها، محدودکردن نقش APPROVER به فقط شرکت مشترک موجودِ دو کاربر مورد اشاره و انتشار با حفظ سایر اطلاعات. شرکت پروفایل، عضویت سازمانی است؛ فهرست شرکت‌های نقش، مجوز مستقل است. علت حذف سرپرست از انتخاب، مجازنبودن شرکت در نقش بود، نه نام یا فعال‌بودن کاربر. رابطهٔ سرپرست کاربران تغییر داده نشد؛ مالک اکنون می‌تواند انتساب را ذخیره کند. نام/شناسه‌های شخصی در این سند ثبت نشده‌اند.

- PASS — انتخاب checkbox در فرم فعلی، ID ثابت برای انتخاب جدید، خواندن alias نام/فاصلهٔ قدیمی، نمایش و امکان حذف مقدار legacy ناشناخته. چندنقشی همچنان اجتماع شرکت‌هاست؛ ADMIN همچنان همهٔ شرکت‌ها را دارد.
- PASS — ذخیرهٔ metadata فهرست شرکت‌ها را نمی‌فرستد و canonicalize نمی‌کند. تغییر صریح با `expectedAllowedCompanies` انجام می‌شود؛ تعارض409 و ورودی/شرکت جدید نامعتبر400، پیش از mutation و audit. مجوزهای فعلی سرور محفوظ‌اند.
- PASS — فقط `APPROVER.allowedCompanies` به یک ID شرکت موجود تغییر کرد؛ updatedAt/updatedBy و یک audit مربوط نیز ثبت شدند. تطبیق کل rawDB با همین allowlist، برابری تمام کاربران، password hash/salt، نشست‌ها، دیگر نقش‌ها/مجوزها/سقف‌ها و داده‌های مالی/فایل‌ها را اثبات کرد. سرپرست کاربر هدف دست‌نخورده است. این تنظیم روی تمام کاربران همان نقش اثر دارد، نه فقط یک کاربر.

قرارداد و علت: [ADR-020](../decisions/ADR-020-role-company-selection.md). رفتار قبلی بدون مجوز مالک به قانون تازه تبدیل نشده است.

## هویت نسخه

- manifest: `c04924ad94ba0b14026a0778bf15ebfa53de64b5a4ff0fbe08ef393f5afa94b6`؛ نسخهٔ برگشت کد v53f با manifest `e845223b6489f8abe1fd385df7a9cbbb6e80c7a621b5038b47fea864f1c0043e`.
- بازگشایی: `2026-10-24T11:32:23.115Z`، برابر ۱۵:۰۲:۲۳ تهران. سایت: `https://shahrahsystem.ir`؛ release: `/home/shahrahsystem_dev/khazaneh-release-c04924ad94ba`.
- Git مبنا `6d5882b5d27a8f600b714cb4d1f3c97831cb7bc6`، شاخه `codex/role-companies-v54`؛ تغییرات قبلی حفظ شده‌اند. NOT RUN — commit/push جدید؛ manifest و آرشیو source تحویلی هویت دقیق این نسخه‌اند، نه HEAD قدیمی.
- همان SQLite/schema1، مسیر data و vault قبلی؛ NOT RUN — migration/reset، چون هیچ schema یا قرارداد ذخیره‌سازی عوض نشد.

## شواهد و بازتولید

`app=C:/Users/reza/Desktop/khazaneh`؛ `ops=C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh`؛ `evidence=ops/work/role-companies-v54-20261024`؛ `releaseEvidence=ops/work/production-v54-20261024`.

| وضعیت | کنترل | مدرک |
|---|---|---|
| PASS | build/typecheck و انجماد خروجی | evidence/build-b.log؛ artifact `ops/work/domain-release-multi-role-companies-v54b-20261024` و build proof |
| PASS | ۴۱۷ تست SQLite، صفر fail/skip | evidence/full-sqlite-final.json و log؛ run-check-v54.cjs با storage=sqlite و همان server.cjs |
| PASS | ۴۱۷ تست JSON، صفر fail/skip | evidence/full-json-final.json و log؛ همان فرمان با storage=json |
| PASS | مرورگر واقعی انتخاب شرکت، حفظ draft در poll، reload، mobile RTL، legacy، metadata، انتخاب/ثبت سرپرست مصنوعی و ADMIN | ops/work/hardening-ui-role-companies-v54c-20261024/role-companies/result.json |
| PASS | منوها، سرپرست و چندنقشی نسخهٔ منجمد | ops/work/hardening-ui-role-companies-v54b-20261024، سه نتیجهٔ menu-permissions/role-supervisor-menu/multi-role؛ نتیجهٔ اولیهٔ role-companies در همان پوشه FAIL تاریخی است، نه گیت نهایی |
| PASS | Staging حفظ داده/رمز/vault و ورود/خروج/دروازه/۱۸ asset | evidence/staging-transfer.json و staging-login/result.json |
| PASS | Linux ارتقا با startup بدون تغییر rawDB، patch محدود، mutex ناشر و hash اشتباهِ gateway بدون write | evidence/linux-lab-install.log و role-company-guard-result.json |
| PASS | ثبت تازه، پرداخت جزئی/فیش/attachment و retry409، rollback CURRENT بدون ازدست‌رفتن آن‌ها و تنظیم تازهٔ نقش | evidence/linux-lab-new-writes.log، lab-rollback-result.json و linux-lab-rollback-verify.log؛ lab مصنوعی مستقل و پردازش‌هایش متوقف شدند |
| PASS | بکاپ تازهٔ کد/config/DB/فایل/vault، restore مستقل روی سرور و خارج آن | private backup ack و vault ack؛ ۵۹ فایل، manifest بکاپ `b699cc44f8ab09916e6ac257739fb379bcd17f7e76e20de3311ad1b0ca6d14d4` |
| PASS | patch واقعی، حفظ تمام موارد خارج از allowlist، گزینهٔ سرپرست از نظر مجوز/شرکت اکنون معتبر | releaseEvidence/role-company-result.json؛ snapshot واقعی خصوصی است و منتشر نشود |
| PASS | سلامت سایت باز، SQLite quick_check، نشست موجود مدیر، API匿名401، assets و مرورگر desktop/mobile/apex/www | releaseEvidence/post-release-readonly.json و public-browser/result.json |
| PASS | پایش پس از بازگشایی، همان PID، restart صفر و امضای خطای مشاهده‌شده صفر | releaseEvidence/post-release-monitor.json، ساعت11:34:05UTC؛ پایش کوتاه است، نه soak |
| NOT RUN | ورود/خروج یا تراکنش آزمایشی روی Production؛ استعلام/پیامک واقعی، فشار جدید | عمداً اجرا نشد؛ تست‌های مصنوعی و گیت‌های مناسب این تغییر استفاده شدند. ادعای ظرفیت تازه نیست. |

RED معتبر: تست‌های جدید روی v53f نشان دادند ورودی شرکت نامعتبر و CAS stale پذیرفته می‌شدند؛ شواهد `ops/work/menu-permissions-v53-20261024/role-company-red.*` حفظ شدند. نخستین suite v54 چهار شکست داشت: fixtureهای قدیمی catalog شرکت خالی داشتند و اعطای نام ناشناخته می‌خواستند؛ fixture با دو شرکت مصنوعی معتبر کامل شد، نه assertion یا امنیت ضعیف. دو شکست مرورگر مربوط به selector ردیف حذف‌شده و عنوانِ عمداً ویرایش‌شده بودند؛ assertionهای رفتار محفوظ و اجرای نهایی PASS است.

بازبینی مستقل واقعی فقط‌خواندنی انجام شد. یافتهٔ VALID تطبیق whitespace در helper و UI و تست اصلاح شد. یافتهٔ VALID قفل انتشار در ابزار patch، پیش از اجرای زنده اصلاح و با denial بدون write و patch واقعی Linux تست شد؛ یافتهٔ معتبر باز گزارش نشد. خودبازبینی به‌عنوان بازبینی مستقل معرفی نشده است.

## انتشار و بازگشت

plan SHA: `a458e501c02a8dc9681c4b4d944d5a9821a0f1d3ee8aec20bfc8a39018d38d79`؛ control root: `/home/shahrahsystem_dev/khazaneh-upgrade-c04924ad94ba-v53`. نام v53 در ابزارها، نسخهٔ پروتکل ناشر آزموده‌شده است، نه نسخهٔ محصول. ناشر unchanged با SHA `f25127818de13f4d3597971bcdf97cf0a4cb26b6b834c8508c05884be7053aa3` اجرا شد؛ ابزار patch منجمد SHA `c824910795cc7618f853ec2ed1f95a2d5b87e49a3d7812e38454d5f6a4fdc57d` است.

ورودی عمومی apex/www در پنجرهٔ نگهداری بسته، active request و inquiry تخلیه، نویسندهٔ قبلی با خروج تمیز متوقف، بکاپ تازه restore و خارج سرور verify شد. سپس همان binary نصب و startup raw برابر شد؛ پس از آن patch مجاز با session موجود، CAS و همان mutex ناشر اعمال شد. `allFieldsIdentical` داخل upgrade-state شاهد سازگاری startup **قبل از patch مجاز** است؛ تطبیق پس از patch در role-company-result قرار دارد. این دو را با یکدیگر اشتباه نکنید.

ابزار patch، lock پنجره/plan، config، PID/start/cwd/exe، runtimePins و تنها listener loopback را کنترل و lease اجرای ناشر را تا پایان نگه می‌دارد؛ gateway بسته و active=0 قبل write و پس از smoke دوباره تأیید می‌شود. در INSTALLED ناشر عمداً gateway-state با hash نسخهٔ قبلی در maintenance می‌ماند؛ runtime args نامزد جدید pin شده و open hash را به نسخهٔ جدید تغییر می‌دهد. خطای مبهم پس از POST با mutationMayHaveCommitted گزارش می‌شود: در این حالت retry یا restore کور ممنوع است.

برای بازگشت تحت مالکیت معتبر، با SSH مجاز و بررسی عدم تغییر خارج از plan، همان Node22 و ناشر منجمد را با plan SHA بالا و فاز `rollback` اجرا کنید. این مسیر DB/vault **جاری** را نگه می‌دارد؛ از بکاپ پیش انتشار روی دادهٔ جدید restore نکنید. نسخهٔ v53f UI شرکت را ندارد ولی لیست جدید در داده باقی می‌ماند. طبق قرارداد موجود rollback، شبکهٔ استعلام بسته می‌شود و فعال‌سازی دوباره نیازمند بررسی است. بکاپ‌ها و نسخهٔ پیشین حذف نشدند.

Staging جاری: `ops/private/permanent-staging-role-companies-v54`، `http://127.0.0.1:55120/`؛ حساب و رمزهای قبلی از ACCESS.txt خصوصی محفوظ‌اند. هیچ داده/کلید واقعی Production به آن منتقل نشد.

تحویل مستقل از چت: `releaseEvidence/final-evidence.json`، آرشیو کامل source در `handover-final/source-v54-released.tgz` با inventory/hash و restore بررسی‌شده، و ابزارهای اجرایی لازم در `handover-final/ops-tools`. فایل‌های واقعی DB/تنظیمات/کلید فقط در ریشهٔ خصوصی بکاپ باقی می‌مانند و داخل آرشیو source نیستند. بررسی whitespace با شناخت CRLF (`git -c core.whitespace=cr-at-eol diff --check`) انجام شود؛ حالت پیش‌فرض Git این checkout، CR انتهای خطوط تغییرکردهٔ قبلی را whitespace اعلام می‌کند و برای پاک‌کردن آن کد منجمد بازنویسی نشد.

## محدودیت نگهداری

این کار فهرست شرکت‌های سایر نقش‌ها را تصحیح یا از روی پروفایل کاربران استنتاج نمی‌کند. انتخاب شرکت به‌تنهایی مجوز تأیید یا پرداخت ایجاد نمی‌کند. عملیات صریح «بازنشانی کامل نقش به پیش‌فرض» همان رفتار قبلی را دارد و ممکن است فهرست قدیمی پیش‌فرض را برگرداند؛ برای اصلاح شرکت از کنترل جدید استفاده کنید، نه reset. تضمین عمومی ظرفیت/امنیت یا اختیار تغییر آینده از این انتشار نتیجه نمی‌شود.
