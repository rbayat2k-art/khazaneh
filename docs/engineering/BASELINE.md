# خط مبنای مهندسی شاهراه — KHZ-BASELINE-v28-20261022

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
