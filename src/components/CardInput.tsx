import React,{forwardRef,useEffect,useRef,useState} from 'react';
import {CARD_ERROR,normalizeCard,bankFieldsError} from '../utils/bank-identifiers';

export const CardInput=forwardRef<HTMLInputElement,React.InputHTMLAttributes<HTMLInputElement>>(function CardInput({onChange,value='',...props},forwarded){
  const ref=useRef<HTMLInputElement>(null),[blocked,setBlocked]=useState(false);
  useEffect(()=>{setBlocked(false);},[value]);
  useEffect(()=>{ref.current?.setCustomValidity(blocked?CARD_ERROR:bankFieldsError({cardNumber:String(value)})||'');},[value,blocked]);
  function change(event:React.ChangeEvent<HTMLInputElement>){
    if(normalizeCard(event.target.value).length>16){setBlocked(true);event.target.setCustomValidity(CARD_ERROR);return;}
    setBlocked(false);event.target.value=normalizeCard(event.target.value);event.target.setCustomValidity(bankFieldsError({cardNumber:event.target.value})||'');onChange?.(event);
  }
  return <input {...props} ref={node=>{ref.current=node;if(typeof forwarded==='function')forwarded(node);else if(forwarded)forwarded.current=node;}}
    data-form-value="card" title={props.title||CARD_ERROR} type="text" dir="ltr" inputMode="numeric" pattern="[0-9]{4}(-?[0-9]{4}){3}" maxLength={19} value={value} onChange={change}
    onPaste={event=>{
      event.preventDefault();const input=event.currentTarget,text=event.clipboardData.getData('text');
      const next=normalizeCard(String(value).slice(0,input.selectionStart??0)+text+String(value).slice(input.selectionEnd??String(value).length));
      if(next.length>16||!/^[0-9]*$/.test(next)){setBlocked(true);input.setCustomValidity(CARD_ERROR);input.reportValidity();return;}
      setBlocked(false);input.value=next;input.setCustomValidity(bankFieldsError({cardNumber:next})||'');onChange?.({target:input,currentTarget:input} as React.ChangeEvent<HTMLInputElement>);
    }}/>;
});
