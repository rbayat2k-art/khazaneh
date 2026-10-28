# انتشار v61b — PASS / DEPLOYED،۲۰۲۶/۱۰/۲۵

مالک پس از [پذیرش همین نامزد Stage](staging-v61-revision-export.md)، صریحاً انتشار روی دامنه با بکاپ و حفظ اطلاعات/رمز/دسترسی را خواست؛ پاک‌سازی کد ممنوع ماند. همان artifact در 08:49:39 UTC باز و در 08:49:59 UTC با مرورگر واقعی بررسی شد؛ بخش‌های آماده‌سازی پایین سابقهٔ همان اجرای موفق‌اند.

## هویت و گیت پیش از تغییر

دامنه `https://shahrahsystem.ir`، مبدا v57b با manifest=`309c04c79a22058188487f07b6a283e3793e0497e01054f6252ca0f680a19b21`؛ مقصد **همان** v61b با manifest=`0efae2b038c6f983a44e39de0f0c04517cf46d04795da08c70deeea07f8c29be`، بدون rebuild/تغییر runtime source. Stage495تست هرadapter/۱۰مرورگر و backup/restart، با همان هویت بازاستفاده می‌شوند، نه ادعای اجرای دوبارهٔ آن‌ها در Linux. هیچ Stage DB/key به دامنه نمی‌رود.

preflight خواندنی08:26:34Z، configSHA=`53b736e509460e9cb0a55138b3af08fa5a03ed67159c62b7e9e0184cde31117f`، همان PIDهای backend2446750/gateway2447026، SQLite/schema۱/quick_check=ok، نشست معتبر موجود ADMIN و صفر inquiryQUEUED/RUNNING. نصب۴۳فایل payload به release مستقل انجام شد ولی runtime/data/config هنوز تغییر نکرده بود.

work خصوصی `ops/work/release-v61b-20261025`، root نصب `/home/shahrahsystem_dev/khazaneh-upgrade-0efae2b038c6-v53` و release `/home/shahrahsystem_dev/khazaneh-release-0efae2b038c6` است. planSHA=`6da4ee3cf6efbcc4857bded4702a16d9112ced0fd79d2d032aa146db1233992f`؛ publisherSHA=`5fe0c0a3b773bec5fdacd835675e5d8e5c54677e41783d269f356efafcfb41df`؛ payloadSHA=`efec2d09441e569009476dfdbca79e2b40acfb91133f3f27b5378290d19772ef`. نام legacy-v53 فایل/پسوند root نشانهٔ نسخهٔ برنامه نیست؛ کپی ناشر خصوصی با hash بالا freeze شده و ابزار تاریخی اصلی تغییر نکرده است.

## تمرین Linux و مرور مستقل

همان candidate روی Node22/SQLite در root مصنوعی مستقل، PM2_HOME و5355/5356مستقل و outboundguard اجرا شد؛ داده واقعی وارد آن نشد. upgrade از همان v57b با پرداخت جزئی/پیوست قدیمی، all-fields equality و backup/restore داخل lab PASS. ماتریس چهار تأییدکننده/اعلان فقط گیرندهٔ درست و deniedwrongsupervisor، مدیر بدون سرپرست/overrideمستقیم حسابداری، دوچرخهF01،کارباز/اختیار موردی مدیر با provenance،F03/انتقال مستقل و حساب مبدأ حقوقی متفاوت PASS.

بازیابی، stop واقعی PM2 سپسrecover،SIGKILLناشر پس از backup،recover وrollforward و یک چرخهٔ دوم را گذراند؛۳پوشهٔ UUID مستقل، CURRENT DB/vault،ثبت‌های بعد انتشار و password/role/route/manualcompany محفوظ. بررسی fresh `lab-final-verified.log` این وضعیت DEPLOYED/PASS را تأیید کرد. timeout۶۰ثانیه‌ای controller SSH در اجرای طولانی محفوظ است؛ اجرای remote ادامه داشت و نتیجه از آن timeout حدس زده نشد. خطاهای fixtureUID و prefixکلیدثبت و rolefixture مانده از اجرای قبلی نیز نگه داشته شدند؛ محصول/تست اصلی برای سبزشدن تغییر نکرد.

بازبین مستقل خواندنی،۳۵خروجی artifact را تطبیق و خطر rollback قدیمی و۳نقص ابزار recovery را VALID کرد. کپی ناشر خصوصی اصلاح شد: rollbackبهv57b رد؛ هر تلاش backup مستقل؛ recover باconfig/runtimeشناخته‌شده؛rollforward بهinstallAdmitted و ackبکاپ متناظر وابسته است. بازخوانی نهایی همین hash بدون مانع تازه بود؛ بازبین تست/remote اجرا نکرد.

## اجرای کنترل‌شده و recovery

maintenance → drainHTTP/inquiry → توقف تمیز writer → backup تازهٔ تمام درخت داده/کد/config/vault → restore مستقل داخل سرور و خارج سرور → ackهش‌شده → installهمانartifact → rawstartup equalityهمهفیلدها → نشست موجود و assets/settings → backupمستقلvault → open. هیچ seed/reset/migration یا patchنقش/رمز مجاز نیست. تنها مسیرrecovery این انتشار،maintenance و **CURRENT data/vault با همان v61b** است؛ restorebackupقدیمی و فازrollback تاریخی ممنوع‌اند.

فرمان ناشر فقط با root/planبالا وhashفایلpinشده اجرا می‌شود: `node upgrade-preserve-v53.cjs <planSHA> prepare|install|open`. برای interruption، `recover` هویت شناخته‌شده را بسته reconcile می‌کند؛ سپس `rollforward` بهINSTALLEDبسته برمی‌گردد و پس از ackمعتبرvault،`open` جداست. این مسیر درLinux باقطعواقعی/تکرار آزموده شده؛ وجودbackupبه‌تنهایی recoveryنیست. تغییر config/PID ناشناخته failclosed و نیازمند بررسی است، نه بازنویسی خودکار.

## نتیجه و حدود

اجرای Production و بازگشایی: PASS در `ops/work/release-v61b-20261025/production-open-retry.log`. بکاپ خارج سرور و restore مستقل SQLite و جفت کلید/vault PASS؛ داده/رمز/نقش/فایل‌ها پیش و پس byte-identical، تنظیم اتصال و وجود کلید محفوظ. `production-verify-final.log` و `production-monitor-final.log`: manifest همان بالا، backend/gateway online با صفر restart، SQLite quick_check=ok، assets مطابق، سلامت gateway و منع ناشناس و نشست موجود ADMIN و تنظیمات اتصال PASS، صفر امضای خطا در بخش بررسی‌شدهٔ لاگ. `public-smoke-final/result.json`: دامنه و www، hash فایل‌های JS/CSS/قالب بانک، برند/UTF-8 و Edge دسکتاپ/موبایل، بدون overflow/خطای مرورگر PASS. ورود/خروج یا عملیات مالی واقعی و تماس بانک/پیامک انجام نشد. کپی‌های خصوصی recovery در `ops/private/release-v53-v61b-20261025` هستند. فشار/soak تازه، حذف کد و commit/push اجرا نشدند. F02/F04/F05 خارج دامنه‌اند؛ این انتشار گواهی صفر باگ نیست.
