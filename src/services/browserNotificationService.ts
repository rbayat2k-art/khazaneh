import type { NotificationEventType } from '../types/treasury';

const PORTAL_NOTIFICATION_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" rx="28" fill="#0f172a"/>
    <path d="M64 24L24 46v10h80V46L64 24z" fill="#fbbf24"/>
    <rect x="34" y="64" width="12" height="32" rx="3" fill="#f8fafc"/>
    <rect x="58" y="64" width="12" height="32" rx="3" fill="#f8fafc"/>
    <rect x="82" y="64" width="12" height="32" rx="3" fill="#f8fafc"/>
    <rect x="24" y="100" width="80" height="10" rx="4" fill="#fbbf24"/>
  </svg>`
)}`;

export interface BrowserPushOptions {
  id: string;
  title: string;
  body: string;
  tag?: string;
  eventType?: NotificationEventType;
  onClick?: () => void;
}

export interface PermissionRequestResult {
  permission: NotificationPermission | 'unsupported';
  granted: boolean;
  errorMessage?: string;
}

/**
 * Checks whether the current browser environment supports the Web Notification API.
 */
export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Returns the current permission state of the browser Notification API.
 */
export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

/**
 * Reads user preference for browser desktop notifications from localStorage.
 */
export function isUserDesktopNotificationEnabled(userId: string): boolean {
  try {
    const val = localStorage.getItem(`treasury_desktop_notif_pref_${userId}`);
    if (val === null) return true; // enabled by default when permission is granted
    return val === 'true';
  } catch {
    return true;
  }
}

/**
 * Saves user preference for browser desktop notifications.
 */
export function setUserDesktopNotificationEnabled(userId: string, enabled: boolean): void {
  try {
    localStorage.setItem(`treasury_desktop_notif_pref_${userId}`, enabled ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
}

/**
 * Tracks which notification IDs have already been pushed to the Windows/OS notification center
 * for a given user so page reloads do not re-trigger historical notifications.
 */
export function hasNotificationBeenPushedToOS(userId: string, notificationId: string): boolean {
  try {
    const raw = localStorage.getItem(`treasury_pushed_notif_ids_${userId}`);
    if (!raw) return false;
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) && list.includes(notificationId);
  } catch {
    return false;
  }
}

export function markNotificationPushedToOS(userId: string, notificationId: string): void {
  try {
    const key = `treasury_pushed_notif_ids_${userId}`;
    const raw = localStorage.getItem(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(notificationId)) {
      const updated = [notificationId, ...list].slice(0, 200);
      localStorage.setItem(key, JSON.stringify(updated));
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Seeds existing notifications as already pushed on initial load if no record exists yet,
 * preventing a burst of old notifications on first login while allowing new ones to fire.
 */
export function seedInitialPushedNotifications(userId: string, notificationIds: string[]): void {
  try {
    const key = `treasury_pushed_notif_ids_${userId}`;
    const existing = localStorage.getItem(key);
    if (existing === null) {
      localStorage.setItem(key, JSON.stringify(notificationIds.slice(0, 200)));
    }
  } catch {
    // ignore
  }
}

/**
 * Requests permission from the user's browser to display OS / Windows notifications.
 */
export async function requestBrowserNotificationPermission(): Promise<PermissionRequestResult> {
  if (!isBrowserNotificationSupported()) {
    return {
      permission: 'unsupported',
      granted: false,
      errorMessage: 'مرورگر فعلی شما از Web Notification API پشتیبانی نمی‌کند.',
    };
  }

  try {
    let permission: NotificationPermission;
    const reqResult = window.Notification.requestPermission();
    if (reqResult && typeof reqResult.then === 'function') {
      permission = await reqResult;
    } else {
      permission = await new Promise<NotificationPermission>((resolve) => {
        window.Notification.requestPermission((res) => resolve(res));
      });
    }

    if (permission === 'granted') {
      return { permission: 'granted', granted: true };
    }
    if (permission === 'denied') {
      return {
        permission: 'denied',
        granted: false,
        errorMessage:
          'دسترسی ارسال اعلان در تنظیمات مرورگر مسدود (Block) شده است. لطفاً از آیکون قفل کنار آدرس مرورگر، مجوز Notifications را روی Allow قرار دهید.',
      };
    }
    return {
      permission,
      granted: false,
      errorMessage: 'مجوز نمایش اعلان ویندوز توسط کاربر تایید نشد (معلق ماند).',
    };
  } catch (err) {
    return {
      permission: window.Notification.permission,
      granted: false,
      errorMessage:
        err instanceof Error
          ? `محدودیت امنیتی مرورگر یا قاب (iFrame): ${err.message}`
          : 'خطا در درخواست مجوز اعلان مرورگر.',
    };
  }
}

/**
 * Sends a native Browser Push Notification (Windows Action Center / OS Notification)
 * using the standard Web Notification API.
 */
export function sendBrowserPushNotification(options: BrowserPushOptions): {
  sent: boolean;
  reason?: string;
} {
  if (!isBrowserNotificationSupported()) {
    return { sent: false, reason: 'UNSUPPORTED' };
  }

  if (window.Notification.permission !== 'granted') {
    return { sent: false, reason: 'PERMISSION_NOT_GRANTED' };
  }

  try {
    const notif = new window.Notification(options.title, {
      body: options.body,
      dir: 'rtl',
      lang: 'fa-IR',
      tag: options.tag || options.id,
      icon: PORTAL_NOTIFICATION_ICON,
      badge: PORTAL_NOTIFICATION_ICON,
      silent: false,
    });

    notif.onclick = (event) => {
      event.preventDefault();
      try {
        window.focus();
      } catch {
        // ignore focus restrictions
      }
      if (options.onClick) {
        options.onClick();
      }
      notif.close();
    };

    return { sent: true };
  } catch (err) {
    // Fallback to ServiceWorker registration if available
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.showNotification(options.title, {
            body: options.body,
            dir: 'rtl',
            lang: 'fa-IR',
            tag: options.tag || options.id,
            icon: PORTAL_NOTIFICATION_ICON,
            badge: PORTAL_NOTIFICATION_ICON,
          });
        })
        .catch(() => {
          // ignore fallback error
        });
      return { sent: true };
    }

    return {
      sent: false,
      reason: err instanceof Error ? err.message : 'NOTIFICATION_CONSTRUCTOR_ERROR',
    };
  }
}

/**
 * Returns human-readable Persian metadata for each notification event type.
 */
export function getNotificationEventMeta(eventType: NotificationEventType): {
  label: string;
  badgeClass: string;
} {
  switch (eventType) {
    case 'REQUEST_RESUBMITTED':
      return {
        label: 'ارسال مجدد درخواست',
        badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      };
    case 'FINAL_APPROVED_ACCOUNTING':
      return {
        label: 'تایید نهایی',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      };
    case 'APPROVED_SUPERVISOR':
      return {
        label: 'تایید سرپرست',
        badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
      };
    case 'RETURNED_FOR_REVISION':
      return {
        label: 'برگشت جهت اصلاح',
        badgeClass: 'bg-amber-100 text-amber-950 border-amber-300',
      };
    case 'PAYMENT_EXECUTED':
      return {
        label: 'پرداخت نهایی و فیش',
        badgeClass: 'bg-teal-100 text-teal-900 border-teal-300',
      };
    case 'AMOUNT_MODIFIED':
      return {
        label: 'اصلاح مبلغ / یادداشت',
        badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
      };
    case 'REQUEST_SUBMITTED':
    default:
      return {
        label: 'ثبت درخواست جدید',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      };
  }
}
