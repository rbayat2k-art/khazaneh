> پس از تأیید مالک، این تغییر همراه v69 منتشر شد؛ [رکورد جاری](release-v69-ui-polish.md) بر وضعیت تاریخی زیر مقدم است.

# Staging v67b — روشن‌کردن جملهٔ محدودهٔ دسترسی

فقط متن ASSIGNED_AND_SUBORDINATES در getScopeLabel، فرم کاربر و فرم نقش به «درخواست‌های خود فرد، ارجاع‌شده و زیرمجموعه‌ها» تبدیل شد. برچسب قدیمی «مستقیم» هم حذف شد تا با نمایش سلسله‌مراتبی فعلی همخوان باشد. توضیح کامل زیر هر دو انتخابگر، درخواست‌های خود فرد، ارجاع‌ها و زیرمجموعه‌های مستقیم/غیرمستقیم در شرکت‌های مجاز را روشن می‌کند. مقدار enum، رفتار مشاهده/تأیید، شرکت، scope، سقف و اطلاعات کاربران تغییر نکردند.

PASS: npm run lint، verified build، مرورگر واقعی دسکتاپ/موبایل و نمایش هر۳محل؛ users/roleConfigs در آزمون مصنوعی برابر و pageerror۰. فقط AdminPortalView عوض است و server/storage-cli دقیقاً byte-identical v66 هستند. full suite/فشار تازه NOT RUN چون تغییر فقط جمله است.

manifest=b1b538912acf68f0ad112ea4ec7376dfd3240e8cfa0acb1c4f946071a8dc2d5c؛ Stage مستقل http://127.0.0.1:55130/، backend55131، حساب‌ها و داده TEST و خروجی بیرونی مسدود؛ ACCESS.txt خصوصی در permanent-staging-access-scope-copy-v67. Source=C:\Users\reza\Desktop\پروژه‌ها\انتشار موقت khazaneh\work\access-scope-copy-v67-20261026/source و branch=codex/access-scope-copy-v67. Stageهای قبلی و۱۵۷ورودی خرید محفوظ‌اند.

Production همچنان نسخه پذیرفته‌شده v66 است؛ این تغییر روی دامنه منتشر نشده و پذیرش/انتشار همین candidate لازم است. هیچ data migration/reset، commit/push یا اتصال Production انجام نشد. بازگشت preview با CURRENT data و binary سازگار v66/v67 ممکن است؛ schema/payload یکی است. شواهد: C:\Users\reza\Desktop\پروژه‌ها\انتشار موقت khazaneh\work\access-scope-copy-v67-20261026/final-evidence-v67b.json.