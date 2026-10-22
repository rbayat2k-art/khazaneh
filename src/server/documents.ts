/** Inline documents are private record data, never executable URLs or remote fetches. */
export function inlineDocumentError(value:unknown):string|null {
  const error='پیوست باید PNG، JPG، WEBP، GIF یا PDF و حداکثر۱۰مگابایت باشد؛ SVG، لینک بیرونی و محتوای فعال پذیرفته نیست.';
  if(typeof value!=='string'||value.length>14*1024*1024)return error;
  // SVG is an executable document format; a tag/attribute denylist is not a
  // parser/sandbox. Newly uploaded SVG is refused, while existing archived data
  // and the server's independently escaped receipt renderer are not rewritten.
  const match=/^data:(image\/(?:png|jpeg|webp|gif)|application\/pdf);base64,([\s\S]*)$/i.exec(value);if(!match)return error;
  let bytes:Buffer;try{if(!/^[a-z\d+/]*={0,2}$/i.test(match[2])||match[2].length%4!==0)return error;bytes=Buffer.from(match[2],'base64');}catch{return error;}
  if(!bytes.length||bytes.length>10*1024*1024)return error;
  return null;
}

export function documentInputError(body:any,route:string):string|null {
  if(!['/advance-requests','/payment-requests','/batch-payments','/requests/resubmit','/treasury/execute-payment','/treasury/manual-payment'].includes(route))return null;
  const lists=[body.attachments,body.newAttachments,...(Array.isArray(body.items)?body.items.map((item:any)=>item?.attachments):[])];
  for(const list of lists){if(list===undefined)continue;if(!Array.isArray(list)||list.length>50)return 'فهرست پیوست‌ها معتبر نیست.';
    for(const file of list){if(!file||typeof file.id!=='string'||!file.id||typeof file.name!=='string'||!file.name||file.name.length>255||!Number.isSafeInteger(file.size)||file.size<0||file.size>10*1024*1024||typeof file.type!=='string')return 'اطلاعات پیوست معتبر نیست.';const error=inlineDocumentError(file.url);if(error)return error;}
  }
  if(body.receiptFileUrl){const error=inlineDocumentError(body.receiptFileUrl);if(error)return error;}
  return null;
}

export function xmlText(value:unknown):string {return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));}
