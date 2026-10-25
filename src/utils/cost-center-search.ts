import {normalizePersianText} from './sorting';
export type CostCenterSearchOption={value:string;label:string;disabled:boolean;index:number};
export function filterCostCenterOptions<T extends {label:string}>(options:T[],query:string):T[]{
  const words=normalizePersianText(query).replace(/\u200c/g,' ').split(/\s+/).filter(Boolean);
  return words.length?options.filter(o=>{const text=normalizePersianText(o.label).replace(/\u200c/g,' ');return words.every(word=>text.includes(word));}):options;
}
