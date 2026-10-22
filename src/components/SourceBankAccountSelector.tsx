import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Building2,
  CheckCircle2,
  ChevronDown,
  X,
  PlusCircle,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import type { CompanyBankAccount, PaymentMethodType } from '../types/treasury';
import { normalizePersianText, normalizeBankNumberSearch } from '../utils/sorting';

interface SourceBankAccountSelectorProps {
  accounts: CompanyBankAccount[];
  selectedAccountId: string | null;
  onSelectAccount: (account: CompanyBankAccount | null) => void;
  paymentMethod?: PaymentMethodType;
  allowedCompanies?: string[];
  canManageBankAccounts?: boolean;
  onNavigateToDefineAccount?: () => void;
  onOpenQuickCreate?: () => void;
  label?: string;
  required?: boolean;
  errorMessage?: string | null;
}

export const SourceBankAccountSelector: React.FC<SourceBankAccountSelectorProps> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  paymentMethod,
  allowedCompanies,
  canManageBankAccounts = false,
  onNavigateToDefineAccount,
  onOpenQuickCreate,
  label = 'انتخاب حساب بانکی مبدأ پرداخت شرکت (الزامی)',
  required = true,
  errorMessage = null,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Only active accounts within allowed companies are selectable for new payments
  const selectableAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (acc.isActive === false || acc.status === 'INACTIVE') return false;
      const comp = acc.company || acc.companyName;
      if (
        allowedCompanies &&
        allowedCompanies.length > 0 &&
        comp &&
        !allowedCompanies.includes(comp)
      ) {
        return false;
      }
      return true;
    });
  }, [accounts, allowedCompanies]);

  const selectedAccount = useMemo(
    () => selectableAccounts.find((a) => a.id === selectedAccountId) || null,
    [selectableAccounts, selectedAccountId]
  );

  // Filter accounts by Persian/English digits, spaces, bank name, title, holder, accountNumber, cardNumber, iban
  const filteredAccounts = useMemo(() => {
    const cleanText = normalizePersianText(query);
    const cleanNum = normalizeBankNumberSearch(query);

    if (!cleanText && !cleanNum) {
      return selectableAccounts;
    }

    return selectableAccounts.filter((acc) => {
      const matchText =
        normalizePersianText(acc.bankName).includes(cleanText) ||
        normalizePersianText(acc.accountTitle).includes(cleanText) ||
        normalizePersianText(acc.accountHolderName || acc.companyName || '').includes(cleanText) ||
        normalizePersianText(acc.company || acc.companyName || '').includes(cleanText);

      const accNumNorm = normalizeBankNumberSearch(acc.accountNumber);
      const cardNorm = normalizeBankNumberSearch(acc.cardNumber);
      const ibanNorm = normalizeBankNumberSearch(acc.iban);
      const ibanDigitsOnly = ibanNorm.replace(/^IR/i, '');
      const queryDigitsOnly = cleanNum.replace(/^IR/i, '');

      const matchNumber =
        cleanNum.length > 0 &&
        (accNumNorm.includes(cleanNum) ||
          cardNorm.includes(cleanNum) ||
          ibanNorm.includes(cleanNum) ||
          (queryDigitsOnly.length > 0 && ibanDigitsOnly.includes(queryDigitsOnly)));

      return matchText || matchNumber;
    });
  }, [selectableAccounts, query]);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const itemEl = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    if (itemEl && typeof itemEl.scrollIntoView === 'function') {
      itemEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleChooseAccount = (acc: CompanyBankAccount) => {
    onSelectAccount(acc);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else if (filteredAccounts.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredAccounts.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(Math.max(0, filteredAccounts.length - 1));
      } else if (filteredAccounts.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + filteredAccounts.length) % filteredAccounts.length);
      }
    } else if (e.key === 'Enter') {
      // CRITICAL: Never allow Enter inside the account search input to accidentally submit the parent payment form!
      e.preventDefault();
      e.stopPropagation();
      if (isOpen && filteredAccounts.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredAccounts.length) {
        handleChooseAccount(filteredAccounts[highlightedIndex]);
      } else if (!isOpen) {
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    } else if (e.key === 'Tab') {
      // Allow Tab to naturally move focus to the next field while closing the dropdown
      setIsOpen(false);
    }
  };

  // Check if selected account has the identifier required for the chosen paymentMethod
  const methodCompatibilityWarning = useMemo(() => {
    if (!selectedAccount || !paymentMethod) return null;
    if (paymentMethod === 'IBAN_PAYA_SATNA' && !selectedAccount.iban) {
      return 'این حساب مبدأ فاقد شماره شبا برای حواله پایا/ساتنا است.';
    }
    if (paymentMethod === 'CARD_TO_CARD' && !selectedAccount.cardNumber) {
      return 'این حساب مبدأ فاقد شماره کارت بانکی برای پرداخت کارت به کارت است.';
    }
    if (paymentMethod === 'ACCOUNT_TRANSFER' && !selectedAccount.accountNumber) {
      return 'این حساب مبدأ فاقد شماره حساب بانکی برای انتقال حساب به حساب است.';
    }
    return null;
  }, [selectedAccount, paymentMethod]);

  return (
    <div ref={containerRef} className="space-y-1.5 relative text-xs">
      <div className="flex items-center justify-between">
        <label className="block font-bold text-slate-800">
          {label} {required && <span className="text-rose-600">*</span>}
        </label>
        <span className="text-[10px] text-slate-500">
          قابلیت جستجو با نام بانک، عنوان، شماره حساب، شبا یا کارت (↑↓ و Enter)
        </span>
      </div>

      {/* Selected Account Card */}
      {selectedAccount ? (
        <div className="bg-emerald-50/90 border-2 border-emerald-600 rounded-xl p-3 space-y-2 transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <div>
                <div className="font-bold text-slate-950 text-xs flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-emerald-700 text-white rounded text-[11px]">
                    {selectedAccount.bankName}
                  </span>
                  <span>{selectedAccount.accountTitle}</span>
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  صاحب حساب:{' '}
                  <strong className="text-slate-800">
                    {selectedAccount.accountHolderName || selectedAccount.companyName || 'هلدینگ مرکزی آریا'}
                  </strong>{' '}
                  ({selectedAccount.company || selectedAccount.companyName || 'هلدینگ مرکزی آریا'})
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onSelectAccount(null);
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 20);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
              <span>تغییر حساب مبدأ</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-200/80 text-[11px]">
            <div className="bg-white/90 px-2.5 py-1.5 rounded border border-emerald-200">
              <span className="text-slate-500 block text-[10px]">شماره حساب مبدأ:</span>
              <strong className="font-mono-num text-slate-900" dir="ltr">
                {selectedAccount.accountNumber || '—'}
              </strong>
            </div>
            <div className="bg-white/90 px-2.5 py-1.5 rounded border border-emerald-200 sm:col-span-2">
              <span className="text-slate-500 block text-[10px]">شماره شبا (IBAN):</span>
              <strong className="font-mono-num text-slate-900" dir="ltr">
                {selectedAccount.iban || '—'}
              </strong>
            </div>
            {selectedAccount.cardNumber && (
              <div className="bg-white/90 px-2.5 py-1.5 rounded border border-emerald-200 sm:col-span-3 flex items-center justify-between">
                <span className="text-slate-500 text-[10px]">شماره کارت متصل به حساب:</span>
                <strong className="font-mono-num text-slate-900" dir="ltr">
                  {selectedAccount.cardNumber}
                </strong>
              </div>
            )}
          </div>

          {methodCompatibilityWarning && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-900 bg-amber-100/90 border border-amber-300 px-2.5 py-1.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>{methodCompatibilityWarning}</span>
            </div>
          )}
        </div>
      ) : (
        /* Combobox Search Input */
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="نام بانک، عنوان حساب، شماره حساب، شبا یا کارت را تایپ کنید..."
            className={`w-full pr-9 pl-9 py-2.5 bg-white border rounded-xl text-xs font-medium focus:outline-none transition ${
              errorMessage
                ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                : 'border-slate-300 focus:border-slate-900'
            }`}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            title="مشاهده فهرست حساب‌های فعال"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {query.trim().length > 0 && !selectedAccount && (
            <div className="mt-1 text-[11px] text-amber-700 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>صرف تایپ متن کافی نیست؛ یک حساب معتبر از فهرست زیر با کلید Enter یا کلیک انتخاب کنید.</span>
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="text-[11px] text-rose-700 font-semibold flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Dropdown Results List */}
      {isOpen && !selectedAccount && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[10px] text-slate-600">
            <span>
              حساب‌های بانکی فعال مجاز ({filteredAccounts.length.toLocaleString('fa-IR')} حساب)
            </span>
            <span>حرکت: ↑↓ | انتخاب: Enter | بستن: Esc</span>
          </div>

          {filteredAccounts.length === 0 ? (
            <div className="p-4 text-center space-y-2.5">
              <div className="text-slate-600 font-medium">
                هیچ حساب بانکی فعالی مطابق با عبارت «{query}» یافت نشد.
              </div>
              {(onOpenQuickCreate || (canManageBankAccounts && onNavigateToDefineAccount)) && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (onOpenQuickCreate) onOpenQuickCreate();
                    else if (onNavigateToDefineAccount) onNavigateToDefineAccount();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>تعریف حساب مبدأ جدید در بخش «بانک‌ها و شماره حساب‌ها»</span>
                </button>
              )}
            </div>
          ) : (
            <ul
              ref={listRef}
              role="listbox"
              className="max-h-64 overflow-y-auto divide-y divide-slate-100"
            >
              {filteredAccounts.map((acc, index) => {
                const isHighlighted = index === highlightedIndex;
                return (
                  <li
                    key={acc.id}
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => {
                      // Prevent input blur before selection
                      e.preventDefault();
                      handleChooseAccount(acc);
                    }}
                    className={`p-3 cursor-pointer transition-colors ${
                      isHighlighted ? 'bg-sky-50 border-r-4 border-sky-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded text-[10px]">
                          {acc.bankName}
                        </span>
                        <span>{acc.accountTitle}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 shrink-0">
                        {acc.company || acc.companyName || 'هلدینگ مرکزی آریا'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 mt-1">
                      صاحب حساب:{' '}
                      <strong className="text-slate-800">
                        {acc.accountHolderName || acc.companyName || 'هلدینگ مرکزی آریا'}
                      </strong>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono-num text-slate-700">
                      {acc.accountNumber && (
                        <span>
                          شماره حساب: <strong className="text-slate-950" dir="ltr">{acc.accountNumber}</strong>
                        </span>
                      )}
                      {acc.iban && (
                        <span>
                          شبا: <strong className="text-slate-900" dir="ltr">{acc.iban}</strong>
                        </span>
                      )}
                      {acc.cardNumber && (
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <CreditCard className="w-3 h-3" />
                          <span dir="ltr">{acc.cardNumber}</span>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
