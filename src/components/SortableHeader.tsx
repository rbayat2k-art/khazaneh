import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { SortConfig, SortFieldType } from '../utils/sorting';

interface SortableHeaderProps<T> {
  label: string;
  field: keyof T | string;
  type?: SortFieldType;
  sortConfig: SortConfig<T>;
  onSort: (field: keyof T | string, type: SortFieldType) => void;
  className?: string;
}

export function SortableHeader<T>({
  label,
  field,
  type = 'text',
  sortConfig,
  onSort,
  className = '',
}: SortableHeaderProps<T>) {
  const isActive = sortConfig.key === field;
  const direction = isActive ? sortConfig.direction : null;
  const compact = type === 'event_time';

  const sortHint =
    type==='event_time'||type==='jalali_date' ? direction==='asc'?'قدیمی به جدید':direction==='desc'?'جدید به قدیمی':'مرتب‌سازی زمانی' : type === 'numeric'
      ? direction === 'asc'
        ? 'کم به زیاد'
        : direction === 'desc'
        ? 'زیاد به کم'
        : 'مرتب‌سازی عددی'
      : direction === 'asc'
      ? 'الف تا ی (A-Z)'
      : direction === 'desc'
      ? 'ی تا الف (Z-A)'
      : 'مرتب‌سازی الفبایی';

  return (
    <th
      scope="col"
      aria-sort={
        isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className={`${compact ? 'px-1' : 'px-2'} py-2.5 text-right text-[11px] font-bold text-slate-700 select-none border-b border-slate-200 bg-slate-50/90 align-middle ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(field, type)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSort(field, type);
          }
        }}
        title={`${label} — ${sortHint} (کلید Enter یا Space)`}
        className={`group inline-flex flex-wrap items-center ${compact ? 'gap-0.5 px-0.5' : 'gap-1 px-1'} rounded py-0.5 transition-colors text-right leading-tight cursor-pointer ${
          isActive
            ? 'text-slate-950 font-bold bg-slate-200/75'
            : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/40'
        }`}
      >
        <span className="break-words">{label}</span>
        <span className="inline-flex items-center text-slate-500 group-hover:text-slate-900 shrink-0">
          {!isActive && <ArrowUpDown className="w-3 h-3 opacity-60" />}
          {isActive && direction === 'asc' && (
            <ArrowUp className="w-3 h-3 text-slate-900" />
          )}
          {isActive && direction === 'desc' && (
            <ArrowDown className="w-3 h-3 text-slate-900" />
          )}
        </span>
      </button>
    </th>
  );
}
