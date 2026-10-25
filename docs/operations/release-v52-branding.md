# انتشار v52 — نام نمایشی شاهراه، ۲۰۲۶/۱۰/۲۴

## نتیجه — PASS / DEPLOYED

این وضعیت فقط تحویل نام نمایشی است. [ممیزی بعدی منو/اختیارات](../engineering/access-menu-audit-v52.md) **FAIL** و نیازمند اصلاح مستقل است؛ نتایج آن پنهان نشده و بهعنوانکنترل جامع موفق اینانتشار معرفی نشوند.

نام مصوب مالک: **سامانه جامع مالی و خزانه داری شاهراه**. همان نام در title/SEO، ورود/پاورقی، سربرگ پرتال و تصویر معرفی اعمال شد؛ برند ثابت پیامک و مثال‌های رابط «شاهراه» شد. نام واقعی شرکت‌ها، پیش‌فرض‌های domain/seed، سوابق، مبلغ، نقش، حساب، رمز و کلیدها rename یا reset نشدند. مجوز صریح مالک برای انتشار همین تغییر وجود داشت؛ مجوز دائمی نشر یا تغییر دسترسی نیست.

- هویت نهایی v52b: manifest=`2b1371f9f187e9b221615b7ebe62778abca0459f4a3deb47c6627bfbead9934e`،۳۸خروجی/۱۰۷منبع؛ مسیر `/home/shahrahsystem_dev/khazaneh-release-2b1371f9f187`.
- بازگشایی/زمان دقیق در `ops/work/branding-v52-20261024/production-cachefix-release-result.json`؛ کنترل مستقل پس انتشار `2026-10-24T09:52:44.800Z`، مرورگر عمومی `09:52:58.308Z` (۱۳:۲۲تهران).
- Git مبنا `6d5882b5d27a8f600b714cb4d1f3c97831cb7bc6`؛ شاخه `codex/branding-v52`، با حفظ تمام تغییرات v51. commit/push تازه انجام نشد؛ manifest هویت نسخه زنده است، نه HEAD.

## آزمون و دامنهٔ شاهد

| موضوع | وضعیت | شاهد زیر ops/work |
|---|---|---|
| محدودبودن تغییر | PASS | `branding-v52-20261024/copy-scope-cachefix.json`: فقط۷فایل نمایشی/برند؛۱۰۱منبع دیگر عین v51؛ در v52→v52b تنها LoginPage و URL نسخه‌دار تصویر تغییر کرد، server.cjs بایت‌یکسان است. |
| build/typecheck | PASS | `branding-v52-20261024/build-cache-fix.log` و build-proof داخل artifact؛ بدون dependency/schema/API جدید. |
| تست هدفمند | PASS | `branding-v52-20261024/focused.{json,log}`،۱۸تست امنیت پیامک/مخاطبان/نشست روی artifact v52؛ برای v52b با server binary یکسان بازاستفاده شد. |
| مرورگر مصنوعی | PASS | `hardening-ui-branding-v52-20261024/result.json`: پنج مسیر branding،ui-smoke،notification-sms-journey،master-data،multi-role. روی v52b دو مسیر branding/ui-smoke دوباره اجرا شد: `hardening-ui-branding-v52b-20261024/result.json`. عرض۳۲۰/۳۹۰/۱۴۴۰،فارسی/RTL،بدونoverflow. |
| Staging جاری | PASS | `private/permanent-staging-branding-v52b`،`http://127.0.0.1:55120/`؛ `branding-v52-20261024/staging-transfer-cachefix.json` و `staging-login-cachefix/result.json`. DB/vault/رمز دروازه/admin Stage حفظ؛ ورود/خروج/ورودمجدد و۱۸asset موفق. هیچ کلید Production به Stage منتقل نشد. |
| تمرین Linux انتشار/بازگشت | PASS | `branding-v52-20261024/lab-rollback-result.json`: همان publisher منجمد، نسخه‌های سازگارv51→v52، پرداخت/فیش/پیوست تازه و دادهٔ جاری حفظ؛ inquiry درحال‌اجرا UNKNOWN وqueued CANCELLED، بدونretry. publisher در اصلاحURL عوض نشد؛ آزمایش سالم دوباره اجرا نشد. |
| کنترل Production | PASS | `production-cachefix-postcheck.json` و `public-browser-cachefix/result.json` در همان پوشه:۳۸فایل داخلی،JS/CSS و تصویر ازHTTPS برابرmanifest؛ title،desktop/mobile،UTF-8،healthدامنه/www200،stateناشناس401،نشست موجودadmin خواندنی،restart0 و۰امضای خطا درtail. هیچ login/logout یا عملیات مالی آزمایشی رویProduction اجرا نشد. |
| فشار/کلsuite/سرویس واقعی | NOT RUN | تغییر فقط کپی وcacheتصویر است؛ فشار و suiteکامل نامرتبط تکرار نشد. حدود ظرفیت و محدودیتJSON/شروع‌سرد ازv50/v51 همچنان پابرجا؛ این تحویل گواهی امنیت یا تضمین ظرفیت نیست. پیامک/استعلام واقعی در آزمون این تحویل مصرف نشد. |

## شکست واقعی و رفع آن

FAIL — نسخهٔ میانیv52 با manifest=`ec0d86fdf996028b7c27004c18e7511c5a165b1ee3ada5d97327e1bff4d22308` رویسرور سالم بود، اما تست عمومی دریافتSVG قدیمی را پیدا کرد: apexبدونquery هشv51=`2542dfd6…`، درحالی‌که queryتازه وwww هشصحیح=`cab6689f…` می‌دادند؛ هدرMizbanCloud/max-age14400. فایلسرور خراب یا داده عقب‌گرد نکرده بود.

PASS — URL تصویر اکنون `?v=cab6689f18d9` دارد؛ تست مرورگر hashمحتوا را باquery وmanifest تطبیق می‌دهد. RED روی artifactقبلی واقعاً شکست خورد (`hardening-ui-branding-v52-cache-red-20261024`)، GREEN رویv52b موفق شد. assertion حذف یا ضعیف نشد؛ کش لایه بیرونی بدون نیازبهpurgeدستی دور زده شد. نسخهٔ میانی و شواهد شکست محفوظ‌اند.

## حفاظت و بازگشت

- PASS — پیش هردوانتشار،gateway بسته،درخواست‌ها وinquiryها drain،writer قبلی باخروجپاک متوقف،SQLite/code/config/files/vault snapshot وrestoreمستقل شد؛ همهٔ فیلدها پیش/پس با `KHZ-STATE-COMPAT-v52-001` یکسان. ثبت‌های تازه مالک بین دو انتشار هم دربکاپ دوم حفظ شدند؛ schema همچنان۱ است.
- PASS — بکاپ نهایی خارج‌سرور وprivateACL: `ops/private/release-v52-production-cachefix-20261024`،۵۹فایل،manifest=`84dc480b5b4c6fdff6f2b6f375b795964627f499fa86d85300f508389d4756e1`؛ SQLite وتمامفایل‌ها مستقل restore/hash شدند. vaultفعلی درمسیرخصوصیv51 محفوظ وpairرمزنگاری‌شده دوباره اعتبارسنجی شد؛ manifestدوم=`44d29f0bda28d68499fa39bc92b9f159b553d1f03286d1eb688d92f56c3ed8d9`. محتوا/کلید درگزارش یاGit نیست؛ بکاپ‌های قبلی حذف نشدند.
- publisher بدونتغییر: `ops/tools/upgrade-preserve-v52.cjs`،SHA=`061d835ac6cd18c375ff9526b917f66dc381c839ca00c3ccb40e4cb609afbc98`؛ planنهاییSHA=`19a30de2b48b7ffae47b4f3ce2585e36023107fbf490b50ca74b89ef1b437df6`؛ controlroot=`/home/shahrahsystem_dev/khazaneh-upgrade-2b1371f9f187-v52`.
- بازگشت مجاز کد ازهمان controlroot: `node ROOT/upgrade-preserve-v52.cjs PLAN_SHA rollback`. اینفرمان **CURRENT DB/vault** را نگه می‌دارد،نه restoreبکاپقدیمی؛ شبکهٔ اختصاصی استعلام تا بررسی اپراتور falseمی‌ماند. پسrollforward/rollback،هویتruntime،health،فایل‌ها وقراردادdataدوباره بررسی شوند. هرگز publisherخام تاریخی یاreset اجرا نشود.
- PASS — فقط flagاختصاصی مدیریت استعلام طبقv51 موجود است؛ guardعمومی سایر سرویس‌ها trueماند. کلید موجود مالک حفظ، اتصال هنگامکنترل فعالنبود؛ عامل فعال‌سازی یااستعلامواقعی نکرد.

## بازتولید محدود

در app: `npm run build`؛ `node --import ./tests/native-types.mjs OPS/tools/hardening-ui.mjs ARTIFACT NEW_OUTPUT branding,ui-smoke`؛ خروجی تازه با پیشوند `OPS/work/hardening-ui-` انتخاب شود. ابزار `verify-public-v52b.cjs NEW_OUTPUT` فقط GETعمومی/مرورگر دارد و خروجی تازه زیرtask می‌خواهد. ابزارهایpublisher باplan/hashوphase اجرا می‌شوند،نه باrerunخودسرانهprepare رویrootقبلی. براینسخه تازه،root/plan/baselineخودش لازم است.
