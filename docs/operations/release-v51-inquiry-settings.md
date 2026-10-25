# v51 — تنظیمات امن اتصال استعلام؛ PASS / DEPLOYED

## هویت و دامنه

- مجوز مشخص مالک: تکمیل تنظیمات اتصال و انتشار روی `shahrahsystem.ir`، ۲۰۲۶/۱۰/۲۴. مجوز انتشار آینده یا انتقال کلید Staging نیست.
- بازگشایی: `2026-10-24T09:01:52.090Z`، ساعت۱۲:۳۱:۵۲ تهران؛ سایت در حالت نگهداری باقی نمانده است.
- manifest نهایی: `846bab97482f626acddee831b4772e18e43cac46a1ce338bb15328b000a94688`؛ ۳۸ خروجی،۱۰۷ منبع،۱۳۲ ورودی build-proof. مسیر سرور: `/home/shahrahsystem_dev/khazaneh-release-846bab97482f`.
- Git مبنا `6d5882b5d27a8f600b714cb4d1f3c97831cb7bc6`؛ شاخه `codex/inquiry-settings-v51`. تغییرات v51 محلی‌اند؛ این درخواست commit/push تازه نبود و GitHub هنوز v50 است. manifest، نه HEAD قدیمی، هویت نسخهٔ زنده است.
- `app=C:/Users/reza/Desktop/khazaneh`؛ `ops=C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh`؛ شواهد جدید: `ops/work/inquiry-settings-v51-20261024`.

## علت و اصلاح

مدیریت اتصال/vault فقط در runtime آزمایشی ساخته می‌شد؛ به همین دلیل نه صرفاً ظاهر، بلکه API ذخیرهٔ اتصال در Production نیز آماده نبود. [ADR-018](../decisions/ADR-018-production-inquiry-connection-management.md) مرجع تصمیم/قرارداد است.

مدیریت اتصال از اجازهٔ تماس شبکه جدا شد. نام دلخواه، قرارداد پشتیبانی‌شده، فیلدهای تنظیمات/credential مختص قرارداد، مشخصات readonly endpoint/auth، انتخاب صریح، کلید write-only و تست اتصال در «مدیریت اطلاعات پایه ← تنظیمات استعلام کارت و شبا» هستند. خزانه فقط وضعیت و ابزار عملیاتی دارد. ذخیره/انتخاب کلید به‌تنهایی تماس یا تغییر دادهٔ عملیاتی نمی‌سازد؛ کلید خالی، کلید موجود را پاک نمی‌کند.

فقط یک قرارداد واقعی REST اکنون پیاده‌سازی شده است. این فرم ادعای اتصال به API هر سایت صرفاً با تغییر کلید ندارد. افزودن ارائه‌دهنده با قرارداد متفاوت نیازمند مستندات URL/auth/ورودی/خروجی و adapter/allowlist آزموده‌شده است؛ URL، header و parser اجرایی دلخواه پذیرفته نمی‌شوند. کلید واقعی فقط در فرم امن وارد شود، نه چت/Git/گزارش.

LIVE برای مصرف، تأیید صریح مدیر، شرکت‌های فعال، سقف روزانه و نسخهٔ اتصال را لازم دارد؛ تعویض کلید/اتصال پذیرش قبلی را نامعتبر می‌کند. مجوز در auto/claim/dispatch/apply کنترل می‌شود. رد قطعی operation تازه پیش از ایجاد آن،400 است تا دکمهٔ تلاش بعدی قفل نشود؛ replay/conflict و commit مبهم همچنان حفاظت قبلی را دارند. مجوز نقش‌ها، نام گیرنده، مبالغ و جریان مالی تغییر نکردند.

## آزمون و محدودیت

| وضعیت | دامنه و شاهد |
|---|---|
| PASS | RED اولیهٔ runtime تولید۳شکست/۲موفق؛ پس از اصلاح۵/۵. `inquiry-runtime.test.ts` |
| PASS | `native-final-sqlite.log`: ۳۹۰/۳۹۰ روی artifact نهایی؛ auth/API/SQLite واقعی، provider مصنوعی. |
| PASS | `native-final-json-diagnostic.log`: ۳۹۰/۳۹۰؛ همچنین۳۰ تکرار مستقل۴تستی form-date. |
| FAIL | اجرای نخست JSON،۳۸۹/۳۹۰: یک POST گروهی در form-date-api قبل commit با500. در اجرای متمرکز،۳۰تکرار و suite کامل بازتولید نشد؛ علت **حل‌شده نیست**. stderr تشخیصی در test افزوده و شکست اصلی حفظ شده است. Production فقط SQLite است و مسیر عمومی ذخیره تغییر نکرده؛ بازبین مستقل این فاصله را مانع مشخص این انتشار SQLite ندانست. |
| PASS | مرورگر Edge واقعی: Production-shaped شبکه باز/بسته، کلید A/B، CAS/تعویض، reload، دو تب، رضایت مصرف، retry و desktop/mobile؛ سه پوشه `ops/work/hardening-ui-inquiry-v51-final-{open,closed,stage}-20261024`. فقط provider مصنوعی است. |
| PASS | مرورگر مالی/مجوز/صفحه: `ops/work/hardening-ui-v51-final-smoke-20261024/result.json`؛ bank-reason-journey،security-treasury،ui-smoke. |
| PASS | `npm run build` شامل tsc/Vite؛ frozen build-proof. مرورگر خصوصی دائمی: `permanent-staging-login/result.json`؛ ورود/خروج/UTF-8/redirect/cookie و۱۸asset. |
| PASS | بازبینی مستقل واقعی سورس/مجوز و انتشار/بازیابی انجام شد؛ یافتهٔ handle400 و vault نیمه‌ساخته اصلاح و بازآزموده شدند. |
| NOT RUN | هیچ کلید واقعی، استعلام پولی یا پیامک واقعی در این مأموریت فراخوانی نشد. موفقیت قرارداد مصنوعی، تأیید اعتبار کلید مالک نیست. |
| NOT RUN | فشار/soak تازه لازم نبود: صف/ثبت مالی عمومی تغییر نکرد. نتایج ظرفیت کوتاه v50 تاریخی‌اند، تضمین ظرفیت این ارائه‌دهنده یا رشد آینده نیستند. |

بازاجرای suite، از app با root تازهٔ مصنوعی و `TREASURY_TEST_SERVER=<artifact>/server.cjs` و `TREASURY_TEST_STORAGE=sqlite|json`:

```powershell
$files = Get-ChildItem -LiteralPath tests -Filter '*.test.ts' | ForEach-Object FullName
node 'C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/tools/run-check-v51.cjs' UNIQUE-LABEL @files
```

برچسب باید تازه و حروف کوچک/عدد/خط‌تیره باشد؛ harness فقط root مصنوعی تازه می‌سازد. دستور تست را روی دیتای دامنه اجرا نکنید. دستورات مرورگر و انتشار، ابزارهای نام‌دار v51 و manifest/planهای شواهدند.

## حفاظت و انتشار

| وضعیت | شاهد |
|---|---|
| PASS | gate عمومی بسته، درخواست‌های HTTP تخلیه، نویسندهٔ قبلی PID158327 باcode0 متوقف، lease حذف و port آزاد اثبات شد. `production-prepare.log` |
| PASS | بکاپ کد/config/DB/تمام درخت فایل‌ها، restore مستقل سرور و خارج سرور؛۵۵فایل، manifest=`d8c4f6a7d3c0b4629e25c50222e5e18a61c17f20fc28a4cff40e5b5469c627d9`. مسیر خصوصی `ops/private/release-v51-production-20261024`. همهٔ بکاپ‌های قبلی محفوظ‌اند. |
| PASS | همان SQLite schema1 در `/home/shahrahsystem_dev/khazaneh-data-raw-b26471c412d1/treasury.sqlite`؛ همهٔ فیلدها قبل/بعد دقیقاً یکسان: `KHZ-STATE-COMPAT-v51-001`. migration/backfill/reset انجام نشد؛ connectionVersion فقط پس از ذخیرهٔ صریح تنظیمات آینده نوشته می‌شود. |
| PASS | vault تازهٔ Production در `/home/shahrahsystem_dev/khazaneh-inquiry-secrets-v51`، owner/mode خصوصی و خارج release/data/document-root؛ KEK مستقل خارج سرور بازیابی شد. کلید سرویس Production هنوز تنظیم/فعال نشده؛ کلیدهای Staging opaque حفظ و منتقل نشدند. |
| PASS | config نهایی SHA=`11ef449971a28884c6528a43d913a0422ebfd372ac6f002f2b9ba7341fe8b972`؛ فقط vault و flag اختصاصی استعلام به backend افزوده شد؛ `DISABLE_EXTERNAL_INTEGRATIONS=true` برای سایر سرویس‌ها باقی است. |
| PASS | `production-release-result.json`؛ plan=`ef735436dacd6357f3c430edca50e733ee588c74a4ad267a0c0c51ca7e41face`؛ publisher=`23adeeb0c33f75591a4cfb2f90c20e22ca8730c359b1696963c0da62ddfcb661`. |
| PASS | کنترل read-only نشست موجود admin، تنظیمات اتصال، quick_check=ok،۳۸فایل، health200/ناشناس401؛ PID1488376/1488718،restart0،خطای مشخص در tail صفر. ورود/خروج یا عملیات مالی مصنوعی روی Production انجام نشد. `production-postcheck.json` |
| PASS | مرورگر عمومی HTTPS desktop/mobile،UTF-8،۴CSS/JS با hash منطبق،www/health و401؛ صفر خطای مرورگر. `public-browser/result.json` |

## بازگشت و نگهداری

ناشر مجاز این ارتقا `ops/tools/upgrade-preserve-v51.cjs` است؛ نسخهٔ عیناً منجمد روی سرور در `/home/shahrahsystem_dev/khazaneh-upgrade-846bab97482f-v51` محفوظ است. rollback، کد v50 با **DB و vault جاری** است؛ هرگز بکاپ قدیمی را روی ثبت‌های جدید restore نکنید. با حفظ config/runtime pin، فرمان زیر ابتدا ورودی را می‌بندد، drain/stop و snapshot جاری انجام می‌دهد، تطبیق می‌کند و فقط پس از سلامت باز می‌کند:

```text
/opt/node-v22/bin/node /home/shahrahsystem_dev/khazaneh-upgrade-846bab97482f-v51/upgrade-preserve-v51.cjs ef735436dacd6357f3c430edca50e733ee588c74a4ad267a0c0c51ca7e41face rollback
```

اگر config/runtime بعداً عوض شده، pin را دور نزنید؛ برنامهٔ تازه لازم است. `recover` برای crash فقط محیط را بسته نگه می‌دارد و مجوز بازگشایی/بازیابی دادهٔ قدیمی نیست. ناشرهای raw تاریخی ممنوع‌اند.

PASS — rehearsal مستقل Linux با همان artifact/publisher: پرداخت جزئی جدید۵۰۰۰،مانده۷۰۰۰،رسید/پیوست/کلید حفظ شد. قرارداد `KHZ-INQUIRY-ROLLBACK-v51-001` فقط RUNNING→UNKNOWN و QUEUED→CANCELLED و metadata متناظر را مجاز کرد؛ یک ارسال مصنوعی،صفر retry؛ باقی تمام state یکسان. `lab-rollback-result.json`،`lab-after-rollback.log`. نتیجهٔ نامشخص ممکن است قبلاً هزینه داشته باشد؛ خودکار دوباره نفرستید.

PASS — تزریق EIO هنگام ساخت master، سپس rollback با DB یکسان و حفظ opaque مخزن تازهٔ نیمه‌ساخته، بدون حذف/ساخت مجدد کلید؛ `lab-vault-fault-result.json`. مخزن قدیمی/ناشناختهٔ خراب همچنان fail-closed است. هر دو lab خاموش و داده/بکاپشان محفوظ‌اند.

Staging جاری: `ops/private/permanent-staging-inquiry-v51`، `http://127.0.0.1:55120/`؛ حساب/دروازه/vault قبلی با ACL خصوصی و backup/restore حفظ شدند. قابلیت واقعی آن همچنان فقط آزمون دستی تک‌ردیفیِ مصوب ADR-012 است، نه auto/batch. رمزها در ACCESS.txt خصوصی‌اند؛ در گزارش یا چت درج نشوند.

برای استفاده: شرکت‌های مجاز را تعریف/انتخاب، کلید را در تنظیمات امن ذخیره، اتصال منتخب را تست و پس از بررسی اعتبار، شرکت/سقف/خودکار را صریحاً تأیید کنید. رابط مشترک آماده است؛ اتصال ارائه‌دهندهٔ دیگری بدون adapter آزموده‌شده پشتیبانی نمی‌شود.
