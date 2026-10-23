/**
 * Iranian Bank Card and IBAN Utilities
 * Formats, cleans, validates and detects bank names from 16-digit card numbers.
 */

import {normalizeCard,normalizeIban} from './bank-identifiers';
import {SYSTEM_BANKS} from '../types/treasury';
export interface BankCardPrefix {
  prefix: string;
  bankName: string;
}

// Issuer BIN catalogue, not live card/ownership validation or a bank-license register.
// Source: alibaba-aero/griphook banks.json @8f2b2543b62f9ee08b23404e0683313a53bc4d56.
// Historical issuers are labelled explicitly; no existing records are renamed.
export const IRANIAN_BANK_PREFIXES: BankCardPrefix[] = [
  { prefix: '603799', bankName: 'بانک ملی ایران' },
  { prefix: '170019', bankName: 'بانک ملی ایران' },
  { prefix: '589905', bankName: 'بانک ملی ایران' },
  { prefix: '610433', bankName: 'بانک ملت' },
  { prefix: '991975', bankName: 'بانک ملت' },
  { prefix: '585983', bankName: 'بانک تجارت' },
  { prefix: '627353', bankName: 'بانک تجارت' },
  { prefix: '627381', bankName: 'بانک انصار (پیش‌شماره قدیمی)' },
  { prefix: '502229', bankName: 'بانک پاسارگاد' },
  { prefix: '639347', bankName: 'بانک پاسارگاد' },
  { prefix: '621986', bankName: 'بانک سامان' },
  { prefix: '603769', bankName: 'بانک صادرات' },
  { prefix: '589210', bankName: 'بانک سپه' },
  { prefix: '627412', bankName: 'بانک اقتصاد نوین' },
  { prefix: '627884', bankName: 'بانک اقتصاد نوین' },
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
  { prefix: '502910', bankName: 'بانک کارآفرین' },
  { prefix: '639607', bankName: 'بانک سرمایه' },
  { prefix: '627760', bankName: 'پست بانک ایران' },
  { prefix: '502908', bankName: 'بانک توسعه تعاون' },
  { prefix: '627648', bankName: 'بانک توسعه صادرات ایران' },
  { prefix: '207177', bankName: 'بانک توسعه صادرات ایران' },
  { prefix: '627961', bankName: 'بانک صنعت و معدن' },
  { prefix: '505416', bankName: 'بانک گردشگری' },
  { prefix: '505785', bankName: 'بانک ایران زمین' },
  { prefix: '505809', bankName: 'بانک خاورمیانه' },
  { prefix: '636795', bankName: 'بانک مرکزی' },
  { prefix: '606256', bankName: 'مؤسسه اعتباری ملل' },
  { prefix: '639599', bankName: 'بانک قوامین (پیش‌شماره قدیمی)' },
  { prefix: '636949', bankName: 'بانک حکمت ایرانیان (پیش‌شماره قدیمی)' },
  { prefix: '505801', bankName: 'مؤسسه کوثر (پیش‌شماره قدیمی)' },
  { prefix: '639370', bankName: 'بانک مهر اقتصاد (پیش‌شماره قدیمی)' },
  { prefix: '507677', bankName: 'مؤسسه نور (پیش‌شماره قدیمی)' },
  { prefix: '628157', bankName: 'مؤسسه اعتباری توسعه (پیش‌شماره قدیمی)' },
];

// Destination forms must actually offer every detected label, without changing
// the separate bank-account/source-account catalogue or historical stored names.
export const DESTINATION_BANKS: string[]=[...new Set<string>([...SYSTEM_BANKS,...IRANIAN_BANK_PREFIXES.map(b=>b.bankName)])];

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
