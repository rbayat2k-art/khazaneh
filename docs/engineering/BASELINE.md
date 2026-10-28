## Production جاری v92c — DEPLOYED / یادآوری فعال، ۲۰۲۶/۱۰/۲۸

[رکورد بازیابی رمز و یادآوری](../operations/release-v92-otp-reminders.md)؛ manifest=0f5c6d783017abcb533f66d582a4e7ecce74e25409472b51d32e39d1c5464436. شمارنده و حفظ challenge سه‌دقیقه‌ای هنگام تأخیر/خطا؛ یادآوری مسئول فعلی ۸تا۲۱ تهران، >=۴۵دقیقه و حداکثر۲تلاش تجمیعی/روز. ۷۵۴ آزمون متمایز هرadapter، مرورگر/بازبینی، Linux CURRENT با ثبت تازه+ledger، بکاپ۸۰فایل/restore مستقل و سلامت/پایش کوتاه PASS؛ رمز/ACL/مسیر/کلیدها محفوظ، فقط config مصوب+audit اضافه. خرید و۱۵۷ورودی canonical حفظ، بدون commit/push/cleanup. تحویل اولین یادآوری طبیعی هنوز مشاهده نشده؛ تست واقعی دوباره ارسال نشد. بخش‌های پایین تاریخی‌اند.

## Production جاری v90b — PASS / DEPLOYED، ۲۰۲۶/۱۰/۲۷

[رکورد انتشار استعلام حساب، پرداخت پرسنلی و نقش‌ها](../operations/release-v90-role-access.md)؛ manifest=a488d55addb8ca11c06898243b4fe6fa55f4464570053c38e345f936be3e1504؛ بکاپ۶۶فایل وrestoreمستقل، حفظ رمزها/ACLقدیمی/شرکت/سقف/چهارمسیر، فقط۱۸مجوزجدیدمصوب و استعلام مستقیم افراد بدون سرپرست. مهاجرت durableV90-1، Linux CURRENT با ثبت تازه و۳۵۰audit و حفظACL/مسیر PASS؛ build/QA/مرورگر/دامنه/health/پایش کوتاه PASS. خرید منتشر نشد و۱۵۷ورودیcanonical آن محفوظ است؛ checkoutخرید مستقیماًdeployنشود. recovery فقطCURRENT+binaryسازگارv90b، بدونrestoreقدیمی یاdowngrade؛ بدونcleanup/commit/push/بانک‌وپیامک واقعی/فشار تازه. بخش‌های پایین تاریخی‌اند.

## Staging v77a — کادرهای انتخاب اطلاعات استعلام؛ PASS

[ظاهر و شواهد محدود](../operations/staging-v77-inquiry-choice-cards.md)، manifest=560d0a735aaa501221b0f51ca10d88c384df39b547bbc9b8ddc856a3a75bdc7d؛ همان55142. سه انتخاب در ثبت/ویرایش به کادر نرم سبز/خنثی تبدیل شد؛ keyboard و چندانتخاب باقی است. lint/build، مرورگر/ثبت واقعی/ابعادموبایل و latestCURRENT backup/restore/حفظتمامstate PASS. سرور عینv76b؛642تست پایه دوباره اجرا نشد و ویرایش end-to-end تازه NOT RUN، کنترل مشترک بازبینی شد. رمز/ACL/نشست/داده و157ورودیخرید محفوظ؛ Production/GitHub/خرید دست‌نخورده؛ پذیرش مالک NOT RUN.

## Staging v76b — مقصد اختیاری پرسنل؛ PASS، منتظر پذیرش

[قاعده، آزمون و حفظ اطلاعات](../operations/staging-v76-personnel-bank-details.md)، manifest=5d668a3c8833a45338657e2a5b06a9d27d066ac7b381ede70ec9796106dcfd52، همان55142. نام گیرنده/کارت تعیین مبلغ حسابداری اختیاری؛ کارت مساعده گروهی اختیاری و کارت دستور پرداخت عادی تکی/گروهی اجباری. خزانه/جزئیات/Excel راهنمای تکمیل از اطلاعات پرسنلی می‌دهند، بدون جعل شماره/نام. هر۶۴۲SQLite/JSON با backendبایت‌یکسانA/B،۴۲متمرکز،۱۲دروازه، مرورگر/ثبت بدون مقصد، اکسل وrestore PASS. نصب فقطکد: تمامstate/۱۴کاربر/رمز/نقش/نشست/۲پرونده/۳فایل و۱۵۷ورودیخرید محفوظ. Productionv69 وStageهایقدیمی/GitHub دست‌نخورده؛ بدونreset/انتشاردامنه. CURRENT+Bسازگار؛ پذیرش مالک NOT RUN.

## Staging v75f — پرداخت مانده پرسنل و زیرمنوهای مرتبط؛ PASS، منتظر پذیرش

[رفتار، آزمون و بازیابی](../operations/staging-v75-personnel-balance.md)، manifest=502de9fa572a1b8e4b0b2acf99f6c5a97bfa8d4312a7960c93eb022daabf2227؛ لینک بررسی55142. ثبت بدون مبلغ/کارت ← تعیین مبلغ و تأیید حسابداری ← خزانه؛ هویت پرسنل/صاحب حساب جدا. ثبت/پیگیری/پاسخ‌ها زیر والد مرتبط، بدون منوی اصلی تازه. هر۶۳۷تست SQLite/JSON روی backend بایت‌یکسان c/d/e/f،۲۰متمرکز،۱۲دروازه، مرورگر، پاسخ‌گمشده/retry و backup/restore پس از پرداخت جزئی PASS. نصب فقط کد: تمام state جاری/۱۴کاربر/رمز/نقش/نشست/۳فایل حفظ؛ صحت۱۷۵سورس/۴۷خروجی و۱۵۷ورودی خرید PASS. Productionv69 و خرید55120/Stageهای55136/55138 دست‌نخورده؛ بدون reset/commit/push/نشر دامنه. recovery فقط CURRENT+v75f سازگار؛ پذیرش مالک NOT RUN.

## Staging v74b — تفکیک پرسنل، بابت و مقصد وجه، PASS و منتظر پذیرش

[رفتار، آزمون‌ها و بازیابی](../operations/staging-v74-financial-identities.md)، manifest=b8c3e355cf005df1976611faf4ae7855f56782663547598ff327d87aa563c51f؛ همان55136. هر۶۱۹تست SQLite/JSON،۱۲دروازه، مرورگر desktop/mobile، mock bank/حفظ نام گروهی/پرداخت جزئی/فیش/تبدیل و restore مستقل PASS. startup تمام state جاری/رمز/نقش/نشست/۷استعلام/۳فایل حفظ؛ بدون reset/seed یا schema تازه. Productionv69/خرید55120/۱۵۷ورودی محفوظ و GitHub دست‌نخورده. فرم باز نمونه55138 محفوظ؛ پذیرش مالک NOT RUN.

## Staging v73b — گفتگوی استعلام در همان پنجره، PASS و منتظر پذیرش

[رفتار، گیت‌ها و پاک‌سازی صریح مالک](../operations/staging-v73-linked-inquiry-conversation.md)، manifest=cd5a44fd9e0432351063623906fde78208098ef6bc5ad7549a3e47a3798f766a؛ همان55136. هر۶۱۰تست SQLite/JSON،۱۲دروازه، مرورگرA/B دسکتاپ/موبایل، restore پس از edit/دوپاسخ/مکاتبه/فایل/پرداخت جزئی و نصب CURRENT PASS. پیش‌تر فقط۲۴استعلام قدیمی با مجوز روشن مالک و بکاپ حذف فعال/۲۱فایل قرنطینه شدند؛ داده مالی و کاربران ثابت ماندند. دو استعلام تازهٔ بعد از آن هنگام نصب محفوظ‌اند؛ reset دوباره مجاز نیست. دامنهv69/خرید55120/۱۵۷ورودی خرید/GitHub دست‌نخورده؛ پذیرش مالک NOT RUN.

## Staging v72b — شمارنده و اعلان استعلام، PASS و منتظر پذیرش

[منوها، اعلان مسئول مرحله و پاسخ منتشرشده](../operations/staging-v72-inquiry-notifications.md)، manifest=dd2ffeba710787632b788d684543d6b16805f7f99c4bedb6e79d1c0b22cbdef4؛ همان55136، حفظ کل۲۴استعلام/۲۱فایل/رمز/نقش/مسیر/نشست جاری. هر۵۹۹تست SQLite/JSON و۱۲تست دروازه، مرورگر B، بکاپ تازه/restore بعد از پاسخ و خواندن و تبدیل و پرداخت جزئی، سلامت و تطبیق شمارنده با ردیف‌های مجاز PASS. backendA/B byte-identical؛ B فقط برچسب نمایشی استعلام دارد. بدون تغییر مجوز/Productionv69/خرید55120/GitHub؛ پذیرش مالک NOT RUN.

## Staging v71a — فرم سادهٔ استعلام، PASS و منتظر پذیرش

[فرم ردیفی، دسترسی مستقل و راهنمای نقش‌ها](../operations/staging-v71-simple-inquiry.md)، manifest=ee21777c6a28754d8885d9c36b8068f7239e4c28f3f1881490fa59ea0fae32b4؛ همان محیط خصوصی55136 و۱۴ حساب فارسی، حفظ تمام۲۲استعلام/۲۱فایل/رمز/مسیر/مجوز مالی جاری. هر۵۸۸تست SQLite/JSON،۱۲تست دروازه، مرورگر دسکتاپ/موبایل، بکاپ تازه/بازیابی schema۲ و پاسخ تازه/پرداخت جزئی و سلامت نصب PASS. تغییر مجوز فقط برای حساب‌های مصنوعی Stage؛ Production همانv69 و خرید55120 محفوظ. بدون reset/commit/push/نشر دامنه.

## Staging v70h — PASS، منتظر پذیرش مالک

[استعلام مانده و صورت‌حساب](../operations/staging-v70-account-inquiries.md)، manifest=7e439b0ff26ffe54c68631c6ec1d682287493312387afe1d740a70304ccba9b6؛ محیط مستقل55136، ۵۷۳تست هرSQLite/JSON، مرورگر و backup/restore جاری PASS. Production این مأموریت تغییر نکرد و v69 مرجع دامنه است؛ خرید روی55120 محفوظ. راهنمای نقش‌ها و شش نمونه در رکورد؛ بدون reset/commit/push/نشر.

# خط مبنای مهندسی شاهراه — KHZ-BASELINE-v69-PRODUCTION-20261026

## Production جاری v69 — PASS / DEPLOYED

[رکورد انتشار متن، آیکون و عرض فرم](../operations/release-v69-ui-polish.md)؛ manifest=96c6fa147a48f329028a62c361d13daf40628fb4e93cb1fa61caf91a51e3ac37، بازگشایی 26/10/2026, 12:20:31 تهران. همانcandidateمصوب؛ فقطUI/آیکون،backend/storage عینv66،بکاپ60فایل وrestoreمستقل data/code/vault و برابری تمامstate/رمز/ACL/نشست/تنظیماتPASS؛health/مرورگر/پایشکوتاهPASS. خرید فقطStage55120 و157ورودی آن محفوظ؛ پیش از نشرخریدv64/v65/v66/v69 ادغام/آزمودهشوند. بدونmigration/reset/cleanup/commit/push؛recoveryفقطCURRENT+binaryسازگار،بدونrestoreقدیمی رویثبتجدید. مواردجاریپایین تاریخچه‌اند.

## Production جاری v66 — PASS / DEPLOYED

[رکورد انتشار نام‌گذاری مساعده](../operations/release-v66-advance-self-copy.md)؛ manifest=dbdde4002c3b6c7bc2788a6cc816e425a047829629ecb7f9b7266c4b39b5cb30، بازگشایی 26/10/2026, 11:28:02 تهران. همان candidate پذیرفته‌شده؛۲component UI، نام ثابت صاحب پرتال و تفکیک خود/دیگران؛ verified build و مرورگر Stage/public، بکاپ۶۰فایل و restore مستقل data/code/vault، برابری تمام state/رمز/ACL/نشست/تنظیمات و health/پایش کوتاه PASS. backend executable text همانv65d با اختلاف comment مسیر است؛ full suite تازه لازم/اجرا نشد. source مستقل advance-request-copy-v66؛ خرید و۱۵۷ورودی‌اش و Stageهای قبلی محفوظ‌اند؛ خرید پیش از نشر،v64/v65/v66 ادغام/آزموده شود. بدونmigration/reset/cleanup/commit/push؛ recovery فقط CURRENT+binaryسازگار، بدونrestoreقدیمی رویثبتجدید. بخش‌های «جاری» پایین سابقه‌اند.

## Production جاری v65d — PASS / DEPLOYED

[رکورد انتشار و CURRENT recovery](../operations/release-v65-approval-chain.md)؛ manifest=`1c8668c7b7f535cd9d81e4a72b8de17fadd068bfa81cfe2ad28c7212443686d9`، بازگشایی 26/10/2026, 11:05:33 تهران.۵۲۶تست هرadapter روی backend عین نهایی،۱۶تست تازه هرadapter، مرورگر هم‌نامی/مکمل/۴مسیر وdesktop/mobile،Linux CURRENT و بکاپ۶۰فایل/restore مستقل وvault PASS؛ تمامstate/رمز/ACL/نشست/تنظیمات دقیقاً برابر،بدون افزودنpermission/backfill/profile. دامنه وwww/health/asset/پایش کوتاه PASS. خرید فقط Stage55120؛ canonical checkout آن مستقیم منتشر نشود و پیش از نشر،v64b/v65d ادغام و آزموده شوند. سورس انتشار درworktree مستقلrequest-approval-chain-v65 است. پس از admission فقط CURRENT DB/vault باbinaryسازگارv65d،بدونrestoreقدیمی یاdowngrade؛ بدونcleanup/commit/push. بخش‌های «جاری» پایین سابقه‌اند.

## Production جاری v64b — PASS / DEPLOYED

[رکورد انتشار و recovery](../operations/release-v64b.md): manifest=`58058ff10fc128106ec7a927fcf16439394f83b66fa18d470bd74cdddf8864c5`، بازگشایی۰۹:۲۷:۵۲تهران۲۰۲۶/۱۰/۲۶. همان artifact مصوب مستقل از خرید، بکاپ۶۰فایل/restore مستقل داخل و خارج سرور و vault، startup فقط۱۸کلید افزایشی مصوب به۶نقش و **تمام بقیهstate/رمز/ACL/فایل/نشست دقیقاً برابر**؛ مرورگر دامنه/health/پایش کوتاه PASS.۵۱۲تست هرadapter روی backend یکسان،۱۷تست تازه هرadapter،Linux/قطع admission وCURRENT-recovery چهار تلاش وpreinstallabort PASS. خریدv63 فقط Stage55120،source۱۵۷ورودی آن محفوظ؛ **قبل از نشر آینده خرید، v64b باید ادغام و دوباره آزموده شود**. source انتشار در worktree مستقلtreasury-rejection-v64 است؛ checkout خرید مستقیماً deploy نشود. پس از admission فقط CURRENTDB/vault وbinaryسازگارv64b/roll-forward؛ بخش‌های انتظارپذیرش پایین سابقه‌اند. هیچreset/تست‌مالی‌زنده/commit/push/پاک‌سازی انجام نشد.

## تحویل Stage v64b پیش از پذیرش — سابقه

[رکورد و راهنمای محیط جدا](../operations/staging-v64-treasury-rejection.md): بر مبنای v62b تولید، نه خرید تأییدنشده، در55124 با manifest `58058ff10fc128106ec7a927fcf16439394f83b66fa18d470bd74cdddf8864c5`.۵۱۲تست هرadapter روی backend یکسان،۱۷تست تازه هرadapter،مرورگر/پنج‌نقش/restore/restart PASS؛ تفکیک proof بازاستفاده در رکورد. Production و داده/نسخه خرید55120 محفوظ‌اند؛ listener خریدِ متوقف دوباره راه افتاد. source در worktree مستقل است؛ **پیش از انتشار آینده خرید، این اصلاح باید ادغام و دوباره آزموده شود**. پذیرش همین نامزد و Linux/انتشار NOT RUN؛ startup فقط سه کلید افزایشی و recovery فقط CURRENT+v64سازگار است.

## Staging جاری v63 — خرید مستقل، منتظر پذیرش

[رکورد خرید و بازیابی](../operations/staging-v63-purchase.md)، manifest=`07384e483088571a639b0ad4cc3fdc31b0b9f95c4743c99074478f01013ced9c`؛ root=`ops/private/permanent-staging-purchase-v63`، همان55120، راه‌اندازی مجدد نهایی۱۸:۱۸:۳۹UTC،۲۰۲۶/۱۰/۲۵. هر۵۴۰تست SQLite/JSON روی همان a08،۱۱شاهد مرورگر،۱۲تست دروازه، recovery پس از partial/refund، backup/restore و انتقال CURRENT و سلامت شش ورود نقش PASS. داده/رمز/مجوز قدیمی/ACCESS/vault محفوظ، مهاجرت فقطافزایشی؛۵حساب مصنوعی خریدTEST با رمز خصوصی جدید و هیچ پرداختی seed نشد. مجوزهای ویژه پیش‌فرض خاموش، پیش‌بینی بدون اثر مالی، حالت فقط‌خواندنی سروری. Productionv62b وGitHub تغییر نکردند؛ پذیرش و انتشار همین نامزد NOT RUN. برگشت فقط CURRENT+binaryسازگار؛v62bقدیمی برای داده دارای خرید مجاز نیست. وضعیت‌های «Staging جاری» پایین تاریخچه‌اند.

## Production جاری v62b — PASS / DEPLOYED

[رکورد انتشار ورود مدیریتی](../operations/release-v62b.md)، manifest=`0e1d7676bd13a94e64709d19cd02316d926800c086159cd03bf718ed1c9951ee`؛بازگشایی۱۳:۳۶:۳۳UTC،۲۰۲۶/۱۰/۲۵. همان candidateمصوب،بکاپ/restore مستقل داخل و خارجسرور،برابری همهٔداده/رمز/نقش/فایل/vault و سلامت API/مرورگر دامنه PASS. LinuxCURRENT-recovery،۱۰تستحساس تازههرadapter وگیت‌های قبلی باهویتیکسان طبق‌رکورد؛بدونreset/migration/پاک‌سازی/commit/push. downgradeبهv61bباchildsessionممنوع؛recoveryبعدنصب فقط CURRENTstate/vault وbinaryسازگارv62b. Stageخصوصی مستقل باقی است؛بخش‌های جاری/انتظارپذیرش پایین تاریخچه‌اند.

## Staging جاری v62b — PASS، منتظر پذیرش

[ورود مدیریتی و لایهٔ درست پنجره‌ها](../operations/staging-v62-admin-user-entry.md)، manifest=`0e1d7676bd13a94e64709d19cd02316d926800c086159cd03bf718ed1c9951ee`؛ root=`ops/private/permanent-staging-admin-user-entry-v62b`، همان55120 و رمزها. فقط یک تغییر نمایشی نسبت به v62؛ backend و دامنه byte-identical و نتایج۵۰۵تست هرadapter با proof بازاستفاده شدند. build،دو مرورگر۱۰شاهدی تازه،restore،انتقال CURRENT و smoke/restart Stage PASS. داده/رمز/مجوز/vault محفوظ،Production همانv61b؛ پذیرش مالک NOT RUN. وضعیت‌های Stage جاری پایین تاریخچه‌اند.

## Staging جاری v62 — PASS، منتظر پذیرش

[ورود مدیر اصلی به پرتال کاربر](../operations/staging-v62-admin-user-entry.md)، manifest=`a168d3929e015310a41f8eb68ad9df3408be4d25afd5a6d9e9e8ddeed38efb4e`؛ root=`ops/private/permanent-staging-admin-user-entry-v62`، همان55120/رمزها. دو نشست مستقل و اختیار مقصد، اعتبارسنجی والد، بازگشت با والد و انتساب دو هویت در commit/گردش/پرداخت/گزارش.۵۰۵تست هرadapter،۹شاهد مرورگر،restore و restart و smoke خود Stage PASS؛ بازبینی مستقل محدود بدون finding باز. تمام داده/رمز/نقش/ACCESS/vault قبلی حفظ شدند؛ بدون reset/migration/Production/commit/push. شرایط و محدودیت‌ها و downgrade امن در رکورد نسخه؛ پذیرش مالک NOT RUN. Stageهای جاری پایین تاریخچه‌اند.

## Production جاری v61b — PASS / DEPLOYED

[انتشار مصوب همان v61b](../operations/release-v61b.md) در ۲۰۲۶/۱۰/۲۵ ساعت08:49UTC با manifest=`0efae2b038c6f983a44e39de0f0c04517cf46d04795da08c70deeea07f8c29be`، بکاپ/restore مستقل خارج سرور، برابری همهٔ داده/رمز/نقش/فایل/vault و سلامت دامنه/مرورگر PASS. گیت‌ها و حدود واقعی در رکورد انتشار هستند؛ عبارت‌های انتظار پذیرش/Production بدون تغییرِ بخش‌های پایین، سابقهٔ پیش از پذیرش این نامزدند. تغییرات بعدی نیازمند Stage و پذیرش همان نسخه‌اند.

## Staging جاری v61b — PASS محدوده، منتظر پذیرش مالک

[نسخهٔ فرم اصلاح، مجوز خروجی و تازگی JSON](../operations/staging-v61-revision-export.md)، manifest=`0efae2b038c6f983a44e39de0f0c04517cf46d04795da08c70deeea07f8c29be`؛ root=`ops/private/permanent-staging-revision-export-v61b` در همان `http://127.0.0.1:55120/`. هر۴۹۵تست JSON/SQLite، پنج تکرار استعلام۹تایی،۱۰گروه مرورگر، backup/restore مستقل و restart CURRENT-state و health PASS. F01/F03 و ایراد سوم JSON با تأیید صریح مالک رفع شدند؛ allowlist اصلاح معمولی/فنی و مجوزهای قبلی محفوظ. آخرین state/رمز/نقش/مسیر/ACCESS/vault از v60 حفظ، schema۱ ثابت؛ root قبلی متوقف و محفوظ است. Production/commit/push/پاک‌سازی/تماس واقعی انجام نشد؛ پذیرش مالک NOT RUN. سنجش JSON ظرفیت تجاری نیست، F02/F04/F05 خارج دامنه بازند. بخش‌های جاری پایین تاریخچه‌اند؛ گیت FAIL میانی حذف نشده است.

## گیت انتشار v60 — BLOCKED،۲۰۲۶/۱۰/۲۵

[درخواست انتشار و snapshot نسخهٔ دامنه](../operations/release-v60-gate.md): ذخیره v57b در GitHub PASS، commit7e5b48e وtagv57b؛ تمام build input/outputها با دامنه تطبیق شدند، بدون داده/اسرار. اما بازتولید تازه روی artifact v60، F01ِ overwrite اصلاح جدید با فرم قدیمی و F03ِ خروجی محلی با capability=false را FAIL/VALID کرد. این‌ها در v57b هم موجودند، ولی پذیرش ریسک از قدمت استنباط نشد. هیچ Production stop/install/write/restart انجام نشد؛ v57b با همان PID/config سالم در بررسی خواندنی ماند. Stage v60 پایین هنوز فعال، نه آمادهٔ انتشار بی‌قید؛ [بررسی کد](code-review-v60.md) و ضرورت recovery سازگار CURRENT مرجع‌اند. PASS suite۴۷۸تایی جای regression این دو نیست؛ اصلاح/پذیرش candidate تازه و Linux rehearsal هنوز لازم است.

## نامزد v60 — PASS محدودهٔ تغییر، فقط Staging

[رفع sharing فایل JSON ویندوز و حساب‌های مبدأ مشترک](../operations/staging-v60-windows-json.md)، manifest=`1f7e43279cd0985cfbf3b0b5b6dafd5b44c36ea7ffdaa34bf4cff08a9d582c9f`. root=`ops/private/permanent-staging-windows-json-v60`، همان `http://127.0.0.1:55120/`؛ شروع۱۰:۱۳:۵۹ تهران۲۰۲۶/۱۰/۲۵. هر۴۷۸تست JSON/SQLite، پنج تکرار استعلام۹تایی با fault injection، پنج مسیر مرورگر، بازیابی و بکاپ جاری/restore مستقل/startup state/health PASS. اطلاعات، رمز، نقش، مسیر و vault قبلی محفوظ؛ schema۱، بدون migration/reset/Production/commit/push/تماس واقعی. v59b متوقف پایین با این candidate تازه جایگزین شد؛ تاریخچهٔ شکست حفظ است. پذیرش مالک NOT RUN؛ پنج finding قدیمی و ظرفیت/سلامت کلی ادعا نمی‌شوند. Production آخرین رکورد v57b است و در این مأموریت خوانده نشد؛ Stageهای «جاری» پایین تاریخچه‌اند.

## تغییر محلی v59b — BLOCKED_FINAL_GATE، Staging جاری عوض نشد

[حساب‌های مبدأ مشترک سازمان](../operations/staging-v59-shared-source-banks.md)، manifest=`97de76290053238a9c06088a7311fff178f668b59ae45f9a94e052686243df34`.۴۶۹تست SQLite،۵مسیر مرورگر و recovery PASS؛ suite JSON نهایی و بازاجرای محدود هر دو۴۶۷/۴۶۹ و همان prerequisite استعلام/آزمون وابسته FAIL. clone تشخیصی EPERM واقعی هنگام rename فایل JSON ویندوز ثبت کرد؛ علت دقیق اجرای اصلی اثبات/رفع نشده است. گیت دور زده نشد: Stage همان v58b پایین، داده/رمز/vault بدون تغییر؛ Production/commit/push و انتقال نامزد جدید انجام نشدند. نتیجه محلی سلامت کلی یا تحویل Staging نیست.

## نامزد v58b — PASS محدودهٔ تغییر، فقط Staging

[گزینه مستقیم به حسابداری](../operations/staging-v58b-direct-accounting.md)، manifest=`093313894ecdbd3d610466f5b565c44d7cac1461a18d81241d1b3708afa77247`. Stage جدید `ops/private/permanent-staging-direct-accounting-v58b` باهمانآدرس55120ورمز/داده/نقش/vaultمحفوظ؛شروع۲۳:۴۲تهران،۲۰۲۶/۱۰/۲۴. هر۴۵۴تستSQLite/JSON،۸سناریومرورگر،۲۱حساب/۹۶سند/۱۹۲ردیفmixedازجمله۲۰سندمستقیمباوجودسرپرست،restoreوبکاپجاری/health PASS. schema۱،بدونreset/migration/Production/commit/push/تماسواقعی. پذیرشمالکNOTRUN؛پنجfindingقدیمی‌خارج‌دامنهبازند. تشخیص جداگانهعدم‌نمایش‌بانک،درانتظارمحیط/کاربر است و هیچمجوزی بهخاطرآن عوضنشد. Productionهمانv57b؛Stage«جاری»پایین تاریخچه‌اند.

## نامزد v58a — PASS محدودهٔ تغییر، فقط Staging

[تأییدکننده مستقل چهارنوع درخواست](../operations/staging-v58-request-routing.md)، manifest=`40dbe78b2aa88345f5201b888c59660cc6a3e49d3d294be1388e502667d5b66e`. Stage جدید `ops/private/permanent-staging-request-routing-v58` در همان `http://127.0.0.1:55120/`، شروع۱۸:۴۶:۲۹UTC؛ بکاپ جاری/restore مستقل،startupکلstateبرابر،رمز/نقش/vaultمحفوظ. هر۴۴۷تستSQLite/JSON،۸مسیرمرورگر،۲۱حساب/۹۶سند/۱۹۲ردیف باconcurrency۶ و۸۴۴HTTP،تطبیق تک‌فیش وrecovery PASS. هیچProduction/commit/push/شبکهواقعی؛ پذیرش مالک NOT RUN. schema۱ و خودتأییدی/مجوزهای قبلی ثابت. پنجfindingقدیمی ممیزی هنوز بازند؛ این PASS سلامت کامل انتشار نیست. Production طبق رکورد معتبر همانv57bپایین است. وضعیت‌های Stage«جاری»پایین تاریخچه‌اند.

## Production جاری v57b — PASS / DEPLOYED

[۲۵بانک فایل حساب‌های مبدأ و قالب نسخه‌دار](../operations/release-v57-bank-catalog.md)، manifest=`309c04c79a22058188487f07b6a283e3793e0497e01054f6252ca0f680a19b21`، بازگشایی `2026-10-24T17:11:04.172Z`. هر۴۲۱تست SQLite/JSON،۹مسیر مرورگر، بکاپ/restore تازه داخل و خارج سرور، startup raw برابر و سلامت عمومی PASS؛ اطلاعات/رمزها/مجوزها/vault محفوظ و schema۱ ثابت. v57 میانی مشکل کش قالب داشت و با v57b اصلاح شد. source انتشار مستقل از snapshot v55 است؛ **v56 فقط Staging مانده**، checkout فعال شامل آن است و نباید مستقیم Production شود. commit/push، import واقعی، تماس بانکی و فشار تازه NOT RUN؛ حدود بازاستفاده Linux و rollbackCURRENT در رکورد انتشار صریح‌اند. نام‌های «فعال» پایین تاریخی‌اند؛ جملهٔ Production=v55 در سابقهٔ v56، وضعیت هنگام تحویل همان نامزد است.

## نامزد v56c — PASS، فقط Staging

[جلوگیری از کار بی‌مسئول و اختیار موردی مدیر](../operations/staging-v56-open-work.md)؛ manifest=`a8a12dcbf409cb25f81b9b39cb1f03cb1360b638750c696f470dbac2753806f4`. Staging در `2026-10-24T16:20:46.213Z` با root `ops/private/permanent-staging-open-work-v56` و همان `http://127.0.0.1:55120/` بالا آمد؛ داده، رمزها و vault جاری حفظ، بکاپ سازگار و restore مستقل PASS. هر۴۲۸تست در SQLite و JSON،۵مسیر مرورگر دسکتاپ/موبایل، بازیابی با حفظ ثبت تازه و ورود/خروج/۱۶asset خود Stage PASS. schema۱ و تنظیمات واقعی ثابت؛ بدون reset/migration/commit/push/Production. شواهد نهایی در `ops/work/open-work-guard-v56-20261024/final-evidence.json`؛ پذیرش مالک **NOT RUN**. Production همچنان مبنای v55 پایین است؛ این نامزد، حل پنج finding مستقل ممیزی قبلی یا مجوز انتشار نیست.

## مبنای فعال v55 — PASS / DEPLOYED

[جست‌وجوی نام/کد مرکز هزینه در تمام۵انتخابگر](../operations/release-v55-cost-center-search.md)، manifest=`86778ed21002a4d1ec37f63c59a2074452b5085e62b06b42829f7598cf0a7566`، بازگشایی12:40:01UTC،۲۰۲۶/۱۰/۲۴. فهرست native/value/name/ID/required و scope قبلی حفظ؛ فقط UI عوض شد، backend/storage با v54b byte-identical.۲۹تست مرتبط،۸مسیر مرورگر،Staging و بکاپ/restore تازه/health PASS. تمام rawDB/رمز/نقش/روابط/کلیدها برابر؛ بدون schema/migration/reset/commit/push جدید. Stage جاری `ops/private/permanent-staging-cost-center-v55` با همان رمزها؛ شاهدهای بازاستفاده‌شده و NOT RUNها در رکورد نسخه صریح‌اند. بخش‌های فعال پایین تاریخی‌اند.

## مبنای فعال v54b — PASS / DEPLOYED

[انتخاب شرکت‌های مجاز نقش](../operations/release-v54-role-companies.md)، manifest=`c04924ad94ba0b14026a0778bf15ebfa53de64b5a4ff0fbe08ef393f5afa94b6`، بازگشایی ۲۰۲۶/۱۰/۲۴ ساعت11:32:23UTC. با مجوز صریح، فقط فهرست شرکت APPROVER به یک شرکت موجود و metadata/audit مربوط تغییر کرد؛ همهٔ سایر داده‌ها/رمزها/نشست‌ها/مجوزها/روابط برابر ماندند. UI مدیریت شرکت، CAS و اعتبارسنجی اضافه شد؛ ۴۱۷تست هر adapter، مرورگر و Linux patch/rollbackCURRENT و بکاپ/restore مستقل PASS. همان schema۱ و بدون migration/reset/commit/push جدید. Staging جاری `ops/private/permanent-staging-role-companies-v54`؛ رمزهای قبلی محفوظ. وضعیت‌های فعال پایین تاریخچه‌اند؛ جزئیات و NOT RUNها در رکورد انتشار مرجع‌اند.

## مبنای فعال v53f — PASS / DEPLOYED

با پذیرش صریح مالک، [همان v53f آزموده‌شده منتشر شد](../operations/release-v53-menu-permissions.md)؛ manifest=`e845223b6489f8abe1fd385df7a9cbbb6e80c7a621b5038b47fea864f1c0043e`. ۹منوی مستقل/۶۵کنترل، تمام rawDB/رمز/vault/تنظیمات نقش جاری برابر، بدونmigration/reset یا اعطای اختیار جدید. ۴۱۲تست هرadapter،۱۶UI،Linux حفظ حقوق عملیاتی۸حساب وrollback باثبت‌های تازه،بکاپ/restore خارج سرور وhealth/public browser PASS. Production وStaging همینartifact را دارند ولی داده/نشست/کلیدشان مستقل‌اند. recordانتشار بر وضعیت Stage-only وFAIL تاریخی بخش‌های پایین مقدم است؛ محدودیت ناوبری rollback وNOT RUNهای واقعی در آن صریح‌اند.

## سابقهٔ نامزد v53f پیش از پذیرش — PASS، فقط Staging

[تفکیک منوها و اختیارات](../operations/staging-v53-menu-permissions.md) روی Staging خصوصی `ops/private/permanent-staging-menu-permissions-v53` در `http://127.0.0.1:55120/` آمادهٔ پذیرش مالک است؛ manifest=`e845223b6489f8abe1fd385df7a9cbbb6e80c7a621b5038b47fea864f1c0043e`. ۹کارت مستقل با نام دقیق Sidebar،۶۵کنترل و۴۰مسیر زیرمنو؛ ۴۱۲تست هر adapter SQLite/JSON و۱۶مسیر مرورگر PASS. داده، vault، رمزهای Stage و schema۱ حفظ؛ migration/reset و commit/push جدید انجام نشد. شاخه `codex/menu-permissions-v53`، HEAD مبنا همان6d5882b است. Production هنوز v52b پایین است؛ این بخش مجوز انتشار نیست. پذیرش مالک و انتشار این نامزد NOT RUN؛ ممیزی FAIL تاریخی پایین، با رکورد اصلاح جدید لینک شده و پاک نشده است.

## مبنای فعال v52b — PASS / DEPLOYED

**محدودیت تازهٔ مشاهده‌شده:** [ممیزی منو و مجوزها](access-menu-audit-v52.md) پس از انتشار برند،۹ناسازگاری UI/تنظیمات را ثبت کرد؛ وضعیت ممیزی **FAIL** است. ۸۸تست موجود و۵مسیرمرورگرPASS،ولی probeجدیدِ تیکثبت/اختیارقدیمی و «انتخاب همه» نقص را اثبات کرد. اصلاحاینموارد یا تغییرمجوزهای واقعی دراینممیزی انجامنشد؛ موفقیت انتشاربرند بهمعنیPASSجامعکنترل‌ها نیست.

[نام نمایشی شاهراه و رفع کش تصویر](../operations/release-v52-branding.md)، manifest=`2b1371f9f187e9b221615b7ebe62778abca0459f4a3deb47c6627bfbead9934e`؛ همانSQLite/schema1/DB/vault/رمزهای جاری، بدونreset/migration یا تغییرمجوز. زمانکنترل نهایی09:52:58UTC،۲۰۲۶/۱۰/۲۴. شاخهcodex/branding-v52،HEADهمان6d5882b؛ تغییراتv51محفوظ،commit/pushجدید انجامنشد. Stagingجاری `ops/private/permanent-staging-branding-v52b` باهمانرمزهاست. جزئیاتگیت،نسخهٔ میانی،بکاپ/restore،rollbackCURRENT data و حدودآزمون دررکوردانتشاراست؛ نسخه‌های پایین تاریخچه‌اند.

## مبنای قبلی v51 — PASS

منتشرشده در `2026-10-24T09:01:52.090Z`؛ manifest=`846bab97482f626acddee831b4772e18e43cac46a1ce338bb15328b000a94688`،۳۸خروجی/۱۰۷منبع،همانSQLite1 و تمام DB/رمزها/فایل‌های جاری بدون تغییر. [گزارش v51 و بازگشت آزموده‌شده](../operations/release-v51-inquiry-settings.md) و [ADR-018](../decisions/ADR-018-production-inquiry-connection-management.md) مرجع‌اند. مدیریت امن اتصال در Production موجود است، ولی بدون کلید و پذیرش صریح اتصال هیچ مصرف واقعی فعال نیست. ۳۹۰تست SQLite،suite نهایی JSON،مرورگر وrestore/rollback Linux PASS؛ شکست تک‌موردی JSON غیرقابل‌بازتولید همچنان در گزارش باز است. Git مبنا6d5882b؛تغییراتv51 شاخهcodex/inquiry-settings-v51،بدونcommit/pushتازه. manifest هویت نسخه زنده است،نه HEAD قدیمی. Stagingجاری ops/private/permanent-staging-inquiry-v51 با رمزها/vault محفوظ است.

## مبنای قبلی v50 — PASS

نسخهٔ واقعاً منتشرشده روی `https://shahrahsystem.ir` از `2026-10-23T20:13:58.040Z`: سورس Git `5cb1859f7dd194dec071b4ff7d0a15fe561bcec1`، manifest=`abd40ac3ff0a1da8fcc8e9e5a71d50d2fb5c72e455851b77c2f83826b8a7f314`، ۳۸ خروجی و ۱۰۷ منبع در manifest. [گزارش انتشار و حدود آزمون](../operations/release-v50-readiness.md) و [ADR-017](../decisions/ADR-017-release-notification-audience-and-report-scheduling.md) مرجع تازه‌اند؛ v28 پایین فقط تاریخچه است.

همانSQLiteباschema1 وDBجاری؛ رمزadmin،فایل‌ها،سوابق وبکاپ‌هایقبلی محفوظ. قرارداد سازگاری `KHZ-STATE-COMPAT-v50-001` وrestore/rollback/crash rehearsal ثبت‌اند. مبناشامل۳۷۶تست هرadapter،۱۲مسیرمرورگر،Linux۶۰نشست/۱۰k باثبتp95=۴٫۴۰۵s است؛ پیامک/بانکواقعی وsoakNOT RUN،cold≈۳۱s/report≈۷s محدودیت‌صریح‌اند. تغییراتآینده ابتداStagingمستقل وپذیرشصریحمالک بخواهند؛ اینانتشارمجوزدائمی نیست.

## مبنای تاریخی v28 — KHZ-BASELINE-v28-20261022

ثبت: ۲۰۲۶/۱۰/۲۲، Asia/Tehran. این مرحله فقط اتصال چارچوب و مستندسازی است؛ هیچ قابلیت، schema، داده، dependency، تنظیم سراسری یا انتشار تازه تغییر نکرد. نامزد مبنا بعداً با رکورد نسخهٔ تازه **supersede** شود؛ تاریخچه حذف نشود.

**الحاقیهٔ ذخیره در GitHub، همان روز:** نبود Git در جدول و گپ‌های پایین، وضعیت هنگام ثبت اولیهٔ Baseline است. مالک سپس ذخیرهٔ snapshot جاری را در مخزن عمومی `rbayat2k-art/khazaneh` مجاز کرد. از این پس هویت Git از checkout/remote واقعی خوانده شود؛ [ثبت snapshot](GITHUB-SNAPSHOT.md) و `releases/v28/release-manifest.json` مرز سورس/انتشار را نگه می‌دارند. ذخیرهٔ GitHub نه انتشار تازه است، نه بکاپ داده و نه آزمون جدید محصول.

## هویت و شواهد

| موضوع | وضعیت | مبنا/شاهد |
|---|---|---|
| کد محلی و نسخهٔ منتشرشده | PASS | v28؛ manifest SHA=`b26471c412d1a58c9eaa8e7ab4acb80f5c96274da0453712c1c7e6dd2a591f73`. ۶۰ source و۳۰ release file با hash تطبیق شدند؛ بررسی خواندنی تازهٔ سرور نیز همین manifest و دو پردازش online/SQLite را نشان داد. |
| هویت Git | PASS | بررسی اجرا شد و Git repository یافت نشد. شاخه/remote/commit/worktree و diff ثبت‌نشدهٔ Git وجود ندارد که گزارش شود؛ این SHA **Git SHA نیست**. ایجاد Git/اتصال مخزن مأموریت جداگانه می‌خواهد. |
| زمان انتشار مبنا | PASS | `2026-10-22T15:26:47.811Z`، برابر۱۸:۵۶تهران؛ نه زمان انتشار تازهٔ این مرحله. |
| گزارش انتشار معتبر | PASS | [production-hardening](../operations/production-hardening.md)، بخش بالای DEPLOYED. ops/work/maintenance-window-v28-live-final-20261022/release-evidence-1792682934173.json؛ SHA=`47bff982c65ef056816cf6a2fd36c2673de211254fcdb02b207380ae02529bc9`. |
| بررسی این مأموریت | PASS | ops/work/governance-baseline-v28-20261022/inspection.json؛ SHA=`83e81480a7ba7b823a993a6adcc342734007958fc93719ea11e92d842ae20182`. شواهد تنظیمات فقط hash/metadata است، نه محتوای اسرار. نسخهٔ پیش از اصلاح چهار سند در before-docs محفوظ است. |

`app = C:/Users/reza/Desktop/khazaneh`؛ `ops = C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh`.
این‌ها مسیر موجودند، نه دو checkout یکسان. app فعلاً خارج از مجموعهٔ «پروژه‌ها» و junction نیست؛ این مرحله عمداً کد/سرویس را جابه‌جا نمی‌کند. آرشیو قدیمی `شاهراه/کد پروژه` و گیت‌هاب TAPRA، نسخهٔ جاری این محصول نیستند.
این مبنا هویت کد/قراردادهاست، نه الزام ثابت‌ماندن دادهٔ خام: پس از انتشار ممکن است مالک اطلاعات تازه ثبت کرده باشد. برای هیچ تغییر آینده‌ای، خالی یا آزمایشی‌بودن دیتای جاری را از این سند نتیجه نگیرید.

## اتصال چارچوب دائمی، نه نصب دوباره

**تکمیل همان روز — فرایند دائمی:** [ADR-008](../decisions/ADR-008-private-staging-owner-release-approval.md) و [راهنمای Staging/انتشار](../operations/development-staging-release.md) اکنون مرجع اجرای تغییرات آینده‌اند. HEAD سورس v28 در Git/GitHub `cb8b87b8f5a53e49b28f955e52e56932a2689fd4` است؛ ابزارهای محیط و اسناد جدید روی شاخهٔ `codex/staging-workflow`، بدون commit/push جدیدند. بررسی تازهٔ خواندنی۳۰ خروجی سرور، همان manifest مبنا و دو پردازش online را تأیید کرد؛ payload زنده وDB خوانده/تغییر داده نشدند. این مرحله هنوز هیچ نسخهٔ تازه روی Production منتشر نمی‌کند و تأیید مالک برای candidate بعدی در انتظار است.

- PASS — قواعد `C:/Users/reza/.codex/AGENTS.md` با marker `codex-engineering:v1` خوانده و در این مأموریت اعمال شدند؛ AGENTS محلی پروژه مسیر آن را الزامی می‌کند. overrides سراسری تازه‌ای ساخته نشد.
- PASS — هر ده مهارت زیر `C:/Users/reza/.agents/skills/<name>/SKILL.md` خوانا و در کاتالوگ runtime همین نوبت شناخته‌شده‌اند: requirements-discovery، architecture-design، software-project-start، existing-project-audit، database-migration، security-audit، automated-testing، performance-testing، safe-deployment، code-review. در این کار فقط existing-project-audit و documentation-and-adrs استفاده شدند؛ برای راستی‌آزمایی native نقش‌ها، openai-docs نیز به‌صورت محدود استفاده شد. دو مهارت اخیر خارج از مجموعهٔ ده‌تایی ولی از قبل نصب‌شده‌اند.
- PASS — شش فایل `C:/Users/reza/.codex/agents/<name>.toml` با name/description/developer_instructions موجودند؛ نقش‌ها در جدول پایین‌اند. یک بازبین مستقل واقعاً با واگذاری صریحِ نقش devops_reviewer کار خواندنی انجام داد. واگذاری صریح را انتخاب native نقش از enum ابزار معرفی نمی‌کنیم.
- NOT RUN — کشف خودکار **هر شش نقش** و بارگیری کامل زنجیرهٔ AGENTS در یک نشست تازهٔ ریشه‌گرفته از app آزموده نشد؛ نصب فایل با اجرای همهٔ نقش‌ها یکسان نیست. ابزار delegation جاری کار می‌کند. لازم نیست برای هر کار همهٔ نقش‌ها spawn شوند.
- بخش‌های مجاز config.toml بررسی شد: features در خطوط۷۷–۷۹ دارای js_repl=false وfast_mode=true است؛ agents mapping دیده نشد. این فقدان، خرابی اثبات‌شده نیست؛ [مستند رسمی OpenAI، مشاهده در۲۰۲۶/۱۰/۲۲](https://learn.chatgpt.com/docs/agent-configuration/subagents) فایل‌های standalone TOML را می‌پذیرد. هیچ config، مدل، permission یا sandbox تغییر نکرد؛ نقش خواندنی sandbox مستقل ایجاد نمی‌کند.

| نیاز واقعی | مهارت مرتبط | نقش در صورت ارزش مستقل |
|---|---|---|
| ابهام کسب‌وکار/نیازمندی | requirements-discovery | business_analyst |
| تغییر ساختاری مهم، نه هر ویرایش | architecture-design | software_architect |
| قرارداد API/داده/migration | database-migration فقط برای migration واقعی | backend_database |
| امنیت/مجوز/فایل | security-audit | security_engineer |
| regression یا ظرفیت اندازه‌گیری‌شده | automated-testing / performance-testing | qa_performance |
| review / release / recovery | code-review / safe-deployment | devops_reviewer |

software-project-start فقط پروژهٔ تازه، existing-project-audit فقط ارزیابی متناسب؛ مهارت‌ها همیشه روشن یا مجوز ضمنیِ اصلاح/انتشار نیستند. مسئول اصلی تحلیل فنی، انتخاب محدود ابزارها، ادغام، حفاظت و مستندسازی را بر عهده دارد؛ از مالک فقط تصمیم حساسِ واقعاً مفقود پرسیده می‌شود.

## ساختار فعال و دیتابیس

React19/TypeScript/Vite8، فارسی RTL؛ `src/App.tsx`، `src/components/` و `src/utils/` رابط/اعتبارسنجی‌اند. `server.ts` entry واقعی Express4 است؛ authorization در `src/server/access-control.ts` و company-access، storage/queue/transfer در همان پوشه‌اند. مدل DTO در `src/types/treasury.ts`؛ regression در `tests/`؛ قواعد پذیرفته‌شده در `docs/decisions/ADR-*`. وجود Prisma یا تنظیمات قدیمی دلیل مصرف عملیاتی آن نیست. بانک، پیامک، OCR و صورت‌حساب کامل را از وجود نام یک فرم آماده فرض نکنید.

- Production: `/home/shahrahsystem_dev/khazaneh-release-b26471c412d1`؛ Node22.23.2/PM2، یک نویسنده `khazaneh-shahrah` روی loopback55357، gateway بی‌دیتابیس روی32193 و Apache/HTTPS موجود. gateway دومین نویسنده نیست.
- DB فعال: `/home/shahrahsystem_dev/khazaneh-data-raw-b26471c412d1/treasury.sqlite`، خارج document-root/release. API مرجع است؛ state عملیاتی کلاینت حافظه‌ای و غیرمرجع است، نه IndexedDB. محلی، storage پیش‌فرض JSON و مسیر پیش‌فرض `cwd/data` است (`server.ts:586–587`)؛ این پیش‌فرض را روی سرور یا آزمون امن فرض نکنید.
- قرارداد schema1 از `src/server/sqlite-records.ts:65–75`: WAL،synchronous FULL،foreign_keys،busy_timeout3000؛ `store_version(id=1,revision)`؛ `collections(name PK,ordinal,is_array,payload JSON)`؛ `records(collection FK,row_key,payload JSON,PK(collection,row_key))`،دو جدول payloadدار STRICT؛ `PRAGMA user_version=1`. تراکنش BEGIN IMMEDIATE/COMMIT و انتشار state پس commit. این store رکوردی با زیررکوردهای JSON است، نه مدل مالی کاملاً نرمال‌شده.
- ساختار با sourceِ hashشده و پذیرش import/restore v28 تطبیق داده شد؛ امروز DB زنده باز/PRAGMAخوانی نشد. فقط وجود/مسیر/اندازهٔ فایل و env غیرمحرمانهٔ پردازش بررسی شد؛ محتوای کاربران و رکوردها خوانده نشد.
- collectionها در `src/types/treasury.ts:1194`: users،roleConfigs،companies،departments،costCenters،masterDataCodeSequences،smsConfig/logs،securityAuditLogs،passwordRecoveryRequests،sessions،companyBankAccounts،advanceRequests،paymentRequests،batchPayments،manualPayments،dailyCovers،receiptArchives،notifications.
- پیوست‌ها در payloadهای مدل/فیش (از جمله inline) و مسیرهای ارجاع‌شده نگهداری می‌شوند؛ بکاپ فقط فایل اصلی SQLite نیست. upload-root یکپارچهٔ جدا برای همهٔ انواع در این مرحله اثبات نشده؛ تغییر سرویس فایل باید inventory روابط واقعی را دوباره محدود و بررسی کند.
- schema ناشناخته/DB مفقود fail-closed؛ fallback یا reset خودکار ممنوع. CLI موجود import/export/backup است، نه runner عمومیِ migrationهای آتی. تغییر آینده باید migration نسخه‌دار و recovery/down یا roll-forward سازگار با ثبت‌های تازه را جدا طراحی/آزمایش کند.

## آزمون‌های مبنا و gateهای تغییر آینده

| شواهد قبلی بر همین v28؛ امروز تکرار نشدند | وضعیت | حد معتبر |
|---|---|---|
| Node test runner | PASS | ۱۸۴/۱۸۴ هر adapter JSON وSQLite،۰skip؛ safe logs نهایی v28 در production-hardening. |
| مرورگر واقعی/خزانه | PASS | ۱۷ مسیر UI/API، raw-onboarding از admin تا چرخهٔ کاربران/درخواست/تأیید/پرداخت با دادهٔ مصنوعی. |
| Typecheck/build | PASS | npm run lint در این پروژه **tsc --noEmit** است، نه ESLint؛ npm run build=Vite. |
| Linux مستقل | PASS | ۱۰۰ نشست/چهار نقش،۱۰k،۴۳۵۴درخواست؛ ثبت پایدار p95=4086.800ms،۰خطای مالی/HTTP غیرمنتظره. workload/API مصنوعی، نه تست فشار روی DB زنده. |
| حفاظت/انتشار | PASS | restore کامل، full-app maintenance/fallback روی دادهٔ جاری، ورود واقعی مالک بدون تغییر رمز،۲۷asset HTTPS hash،health/domain/www،401 ناشناس،desktop/mobile؛ شواهد انتشار بالا. |
| بزرگ‌تر/طولانی‌تر | NOT RUN | بیش از۱۰۰کاربر،۱۰۰k/۵۰۰k/میلیون،soak چندساعته؛ سردشدن اولیه۱۰۰کاربر/۱۰k Linux p95≈46.98s محدودیت اندازه‌گیری‌شده است. زیر۵ثانیه را برای تمام تجربهٔ کاربر تضمین نکنید. |

برای اجرای بعدی از package.json و harness موجود استفاده کنید: `npm.cmd run test:access` (Node --import tests/native-types.mjs --test tests/*.test.ts)،`npm.cmd run lint` و`npm.cmd run build`. پیش از تست، مسیر **تازه و مصنوعیِ خارج data واقعی** در `TREASURY_TEST_DIR`، پورت loopback آزاد در `TREASURY_TEST_PORT` برای suite مربوط،adapter صریح `TREASURY_TEST_STORAGE` و خاموشی خدمات بیرونی لازم است؛ از fixture/guard موجود استفاده کنید، نه کپی data فعلی. UI runner موجود `ops/tools/run-isolated-ui.mjs` است؛ defaults آن قدیمی‌اند، چهار نام کامل `TREASURY_TEST_DIR`،`TREASURY_RELEASE_DIR`،`TREASURY_UI_OUTPUT` و `TREASURY_UI_SCRIPT` را حتماً صریح تعیین کنید. پورت این UI runner فعلاً **4322 ثابت** است و `TREASURY_TEST_PORT` آن را عوض نمی‌کند؛ آزادبودن4322 شرط شروع است. دستور bare dev/start یا runner بدون env، اجرای آزمون ایزوله نیست.

تغییر کم‌خطر: کنترل هدفمند همان مسیر؛ تغییر مالی/مجوز/داده: regression،denied path،transaction/race/retry/failure/reload و شاهد مرورگر مرتبط،review مستقل متناسب؛ انتشار: پذیرش نسخهٔ ساخته‌شده،امنیت و سازگاری،freeze/hash،staging،restore،مجوز معتبر target وhealth پس انتشار. گیت failing یا تصمیم حساس حل‌نشده مانع ادعای تکمیل است. برای docs-only این نوبت suite جدید اجرا نشد؛ صحت لینک/hash/مرز تغییر بررسی می‌شود.

## حفاظت و انتشار مرجع، نه مجوز انتشار آینده

شرح دقیق و فرمان‌های snapshot/cutover/fallback در بخش فعال [production-hardening](../operations/production-hardening.md) است. بکاپ سازگار تازهٔ پیش انتشار در `ops/private/maintenance-window-v28-live-backup-20261022` و کپی خصوصی سرور محفوظ،SHA manifest=`5c126c7c0b77a62c52ce8067502bf1550635da9ab76ff2b06af0d4526a963787`؛ restore مستقل و۳۴فایل تطبیق داده شدند. این‌ها بکاپ پیش همان انتشارند، نه بکاپ خودکار همهٔ نوشتن‌های آینده. اسرار فقط از مسیر خصوصی موجود، نه از اسناد، استفاده شوند.

برای نسخهٔ جاری SQLite از backup API/CLI سازگار شامل WAL و inventory پیوست‌ها، سپس نسخهٔ خارج سرور و restore مستقل استفاده شود؛ کپی تنها treasury.sqlite در حال نوشتن کافی نیست. import/export نیازمند stop/drain و lease معتبر است. دادهٔ جدید را با snapshot قدیمی بازنویسی نکنید. fallback آزموده‌شده CURRENT SQLite→JSON تازه با **همان binary v28** است؛ ظرفیت JSON تضمین نشده و برای باگ binary کافی نیست. در نقص کد، maintenance و roll-forward ایمن لازم است؛ binary قدیمیِ فاقد اصلاحات امنیتی عمومی نشود.

## ابهام‌ها/گپ‌های ثبت‌شده، بدون تصمیم خودسرانه

۱. Git وجود ندارد؛ امکان diff/branch/commit پایه تا ایجاد مخزن در مأموریت مجاز جدا نداریم. فعلاً manifest+inventory معیار تغییر محصول است.
۲. کشف native هر شش نقش در نشست تازه NOT RUN؛ نصب دوباره لازم/مجاز نشده است. بارگیری صریح مسیر قواعد از AGENTS پروژه، fallback مستند فعلی است.
۳. تعارض قدیمیِ شرکت‌های نقش تکمیلی در ADR-002 با یادداشت تصمیم جدید اصلاح شد؛ سقف و scope عمومیِ نقش اصلی از اجتماع شرکت‌ها جداست.
۴. استثنای خودتأییدی admin و مسیر legacy بدون idempotencyKey در [قواعد](business-rules.md) **مشاهده‌شده** هستند، نه مجوز توسعهٔ آن‌ها یا تضمین عمومی تمام retryها. برای تغییر حساس باید تصمیم/قرارداد و تست مشخص شوند؛ این مرحله باگ جدیدی را بازتولید/رفع نکرد.
۵. بسته‌شدن خودکار backup خارج سرور/زمان‌بندی وfreshness پس از هر نوشتن جدید در این بررسی NOT RUN است؛ وجود بکاپ انتشار، اثبات پوشش آینده نیست. مسیر فعلی کد نیز در این مأموریت جابه‌جا نشد.

نتیجه: PASS برای شروع توسعهٔ کنترل‌شده نسبت به این مبنا؛ نه ادعای ظرفیت نامحدود، تکمیل همهٔ قابلیت‌های آینده یا مجوز نشر خودکار.
