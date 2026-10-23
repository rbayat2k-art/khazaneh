export function todayJalali(now:Date=new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${part('year')}/${part('month')}/${part('day')}`;
}
export function currentJalaliMonth(now:Date=new Date()): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long' }).format(now);
}
