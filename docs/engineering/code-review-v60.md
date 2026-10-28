# بازبینی محدود کد v60 — یافته‌ها، نه پاک‌سازی

۲۰۲۶/۱۰/۲۵؛ شاخه فعال `codex/windows-json-atomic-replace-v60` با HEAD قدیمی6d5882b و تغییرهای مالک محفوظ. درخواست مالک کاهش نگرانی از تغییرها و شناسایی کد بی‌استفاده بود؛ حذف/بازنویسی/ارتقای dependency انجام نشد. بررسی خواندنی مستقل و تحلیل primary، نه اثبات جامع تمام مسیرهای پویا، انجام شد. انتشار در [گیت v60](../operations/release-v60-gate.md) متوقف است.

## یافته‌های رفتاری مقدم بر تمیزکاری

| یافته | محل/اثر | طبقه‌بندی |
|---|---|---|
| F01 | `server.ts` handler `/api/requests/resubmit` حدود5149؛ شاخه معمولی version را CAS نمی‌کند؛ UI در `EmployeeRequestsView.tsx` حدود482 نسخه را فقط برای اصلاح فنی می‌فرستد. فرم قدیمی در چرخه دوم، اصلاح جدیدتر را overwrite کرد. | VALID؛ روی artifact v60 با API مستقل بازتولید شد. |
| F03 | `TreasuryWorkspaceView.tsx` حدود750 و1094، `treasury-operational-export.ts` حدود44؛ download محلی بدون بررسی capability جاری است، هرچند endpoint گزارش سرور deny دارد. | VALID؛ false مؤثر + دانلود واقعی مرورگر روی v60. افشای خارج scope ثابت نشد. |

F02 دستور خارجیِ untouched با409 ناموجه، F04 دکمهٔ فقط‌خواندنی که server403 می‌دهد و F05 تاریخچه هم‌نام بر مبنای نام نمایشی، سابقهٔ مستقل v55 هستند. در این مرحله دوباره اجرا/اصلاح نشدند و PASS تازه ادعا نمی‌شود. پنج مورد قبلاً نیز روی v57b وجود داشتند؛ سیاست/اختیار تازه برای دورزدنشان ایجاد نشود.

## نامزدهای کد یا dependency بلااستفاده

| نامزد | شاهد محدود و اقدام پیشنهادی |
|---|---|
| `@google/genai` و `motion` در package.json | در مسیرهای src/server/tests/tools بررسی‌شده import/require مصرفی پیدا نشد. حذف احتمالی فقط در تغییر مستقل با lockfile و نصب پاک/build/regression؛ نبود import به‌تنهایی تضمین نبود مصرف پویا نیست. |
| `src/components/CodeArchitectureView.tsx` و `src/data/nextjsCodeTemplates.ts` | caller فعال یافت نشد؛ templateها نمونه معماری تاریخی‌اند. بخش Prisma/طرح legacy، ORM فعال نیست؛ فایل schema/مستندات بدون بررسی مهاجرت/کاربرد حذف نشوند. |
| `src/utils/permissions.ts` | caller فعال یافت نشد؛ evaluator قدیمی scope و سقف بزرگ‌ترین نقش را می‌گیرد، خلاف evaluator فعال که scope/سقف نقش اصلی را حفظ می‌کند. آسیب‌پذیری فعال اثبات نشده؛ از reuse/ادغام اشتباهی آن پرهیز و آرشیو/حذف کنترل‌شده در تغییر جداگانه بررسی شود. |

`immer` بلااستفاده نیست؛ در server، committed-json و access-control برای draft/snapshot فعال است. Vite مصرف پویای توسعه دارد. بزرگی server/App/فرم‌ها نشانه پیچیدگی است، نه مدرک بی‌استفاده‌بودن؛ شکستن فایل‌های مالی بدون تست اتصال خطر تازه دارد.

## شواهد ابزار و محدودیت

اجرای خواندنی TypeScript با `--noEmit --noUnusedLocals --noUnusedParameters --pretty false`،۸۹diagnostic از TS6133/6196 ثبت کرد؛ بیشترین در EmployeeRequestsView۱۸، ApprovalsWorkspaceView۱۵، TreasuryWorkspaceView۱۲، AdminPortalView۷ و server۵ است. این‌ها نامزد local/import/type مرده‌اند، نه۸۹باگ و نه مجوز حذف۸۹مورد. این flagها در تنظیم عادی پروژه فعال نبودند؛ نتیجه را FAILِ typecheck عادی یا آزمون محصول معرفی نمی‌کنیم. exportهای یک ماژول کاملاً orphan و رشته/بارگذاری پویا ممکن است در این روش گزارش نشوند.

شواهد خصوصی `ops/work/release-v60-20261025/unused-typescript.{json,log}` و `ui-release-blockers/result.json`. primary بازتولید دو باگ/diagnostics را اجرا کرد؛ بازبین هیچ تست، شبکه، نوشتن یا سرویس اجرا نکرد. تمام fixtureها مصنوعی‌اند و هیچ داده زنده در تحلیل بارگذاری نشد.

پیشنهاد: اول F01/F03 با regression اختصاصی، سپس پذیرش و انتشار candidate سالم؛ بعد پاک‌سازی مرحله‌ای، یک مسئولیت در هر تغییر، بدون همزمان‌کردن ارتقای بسته‌ها یا تغییر اختیار مالی. هر حذف وابستگی نیازمند نصب پاک از lockfile و build/test است. فعلاً هیچ فایل یا بسته‌ای حذف نشده است.
