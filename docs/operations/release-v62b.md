# انتشار v62b — PASS / DEPLOYED،۲۰۲۶/۱۰/۲۵

مالک پس از [تحویل همین نامزد Stage](staging-v62-admin-user-entry.md)، صریحاً آزمون نهایی و انتشار روی دامنه را خواست. همان artifact در۱۳:۳۶:۳۳UTC باز و در۱۳:۳۶:۳۸UTC با مرورگر واقعی بررسی شد. مجوز شامل همین نسخه، بکاپ و حفظ داده/رمز/دسترسی فعلی است؛ reset، انتقال داده/کلید Stage، حذف کد و commit/push اجرا نشده‌اند.

## هویت و دامنه

هدف `https://shahrahsystem.ir`، مبدأ v61b با manifest=`0efae2b038c6f983a44e39de0f0c04517cf46d04795da08c70deeea07f8c29be`؛ مقصد همان v62b با manifest=`0e1d7676bd13a94e64709d19cd02316d926800c086159cd03bf718ed1c9951ee`. artifact تأییدشده بدون rebuild/تغییر کد برنامه،۳۵فایل خروجی است. رفتار طبق [ADR-027](../decisions/ADR-027-admin-user-entry.md): فقط ADMIN اصلی، دلیل اجباری، نشست مستقل و وابسته به والد، مجوزهای مقصد و حفظ دو هویت در سابقه؛ هیچ رمز/نقش کاربری عوض نمی‌شود.

work خصوصی `ops/work/release-v62b-20261025`، root سرور `/home/shahrahsystem_dev/khazaneh-upgrade-0e1d7676bd13-v53` و release `/home/shahrahsystem_dev/khazaneh-release-0e1d7676bd13`. planSHA=`88fbedb6d3683506a481fecc1e829653b9c99d23944e1e823aee65da67c5e778`؛ publisherSHA=`5fe0c0a3b773bec5fdacd835675e5d8e5c54677e41783d269f356efafcfb41df`؛ payloadSHA=`921e5f378a13b24004a2bb614992025b97d1589fa3b35dd4f3f81e64fbda14af`. پسوند legacy-v53 نام ابزار است، نه نسخهٔ محصول. preflight تازه۱۳:۳۳:۱۸UTC همان v61b/configSHA=`fad715084f6f229b583fde9e103c48e80f5206181d1dd476423c28e9a53fd4cd`، SQLite/schema۱/quick_check=ok، نشست معتبر ADMIN و inquiry معلق صفر را تأیید کرد.

## گیت‌های واقعی

Stage:۵۰۵تست هرadapter روی backend/domain یکسان با proof بازاستفاده، build/typecheck،دو اجرای مرورگر دسکتاپ/موبایل و دو تب، نمایش هر دو هویت و لایه modal،restore/restart/current-state preservation PASS. بازاجرای تازهٔ۱۰تست حساس روی server.cjs دقیق v62b، هم JSON و هم SQLite PASS (`release-admin-entry-{json,sqlite}`)؛ denied role/credential/vault alias، retry/failure/restart، پرداخت جزئی/اعلان/گزارش و ابطال والد پوشش دارند. این‌ها آزمون روی Production نیستند.

Linux Node22/SQLite،PM2_HOME و5355/5356مستقل و outboundguard: ارتقای v61b→v62b با پرداخت جزئی/پیوست قدیمی، برابری همهٔ فیلدها و backup/restore PASS؛ ماتریس چهار مسیر/اعلان، مستقیم حسابداری، اصلاح stale،کار باز/اختیار مدیر،export و حساب مبدأ حقوقی متفاوت PASS.۷کنترل ورود مدیریتی و CURRENT-recovery/انتساب جدید و قبلی، توقف واقعی backend،SIGKILLناشر پس از backup و سه تلاش UUID مستقل PASS؛ logout والد،child را بعد از recovery باطل و نشست واقعی مقصد را حفظ کرد. `lab-{exercise,recovery,finish}.log` شواهدند؛ سنجش ظرفیت تازه نیست.

## بازبینی مستقل و ابزار recovery

بازبین خواندنی دو نقص ابزار انتشار را VALID کرد؛ هیچ فایل artifact عوض نشد. مسیر توقف پیش از INSTALL_ADMITTED اکنون helper `abort-before-install.cjs` با SHA=`37b0966d097b1b4831c4d456b7733ceb0a70cd62b34d78974267d7a851e567f0` دارد: فقط config اصلی/عدم پذیرش نصب/نبود child، CURRENT DB/vault و backup/restore مستقل، سپس همان binary قبلی با برابری state؛ هرگز restore دادهٔ قدیمی. lease سازگار pid/start/nonce،AEAD جفت کلید restored و fail-closed admission دارد. تمرین SIGKILLپیش از تکمیل prepare در rootمصنوعیbd15 و تطبیق hash/امتناع واقعی پس از admission PASS (`ops-abort-interrupt-final.log`,`ops-helper-final.log`). bd14 شاهد قدیمی helper است، نه گیت نهایی.

`vault-inventory-v62b.cjs` هر بار پوشهٔ `vault-backup-attempt-UUID/new-vault-backup` مستقل می‌سازد؛ tar،دانلود،restore مستقل خارج سرور و ack همان snapshot لازم است. در Linux، تغییر کلید مصنوعی،رد ackقدیمی،دوinventory مستقل،دوrestore خارجسرور و پذیرش ackجدید توسطopen PASS (`ops-vault-*`). خطای ابتدایی tar ویندوز با مسیر فارسی در harness،با cwd ونام نسبی اصلاح و دوباره اجرا شد؛ داده یا gate محصول تغییر نکرد. خطای cleanupآزمایش اولیه فقط خروجی آغازdaemonPM2 بود؛ اجرای تازه موفق و سابقه حفظ شد.

## اجرا و بازیابی

maintenance → drainHTTP/inquiry → توقف تمیز writer → backup تازهٔ تمام داده/فایل/code/config/vault → restore مستقل داخل و خارج سرور → ack مطابق → installهمانartifact → startup equality → بررسی خواندنی نشست موجود/تنظیم اتصال/assets → backupمستقلvault وack → open → health/publicbrowser/monitor. همانDB/schema۱وvaultخصوصی جاری استفاده می‌شود؛migration/seed/reset/patchACL نداریم. نسخهٔ دادهٔ Stage منتقل نمی‌شود.

پس از شروع نصب، فقط `recover` سپس `rollforward` با **CURRENT DB/vault و v62b سازگار** مجاز است؛ بازگشت به v61b با child sessionها ممنوع و snapshotقدیمی روی ثبت تازه restore نشود. هر recovery بکاپ UUIDتازه دارد؛ پس از آن vaultinventory تازه وrestoreخارجسرور/ackلازم است وopenجداست. پیش از پذیرش نصب،`recover` سپس helperabortبالا باplanpinشده می‌تواند فقط binaryقدیمی/دادهٔ جاری را باز کند؛ سپس تلاش انتشار بهplan/rootتازه نیاز دارد. config/runtimeناشناخته failclosed است، نه بازنویسی خودکار.

## نتیجه و حدود

Production PASS: `production-prepare.log` توقف تمیز و بکاپ سازگار/restore داخل سرور؛ `production-backup-inventory.log`۵۸فایل با manifest=`92485354662ce39a24eed2bc6a31ee36ea1acf3df2cd831ec915b47a4a218b75`. بکاپ خارج سرور در `ops/private/release-v53-v62b-20261025` با ACL خصوصی؛restore مستقل SQLite/code/data/config و AEAD vault و ack مطابق PASS. verifier ابتدایی ویندوز بدون loader مربوط به importهای extensionless TypeScript متوقف شد؛ با loader موجود `tests/native-types.mjs` دوباره اجرا و PASS شد؛ گیت دور زده نشد و سرور تا پذیرش ack بسته ماند.

`production-install.log` startupبرابرهمهفیلدها،رمز/نقش/فایل/تنظیماتاستعلاممحفوظ،همانSQLite/schema۱ وvaultخصوصی و نشست موجودADMIN PASS. بکاپ مستقل vaultدرattempt=`80cbdf42-d672-4211-985e-8c54a158111b`،دو فایل و manifest=`a59e294fb6e6b1e0badc5a5973d650276def7b83cb81b2b23f9db68f282a5c44`؛restoreخارجسرور وackمطابق PASS. `production-open.log` در۱۳:۳۶:۳۳٫۷۶۵UTC بازشد؛configSHA=`f1a42111a261931fc440cdf9a3499eaeb7920b64b275a0cb12db0c6e43c2e512`،backendPID561422 وgatewayPID561746.

`production-verify.log`: health،SQLite quick_check=ok،assetها/نشست موجودمدیر/تنظیماتاتصالPASS،restart۰ وerror signature۰ درtailبررسی‌شده. `public-smoke-final/result.json`: Edgeدسکتاپ/موبایل،برند/UTF-8،hashفایل‌هایJS/CSS/hero/قالببانک،دامنه/www و401ناشناس،بدونoverflowیاخطایمرورگرPASS. پایشکوتاهپایان۱۳:۳۸:۳۴UTC در `production-monitor.log` PASS:همانPIDها،restart۰،error signature۰،quick_check=ok؛پایشبلندمدت ادعانمی‌شود. فرآیندهایlabمصنوعی متوقف و داده/بکاپشان حفظ شدند؛Stageخصوصی تغییری نکرد. `final-evidence.json` هویتartifactوگیت‌هایواقعی را یکجا تطبیق می‌دهد.

بازبین مستقل خواندنی با۴۴فایل/hash بسته،اصلاح و تمرینhelperها وackمصنوعیجدید مانع بازتازه‌ای پیدا نکرد؛ شبکه/DBخصوصی/تستاجرا نکرد. فشار/soakتازه،پیامک/بانکواقعی،ورود/خروج یا عملیاتمالی روی Production وپاک‌سازی/commit/push NOT RUN. F02/F04/F05قدیمی خارج دامنه‌اند؛ این انتشار ادعای صفر باگ یا تأیید کل سامانه نیست. برای امتحان: باADMINاصلی،«مدیریت کاربران»←کنارکاربرفعالغیرمدیر،«ورود به این دسترسی»؛دلیل ثبت و نواربازگشت/هردوهویت دیدهشود. این ورود اجازهٔعملیاتواقعی بااختیارمقصد دارد،نهحالتنمایشی.
