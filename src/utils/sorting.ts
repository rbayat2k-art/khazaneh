import { useState, useMemo } from 'react';
import type { RequestStatus, CoverStatus, Role } from '../types/treasury';
import {compareEventOrder} from './record-time';

export type SortDirection = 'asc' | 'desc';
export type SortFieldType = 'numeric' | 'text' | 'jalali_date' | 'status' | 'event_time';

export interface SortConfig<T> {
  key: keyof T | string;
  direction: SortDirection;
  type: SortFieldType;
}

export function normalizeDigits(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function normalizeBankNumberSearch(input: unknown): string {
  return normalizeDigits(input)
    .replace(/[\s\-_./]/g, '')
    .toUpperCase();
}

export function normalizePersianText(input: unknown): string {
  if (input === null || input === undefined) return '';
  return normalizeDigits(input)
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .toLowerCase();
}

export function useSortableTable<T extends Record<string, any>>(
  items: T[],
  initialKey: keyof T | string,
  initialType: SortFieldType = 'text',
  initialDirection: SortDirection = 'desc'
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    key: initialKey,
    direction: initialDirection,
    type: initialType,
  });

  const handleSort = (key: keyof T | string, type: SortFieldType = 'text') => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
          type,
        };
      }
      return {
        key,
        direction: 'asc',
        type,
      };
    });
  };

  const sortedItems = useMemo(() => {
    const sortable = [...items];
    const { key, direction, type } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;

    sortable.sort((a, b) => {
      const valA = a[key as keyof T];
      const valB = b[key as keyof T];
      if(type==='event_time')return compareEventOrder(valA,valB,direction);

      if (type === 'numeric') {
        const numA = typeof valA === 'number' ? valA : Number(String(valA ?? '0').replace(/[^0-9.-]+/g, '')) || 0;
        const numB = typeof valB === 'number' ? valB : Number(String(valB ?? '0').replace(/[^0-9.-]+/g, '')) || 0;
        return (numA - numB) * multiplier;
      }

      const strA = normalizePersianText(valA);
      const strB = normalizePersianText(valB);
      return strA.localeCompare(strB, ['fa', 'en'], { numeric: true, sensitivity: 'base' }) * multiplier;
    });

    return sortable;
  }, [items, sortConfig]);

  return {
    sortedItems,
    sortConfig,
    handleSort,
  };
}

export function formatRial(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '۰';
  return Number(amount).toLocaleString('fa-IR');
}

export function getStatusLabel(status: RequestStatus | CoverStatus | string): string {
  switch (status) {
    case 'Pending_Approver':
      return 'در انتظار تایید سرپرست / تاییدکننده';
    case 'Pending_Accounting':
      return 'در انتظار بررسی حسابداری';
    case 'Pending_Treasury':
      return 'تایید نهایی · صف پرداخت خزانه';
    case 'In_Payment':
      return 'در حال پرداخت (مخزن خزانه)';
    case 'Paid':
      return 'پرداخت شده (تسویه)';
    case 'Needs_Revision':
      return 'نیازمند اصلاح (برگشت‌داده‌شده)';
    case 'Rejected':
      return 'رد شده';
    case 'Mixed':
      return 'ترکیبی؛ وضعیت هر ردیف را ببینید';
    case 'Closed':
      return 'بسته و بایگانی‌شده';
    case 'Open':
      return 'باز';
    default:
      return status;
  }
}

export function getStatusTextClass(status: RequestStatus | CoverStatus | string): string {
  switch (status) {
    case 'Pending_Approver':
      return 'text-amber-700 font-medium';
    case 'Pending_Accounting':
      return 'text-sky-700 font-medium';
    case 'Pending_Treasury':
      return 'text-indigo-700 font-semibold';
    case 'In_Payment':
      return 'text-purple-700 font-semibold';
    case 'Paid':
    case 'Closed':
      return 'text-emerald-700 font-semibold';
    case 'Needs_Revision':
      return 'text-orange-700 font-semibold';
    case 'Rejected':
      return 'text-rose-700 font-medium';
    default:
      return 'text-slate-600';
  }
}

export function getRoleLabel(
  role: Role,
  roleConfigs?: { role: string; title: string }[]
): string {
  if (roleConfigs && roleConfigs.length > 0) {
    const found = roleConfigs.find((r) => r.role === role);
    if (found && found.title) return found.title;
  }
  switch (role) {
    case 'ADMIN':
      return 'مدیر فنی سامانه (ادمین)';
    case 'APPROVER':
      return 'سرپرست و تأییدکننده واحد';
    case 'REQUESTER':
      return 'متقاضی / کارمند';
    case 'ACCOUNTING':
      return 'حسابداری و کنترل مالی';
    case 'TREASURY':
      return 'خزانه‌داری و پرداخت';
    default:
      return role;
  }
}

export function getStatusBadgeClasses(status: RequestStatus | CoverStatus | string): string {
  switch (status) {
    case 'Pending_Approver':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Pending_Accounting':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'Pending_Treasury':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    case 'In_Payment':
      return 'bg-purple-50 text-purple-800 border-purple-200';
    case 'Paid':
    case 'Closed':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Needs_Revision':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'Rejected':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function getPriorityBadgeClasses(priority?: string): string {
  return priority === 'Urgent'
    ? 'bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-bold'
    : 'bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[11px]';
}

export function getPriorityLabel(priority?: string): string {
  return priority === 'Urgent' ? 'فوری و اضطراری' : 'عادی';
}



