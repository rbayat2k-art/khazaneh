import {jalaliDateError,normalizeDateDigits} from '../utils/jalali-date';
import {todayJalali} from '../utils/current-date';
/** Input normalization only; financial state is untouched on an invalid field. */
export function normalizeFormDates(body:Record<string,unknown>,fields:string[],newRequest=false):string|null {
  for(const key of fields){const error=jalaliDateError(body[key],newRequest?todayJalali():undefined);if(error)return error;}
  for(const key of fields)if(typeof body[key]==='string')body[key]=normalizeDateDigits(body[key]);
  return null;
}
