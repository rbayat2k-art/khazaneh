/**
 * Iranian Bank Card and IBAN Utilities
 * Formats, cleans, validates and detects bank names from 16-digit card numbers.
 */

import {normalizeCard,normalizeIban} from './bank-identifiers';
export interface BankCardPrefix {
  prefix: string;
  bankName: string;
}

export const IRANIAN_BANK_PREFIXES: BankCardPrefix[] = [
  { prefix: '603799', bankName: 'بانک ملی ایران' },
  { prefix: '170019', bankName: 'بانک ملی ایران' },
  { prefix: '610433', bankName: 'بانک ملت' },
  { prefix: '991975', bankName: 'بانک ملت' },
  { prefix: '627381', bankName: 'بانک تجارت' },
  { prefix: '502229', bankName: 'بانک پاسارگاد' },
  { prefix: '639347', bankName: 'بانک پاسارگاد' },
  { prefix: '621986', bankName: 'بانک سامان' },
  { prefix: '603769', bankName: 'بانک صادرات ایران' },
  { prefix: '589210', bankName: 'بانک سپه' },
  { prefix: '627412', bankName: 'بانک اقتصاد نوین' },
  { prefix: '622106', bankName: 'بانک پارسیان' },
  { prefix: '639194', bankName: 'بانک پارسیان' },
  { prefix: '603770', bankName: 'بانک کشاورزی' },
  { prefix: '639217', bankName: 'بانک کشاورزی' },
  { prefix: '628023', bankName: 'بانک مسکن' },
  { prefix: '589463', bankName: 'بانک رفاه کارگران' },
  { prefix: '636214', bankName: 'بانک آینده' },
  { prefix: '502806', bankName: 'بانک شهر' },
  { prefix: '504706', bankName: 'بانک شهر' },
  { prefix: '504172', bankName: 'بانک رسالت' },
  { prefix: '606373', bankName: 'بانک قرض‌الحسنه مهر ایران' },
  { prefix: '639346', bankName: 'بانک سینا' },
  { prefix: '502938', bankName: 'بانک دی' },
  { prefix: '627488', bankName: 'بانک کارآفرین' },
  { prefix: '639607', bankName: 'بانک سرمایه' },
  { prefix: '627760', bankName: 'پست بانک ایران' },
  { prefix: '502908', bankName: 'بانک توسعه تعاون' },
];

/**
 * Strips all non-digit characters from a card number
 */
export function cleanCardNumber(val: string): string {
  if (!val) return '';
  // Convert Persian/Arabic digits to English digits
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let cleaned = val;
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replace(new RegExp(persianDigits[i], 'g'), String(i));
    cleaned = cleaned.replace(new RegExp(arabicDigits[i], 'g'), String(i));
  }
  return normalizeCard(cleaned);
}

/**
 * Formats a 16-digit card number with dashes: 6037-9918-2345-1101
 */
export function formatCardNumber(val: string): string {
  const digits = cleanCardNumber(val);
  if (!/^\d*$/.test(digits)) return digits;
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.substring(i, i + 4));
  }
  return parts.join('-');
}

/**
 * Detects the bank name from the 16-digit card prefix
 */
export function detectBankFromCard(val: string): string | null {
  const digits = cleanCardNumber(val);
  if (!/^\d{6,16}$/.test(digits)) return null;
  const prefix = digits.substring(0, 6);
  const found = IRANIAN_BANK_PREFIXES.find((b) => b.prefix === prefix);
  return found ? found.bankName : null;
}

/**
 * Cleans and standardizes an Iranian IBAN (starts with IR followed by 24 digits)
 */
export function cleanIban(val: string): string {
  return normalizeIban(val);
}

/**
 * Validates whether a card number has 16 digits and valid Luhn algorithm
 */
export function isValidCardNumber(val: string): boolean {
  const digits = cleanCardNumber(val);
  if (digits.length !== 16) return false;

  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let digit = parseInt(digits.charAt(i), 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
