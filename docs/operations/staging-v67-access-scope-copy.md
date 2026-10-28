# Staging v67 — روشن‌کردن جملهٔ محدودهٔ دسترسی

فقط متن ASSIGNED_AND_SUBORDINATES در getScopeLabel، فرم کاربر و فرم نقش به «درخواست‌های خود فرد، ارجاع‌شده و زیرمجموعه‌ها» تبدیل شد. برچسب قدیمی «مستقیم» هم حذف شد تا با نمایش سلسله‌مراتبی فعلی همخوان باشد. مقدار enum، رفتار مشاهده/تأیید، شرکت، scope، سقف و اطلاعات کاربران تغییر نکردند.

PASS: npm run lint، verified build، مرورگر واقعی دسکتاپ/موبایل و نمایش هر۳محل؛ users/roleConfigs در آزمون مصنوعی برابر و pageerror۰. فقط AdminPortalView عوض است و server/storage-cli دقیقاً byte-identical v66 هستند. full suite/فشار تازه NOT RUN چون تغییر فقط جمله است.

manifest=7d58120f1d65d45b933a92559b5235a189378ce6a1cff5762be8474c17549d42؛ Stage مستقل http://127.0.0.1:55130/، backend55131، حساب‌ها و داده TEST و خروجی بیرونی مسدود؛ ACCESS.txt خصوصی در permanent-staging-access-scope-copy-v67. Source=C:\Users\reza\Desktop\پروژه‌ها\انتشار موقت khazaneh\work\access-scope-copy-v67-20261026/source و branch=codex/access-scope-copy-v67. Stageهای قبلی و۱۵۷ورودی خرید محفوظ‌اند.

Production همچنان نسخه پذیرفته‌شده v66 است؛ این تغییر روی دامنه منتشر نشده و پذیرش/انتشار همین candidate لازم است. هیچ data migration/reset، commit/push یا اتصال Production انجام نشد. بازگشت preview با CURRENT data و binary سازگار v66/v67 ممکن است؛ schema/payload یکی است. شواهد: C:\Users\reza\Desktop\پروژه‌ها\انتشار موقت khazaneh\work\access-scope-copy-v67-20261026/final-evidence.json.