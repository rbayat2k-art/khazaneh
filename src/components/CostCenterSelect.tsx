import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Search,X} from 'lucide-react';
import {filterCostCenterOptions,type CostCenterSearchOption} from '../utils/cost-center-search';

// The native select remains the only form value/validation boundary. Search text
// never becomes a cost center, and callers retain their existing name/ID options.
export function CostCenterSelect({className='',onKeyDown,...props}:React.SelectHTMLAttributes<HTMLSelectElement>){
  const select=useRef<HTMLSelectElement>(null),panel=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null),id=useId();
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[options,setOptions]=useState<CostCenterSearchOption[]>([]),[active,setActive]=useState(0),[position,setPosition]=useState<React.CSSProperties>({});
  const filtered=filterCostCenterOptions(options,query),enabled=(o:CostCenterSearchOption)=>!o.disabled;
  function refresh(){setOptions(Array.from(select.current?.options||[]).map((o,index)=>({index,value:o.value,label:o.label,disabled:o.disabled})));}
  function show(initial=''){if(!select.current||select.current.matches(':disabled'))return;refresh();setQuery(initial);setActive(0);setOpen(true);}
  function close(focus=false){setOpen(false);if(focus)select.current?.focus();}
  function choose(o:CostCenterSearchOption){const field=select.current;if(!field||field.matches(':disabled')){close();return;}const current=field.options[o.index];if(!current||current.value!==o.value||current.disabled)return;
    field.value=current.value;field.dispatchEvent(new Event('change',{bubbles:true}));close(true);
  }
  useEffect(()=>{if(open)refresh();},[open,props.children]);
  useEffect(()=>{if(!open)return;const field=select.current!;
    const place=()=>{if(field.matches(':disabled')||!field.isConnected){close();return;}const r=field.getBoundingClientRect(),margin=8,width=Math.min(Math.max(r.width,300),420,innerWidth-margin*2),below=innerHeight-r.bottom-margin,above=r.top-margin,height=Math.min(300,Math.max(below,above));setPosition({position:'fixed',zIndex:10000,width,left:Math.max(margin,Math.min(r.right-width,innerWidth-width-margin)),top:below>=Math.min(220,above)?r.bottom+4:Math.max(margin,r.top-height-4),maxHeight:height});};
    place();search.current?.focus();
    const outside=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!field.parentElement?.contains(e.target as Node))close();};
    const scroll=(e:Event)=>{if(!panel.current?.contains(e.target as Node))place();};
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',place);window.addEventListener('scroll',scroll,true);
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',place);window.removeEventListener('scroll',scroll,true);};
  },[open]);
  useEffect(()=>{if(open)panel.current?.querySelector(`[data-center-index="${active}"]`)?.scrollIntoView({block:'nearest'});},[active,open]);
  const highlighted=filtered[active];
  return <div className="relative min-w-0">
    <select {...props} ref={select} className={`${className} pl-14`} onKeyDown={e=>{onKeyDown?.(e);if(!e.defaultPrevented&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!e.nativeEvent.isComposing&&e.key.length===1&&e.key!==' '){e.preventDefault();show(e.key);}}}/>
    <button type="button" disabled={props.disabled} aria-label="جست‌وجوی مرکز هزینه" title="جست‌وجو با نام یا کد؛ یا هنگام انتخاب مرکز تایپ کنید" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>open?close(true):show()} className="absolute left-6 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-blue-700 rounded disabled:opacity-50"><Search className="w-4 h-4"/></button>
    {open&&createPortal(<div ref={panel} id={id} style={position} dir="rtl" className="flex flex-col text-xs bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}}}>
      <div className="flex items-center gap-2 p-2 border-b border-slate-200 shrink-0"><input ref={search} type="search" role="combobox" aria-label="جست‌وجوی نام یا کد مرکز هزینه" aria-expanded="true" aria-autocomplete="list" aria-controls={id+'-list'} aria-activedescendant={highlighted&&!highlighted.disabled?id+'-option-'+highlighted.index:undefined} autoComplete="off" maxLength={160} placeholder="نام یا کد مرکز هزینه…" value={query} onChange={e=>{setQuery(e.target.value);setActive(0);}} onKeyDown={e=>{
        if(e.key==='Enter'){e.preventDefault();e.stopPropagation();if(highlighted&&enabled(highlighted))choose(highlighted);}
        else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const step=e.key==='ArrowDown'?1:-1;for(let n=1;n<=filtered.length;n++){const next=(active+step*n+filtered.length)%filtered.length;if(enabled(filtered[next])){setActive(next);break;}}}
        else if(e.key==='Tab')close(true);
      }} className="w-full min-w-0 px-2 py-2 bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"/><button type="button" aria-label="بستن جست‌وجوی مرکز هزینه" onClick={()=>close(true)} className="p-1 text-slate-500 hover:text-slate-900 shrink-0"><X className="w-4 h-4"/></button></div>
      <div id={id+'-list'} role="listbox" aria-label="نتایج مرکز هزینه" className="overflow-y-auto min-h-0 p-1">
        {filtered.map((o,i)=><button type="button" role="option" id={id+'-option-'+o.index} key={o.index} data-center-index={i} aria-selected={String(props.value??'')===o.value} disabled={o.disabled} tabIndex={-1} onMouseEnter={()=>setActive(i)} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(o)} className={`w-full block text-right whitespace-normal break-words px-3 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed ${i===active?'bg-blue-50 text-blue-900':'text-slate-700 hover:bg-slate-50'}`}>{o.label}</button>)}
        {!filtered.length&&<p role="status" className="px-3 py-4 text-slate-500">مرکز هزینه‌ای پیدا نشد؛ نام یا کد دیگری جست‌وجو کنید.</p>}
      </div>
      <p className="px-3 py-1.5 text-slate-500 border-t border-slate-200 shrink-0">انتخاب از فهرست با کلیک یا ↑↓ و Enter؛ بستن با Esc</p>
    </div>,select.current?.closest('[role="dialog"]')||document.body)}
  </div>;
}
