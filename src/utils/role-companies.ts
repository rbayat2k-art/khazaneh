export type CompanyChoice={id:string;name:string;isActive?:boolean};

export const companySelected=(values:string[],company:CompanyChoice)=>values.some(v=>v.trim()===company.id||v.trim()===company.name);

/** Preserve untouched legacy values; only an explicit selection creates a stable ID grant. */
export function toggleRoleCompany(values:string[],company:CompanyChoice,checked:boolean):string[]{
 if(checked)return companySelected(values,company)?values:[...values,company.id];
 return values.filter(v=>v.trim()!==company.id&&v.trim()!==company.name);
}

export function roleCompaniesError(value:unknown,previous:string[],companies:CompanyChoice[]):string|undefined{
 if(!Array.isArray(value)||value.some(v=>typeof v!=='string'||!v.trim()))return 'شرکت‌های مجاز باید فهرستی از شناسه یا نام معتبر شرکت باشند.';
 const known=new Set(companies.flatMap(c=>[c.id,c.name]));
 if(value.some(v=>!known.has(v.trim())&&!previous.includes(v)))return 'شرکت انتخاب‌شده در فهرست شرکت‌های سامانه وجود ندارد؛ صفحه را تازه کنید.';
}
