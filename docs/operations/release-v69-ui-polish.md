# انتشار v69 — متن محدوده دسترسی، آیکون و عرض فرم پرداخت

۱. وضعیت و مجوز: PASS / DEPLOYED روی https://shahrahsystem.ir در 2026-10-26T08:50:31.176Z (26/10/2026, 12:20:31 تهران). مالک پس از تحویل Staging صریحاً انتشار فقط تغییرات اسم/آیکون/عرض را خواست.

۲. تغییر: متن و راهنمای روشن محدودهٔ خود فرد/ارجاع‌شده/زیرمجموعه در فرم کاربر و نقش؛ favicon هم‌شکل نشان فعلی با SVG/ICO و آیکون Apple؛ عرض پنجره مشترک ثبت پرداخت از576 به768 پیکسل، موبایل سازگار. backend وstorage عیناً برابر v66؛ نقش، گردش، مبلغ، رمز و داده تغییر نکردند. نام مساعده‌های v66 نیز محفوظ است.

۳. آزمون: verified build و TypeScript و مرورگرهای Stage طبق رکوردهایv67b/v68b/v69؛ عرض768 در1440/1024 و358 در390 بدون سرریز افقی، مشاهده/بستن بدون تغییر درخواست. مرورگر عمومی دامنه دسکتاپ/موبایل، hash فایل‌های واقعی و متن/کلاس جدید، MIME وdecode وversion آیکون‌ها PASS. تصویر نوار بومی تب ثبت نشده؛ لینک وdecode واقعی آزموده شد. full suite مالی و فشار تازه NOT RUN چون کد اجرایی backend/storage عین نسخه فعلی است.

۴. هویت: manifest=96c6fa147a48f329028a62c361d13daf40628fb4e93cb1fa61caf91a51e3ac37؛ branch=codex/treasury-payment-modal-width-v69؛ source=C:\Users\reza\Desktop\پروژه‌ها\انتشار موقت khazaneh/work/treasury-payment-modal-width-v69-20261026/source؛ release=/home/shahrahsystem_dev/khazaneh-release-96c6fa147a48. تغییراتv67b/v68b در همین artifact هستند. خرید فقط Stage55120 باقی است و157ورودی آن حفظ شد؛ پیش از نشر آینده خرید،v64/v65/v66/v69 ادغام و آزموده شود. commit/push یا حذف کد انجام نشد.

۵. حفظ اطلاعات: بکاپ تازه60فایل داده/پیوست/کد/تنظیمات/vault، drain و توقف writer، restore مستقل داخل و خارج سرور و تطبیق همه فایل‌ها PASS. نسخه خصوصی خارجسرور C:\Users\reza\Desktop\پروژه‌ها\انتشار موقت khazaneh/private/release-v53-v69-20261026. تمام state/رمز/ACL/نشست/تنظیمات startup دقیقاً برابر، مجوزافزوده0؛ vault opaque قبل و بعد برابر.

۶. recovery: plan=14da44415e8d4ebfde89feea3efa561b91e1371dda56fe7737257767d420dbf1؛ publisher=928e67dd64cafec1d44e7e5eec64d98f1288dbf91770465e94ce15f6ce43f70f؛ helper=b9f14f184f1f31eedb7d21cd4922e9fbd0cab75fa1aca0318d273925ddfc975a؛ root=/home/shahrahsystem_dev/khazaneh-upgrade-96c6fa147a48-v53. بازیابی فقط با CURRENT data/files/vault وbinaryسازگارv69 وackمستقلvault و سپسopen؛ restore قدیمی روی ثبت جدید مجاز نیست. abort فقط پیش از admission و باv66سازگار. نام قراردادFORWARD_ONLY_CURRENT_STATE_V65C_APPROVAL_CHAIN همان قرارداد schema1 پیشین است.

۷. سلامت: backendPID=2732332؛ gatewayPID=2732837؛ restart0، quick_check=ok وerror tail0. health دامنه وwww و401ناشناس وread-only نشست موجودADMIN/تنظیمات استعلام PASS. پایش 2026-10-26T08:50:31.176Z تا 2026-10-26T08:52:48.559Z کوتاه‌مدت است. هفت Stage قبلی/جدید healthy و محفوظ؛ هیچ تست مالی/ورودوخروج/بانک/پیامک یا فشار روی Production انجام نشد.

نکته قابل‌ردیابی: setupاول به‌علت سهpinنشانیv66 درinstaller پیش از runtime/data mutation FAIL شد. فقطpinهااصلاح و همهassertهاحفظ شدند؛ بسته وlogقبلی درfailed-setup-v1 و آرشیوسرور محفوظ؛ setupدومPASS. بازبینی مستقل نهاییfindingبازنداشت.

شواهد کامل: C:\Users\reza\Desktop\پروژه‌ها\انتشار موقت khazaneh\work\release-v69-20261026/final-evidence.json؛ رکوردهای آزمایش مستقلstaging-v67b-access-scope-copy.md،staging-v68-browser-favicon.md،staging-v69-treasury-modal-width.md.