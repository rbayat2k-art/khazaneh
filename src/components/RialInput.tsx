import React,{forwardRef,useEffect,useRef,useState} from 'react';
import {formatRialInput,rawRialInput,rialInputError} from '../utils/rial-input';

export const RialInput=forwardRef<HTMLInputElement,React.InputHTMLAttributes<HTMLInputElement>>(function RialInput({value='',onChange,type:_type,min,max,...props},forwarded){
  const ref=useRef<HTMLInputElement>(null),[invalidDraft,setInvalidDraft]=useState<string|null>(null);
  const raw=rawRialInput(String(value??'')),display=invalidDraft??formatRialInput(raw);
  useEffect(()=>{setInvalidDraft(null);},[value]);
  useEffect(()=>{ref.current?.setCustomValidity(rialInputError(invalidDraft??raw,min,max));},[raw,invalidDraft,min,max]);
  const change=(event:React.ChangeEvent<HTMLInputElement>)=>{
    const input=event.currentTarget,digitsBefore=rawRialInput(input.value.slice(0,input.selectionStart??input.value.length)).length;
    const next=rawRialInput(input.value),error=rialInputError(next,min,max);
    input.setCustomValidity(error);
    // Keep malformed drafts visible and invalid; never reinterpret a decimal/exponent or silently save an old amount.
    setInvalidDraft(error?next:null);if(error)return;input.value=next;onChange?.(event);
    requestAnimationFrame(()=>{if(document.activeElement!==input)return;let count=0,index=0;while(index<input.value.length&&count<digitsBefore){if(/[0-9]/.test(input.value[index]))count++;index++;}input.setSelectionRange(index,index);});
  };
  return <input {...props} data-form-value="rial" ref={node=>{ref.current=node;if(typeof forwarded==='function')forwarded(node);else if(forwarded)forwarded.current=node;}}
    type="text" inputMode="numeric" dir="ltr" maxLength={32} pattern="[0-9]{1,3}(,[0-9]{3})*" value={display} onChange={change} onPaste={event=>{
      event.preventDefault();const input=event.currentTarget;
      // Validate the complete paste before the browser's maxlength can crop it into a different amount.
      input.value=input.value.slice(0,input.selectionStart??0)+event.clipboardData.getData('text')+input.value.slice(input.selectionEnd??input.value.length);
      change({target:input,currentTarget:input} as React.ChangeEvent<HTMLInputElement>);
    }}/>;
});
