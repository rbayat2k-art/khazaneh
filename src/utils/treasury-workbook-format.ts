import * as XLSX from'xlsx';
const descriptionColumn='شرح سند حسابداری / بابت پرداخت';
const encoder=new TextEncoder(),decoder=new TextDecoder();

/** Only operational treasury workbooks opt into this formatting. Values stay intact. */
export function formatTreasuryDescriptions(book:XLSX.WorkBook){
 for(const name of book.SheetNames){const sheet=book.Sheets[name],range=sheet['!ref']&&XLSX.utils.decode_range(sheet['!ref']);if(!range)continue;
  let column=-1;for(let c=range.s.c;c<=range.e.c;c++)if(sheet[XLSX.utils.encode_cell({r:0,c})]?.v===descriptionColumn){column=c;break;}if(column<0)continue;
  const cols=sheet['!cols']||=[];cols[column]={...cols[column],wch:72};const rows=sheet['!rows']||=[];
  for(let r=0;r<=range.e.r;r++){const cell=sheet[XLSX.utils.encode_cell({r,c:column})];if(!cell)continue;cell.s={...cell.s,alignment:{...cell.s?.alignment,wrapText:true,vertical:'top',readingOrder:2}};
   const lines=String(cell.v??'').split(/\r?\n/).reduce((sum,line)=>sum+Math.max(1,Math.ceil([...line].length/48)),0);rows[r]={...rows[r],hpt:r===0?32:Math.min(400,Math.max(30,lines*18))};
  }
 }return book;
}

/** The installed CE writer ignores alignment. Apply explicit styles to its own
 * generated XLSX ZIP, preserving each original number format and cell content.
 * No uploaded archive/XML is accepted by this function. */
export function treasuryWorkbookBytes(book:XLSX.WorkBook):Uint8Array{
 const data=new Uint8Array(XLSX.write(book,{type:'array',bookType:'xlsx'})),zip=XLSX.CFB.read(data,{type:'buffer'});
 const entry=(suffix:string)=>{const index=zip.FullPaths.findIndex((p:string)=>p.endsWith('/'+suffix));if(index<0)throw Error('Generated workbook part missing');return zip.FileIndex[index];};
 const styles=entry('xl/styles.xml'),xml=decoder.decode(styles.content),match=/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/.exec(xml);if(!match)throw Error('Generated workbook styles missing');
 const original=match[2].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)||[],added:string[]=[],indexes=new Map<number,number>();
 function wrapped(index:number){if(indexes.has(index))return indexes.get(index)!;const base=original[index];if(!base)throw Error('Generated cell format missing');let xf=base.replace(/<xf\b([^>]*?)(\/?)>/,(_all,attrs)=>'<xf'+(/\bapplyAlignment=/.test(attrs)?attrs.replace(/\bapplyAlignment="[^"]*"/,'applyAlignment="1"'):attrs+' applyAlignment="1"')+'>');
  if(base.endsWith('/>'))xf+='<alignment wrapText="1" vertical="top" readingOrder="2"/></xf>';
  else if(/<alignment\b/.test(xf))xf=xf.replace(/<alignment\b[^>]*\/>/,'<alignment wrapText="1" vertical="top" readingOrder="2"/>');
  else xf=xf.replace('</xf>','<alignment wrapText="1" vertical="top" readingOrder="2"/></xf>');
  const next=original.length+added.length;added.push(xf);indexes.set(index,next);return next;
 }
 book.SheetNames.forEach((name,i)=>{const sheet=book.Sheets[name],refs=Object.keys(sheet).filter(ref=>/^[A-Z]+[1-9]\d*$/.test(ref)&&sheet[ref]?.s?.alignment?.wrapText===true);if(!refs.length)return;
  const part=entry('xl/worksheets/sheet'+(i+1)+'.xml');let text=decoder.decode(part.content);
  const wanted=new Set(refs),missing=new Set(refs);
  text=text.replace(/<c\b([^>]*)>/g,(cell,attrs)=>{const ref=/\br="([A-Z]+[1-9]\d*)"/.exec(attrs)?.[1];if(!ref||!wanted.has(ref))return cell;missing.delete(ref);const index=Number(/\bs="(\d+)"/.exec(attrs)?.[1]||0),style=wrapped(index);return'<c'+(/\bs="\d+"/.test(attrs)?attrs.replace(/\bs="\d+"/,'s="'+style+'"'):attrs+' s="'+style+'"')+'>';});
  if(missing.size)throw Error('Generated wrapped cell missing');
  part.content=encoder.encode(text);part.size=part.content.length;
 });
 if(added.length){const attrs=match[1].replace(/\bcount="\d+"/,'count="'+(original.length+added.length)+'"');const styled=xml.replace(match[0],'<cellXfs'+attrs+'>'+match[2]+added.join('')+'</cellXfs>');styles.content=encoder.encode(styled);styles.size=styles.content.length;}
 return new Uint8Array(XLSX.CFB.write(zip,{type:'array',fileType:'zip'}));
}
