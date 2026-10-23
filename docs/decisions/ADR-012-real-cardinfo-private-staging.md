# ADR-012: آزمون واقعی محدود Cardinfo در Staging خصوصی

## وضعیت و مبنا

پذیرفته‌شده توسط مالک،۲۰۲۶/۱۰/۲۳: مالک می‌خواهد سرویس واقعی را در همان Staging با کلید واردشده از تنظیمات امتحان کند؛ Production صریحاً ممنوع است. این تصمیم فقط ممنوعیت قبلیِ اتصال Cardinfo در ADR-011 را برای محیط خصوصی منتخب جایگزین می‌کند؛ سایر قواعد مالی، شرکت/مجوز،نام،شبا،retry و حفاظت پابرجا هستند. کلید واقعی هنوز داده نشده؛ اجرای provider واقعی بدون کلید/ورودی مجاز **NOT RUN** است، نه موفقیت شبیه‌سازی.

## تصمیم

- flag خصوصی `cardinfoRealTest:true` در staging.json، محیط صریح synthetic، مسیر خصوصی vault و IPC متصل لازم‌اند. mode=`CARDINFO_TEST`، نه LIVE یا MOCK. `DISABLE_EXTERNAL_INTEGRATIONS=true` همچنان برقرار است؛ بانک،پیامک،Production و همه fetch/net/DNS/UDP/childProcess و تونل‌های loopback از backend بسته‌اند.
- پس از ورود کارت مجاز مالک، شناسه بانکی و پاسخ صاحب حساب می‌توانند واقعی و حساس باشند، هرچند مبلغ/کاربر/شرکت/درخواست، TEST است. flag قدیمی `syntheticOnly` برای سازگاری محیط کسب‌وکار می‌ماند، **نه اثبات مصنوعی‌بودن تمام payloadها یا مجوز reset/copy/log**. از این مرحله کل داده Staging هم مهم و خصوصی تلقی شود؛ ابزارها فقط روی fixtureهای مستقل و صریحاً مصنوعی خودشان اجرا شوند.
- supervisor موجود تنها broker Cardinfo است؛ فرایند یا listener تازه ساخته نمی‌شود. IPC اختصاصی فقط عملیات typed `credits` یا `lookup` با کارت۱۶رقمی و Authorization را می‌گیرد؛ URL/method/headers/options دلخواه ممنوع‌اند. parent خودش HTTPS ثابت `cardinfo.ir/inquiry/apiv1`، TLS معتبر پیش‌فرض،redirect:error،timeout۸ثانیه و سقف۱۶KiB را می‌سازد. خطا/قطع pipe/timeout،نتیجه UNKNOWN است،بدون retry پنهان.
- کلید از فرم password خصوصی همان BankInquiryPanel به `POST /api/bank-inquiry/credential {apiKey,expectedRevision}` می‌رود؛ فقط مدیرِ دارای `canManageBankInquiry` و محدوده تمام شرکت‌ها. مقدار write-only است؛ نه key/suffix/hash در DTO و نه rawerror/log. پاسخ فقط available/hasKey/revision،Cache-Control:no-store. ذخیره/تعویض کلید هیچ تماس یا فعال‌سازی خودکار نمی‌کند؛ فیلد پس ازارسال خالی می‌شود. بررسی اعتبار و استعلام،عملیات صریح جدا هستند.
- ciphertext AES-256-GCM در `STAGING_ROOT/secrets/cardinfo.enc` و KEK مستقل در `secrets/keys/master.key` خارجDB/release/Git،با ACL مالک سرویس+SYSTEM درWindows و mode700/600 درLinux. KEK در bundle/envعمومی/DB نیست. هدر revision/generation با AAD احراز می‌شود؛ تعویض اتمیک و CAS،retry stale را رد می‌کنند. حفاظت اصلی ACL حساب سرویس است؛ encryption در برابر دسترسی به همان حساب/تمام vault دفاع مستقل نیست. backup کد/DB/گزارش شامل vault نشود؛ انتقال امن هر دو بخش vault در مأموریت آینده جدا لازم است.
- در CARDINFO_TEST، automatic هم UI و هم سرور ممنوع است؛ هر enqueue فقط یک ردیف و با acknowledgment ارسال کارت/مصرف اعتبار. سایر تنظیمات/سقف روزانه همان قرارداد موجود است. startup،refresh،ذخیره کلید و مشاهده صفحه هیچ تماس واقعی نمی‌سازند. jobs قدیمی MOCK/نسل کلید دیگر یا automatic،بدون dispatch لغو/نامشخص می‌مانند؛ رسید قدیمی با همان کلید عملیات به‌عنوان همان رسید بازیابی می‌شود،نه استعلام تازه.
- job به source و generation کلید هنگام ثبت متصل است؛ قبلارسال/پسازپاسخ دوباره سنجیده می‌شود. keyrotation نتیجه دیرهنگام قدیمی را باطل می‌کند. result/source در UI و خروجی روشن است؛ خروجی تست واقعی،نتیجه MOCK/فاقدمنبع را واقعی معرفی نمی‌کند. هیچ پرداخت بانکی،تغییر مبلغ/تأیید یا بازنویسی شبای قبلی اضافه نشده است.

## گزینه‌های کنارگذاشته‌شده و تبعات

بازکردن fetch عمومی،دستکاری موقت net/DNS،تونل loopback،کلید درDB/localStorage،افزودن broker مستقل و فعال‌سازی خودکار رد شدند. IPC supervisor موجود کوچک‌ترین مرز قابل آزمون است. source/generation optional در record-store فعلی‌اند؛ SQL schema/backfill/reset تغییر نکرد. نتیجه واقعی ممکن است اعتبار مصرف کند و داده کارت به Cardinfo برود؛ فقط کارت متعلق به مالک یا با مجوز او وارد آزمون شود،نه کپی دیتای Production. قرارداد billing/idempotency provider هنوزتأیید نشده و exactly-once هزینه تضمین نمی‌شود.

## پذیرش و شواهد

`cardinfo-secret.test.ts`،`cardinfo-real-api.test.ts`،آزمون‌های domain/export،`tools/staging/cardinfo-ipc.test.mjs` و guard تست واقعی-mode با transportمصنوعی،بدون شبکه/اعتبار واقعی. مرورگر واقعی ورود/keyform/خالی‌شدن/عدمecho/تنظیم/استعلام تک‌ردیفی و رد مسیرهای منفی را روی artifact می‌سنجد؛ parent در آزمون خودکار fake است،نه auth/API/SQLite. نتایج اجرا/هویت/restore و محدودیت در `ops/work/cardinfo-real-staging-v41-20261023/CHECKPOINT.md`. ادعای تست واقعی provider تنها پس از اجرای مجاز با کلید/کارت مالک ممکن است. Production و رمز اصلی دست‌نخورده؛ پذیرش نشر آینده جداست.
