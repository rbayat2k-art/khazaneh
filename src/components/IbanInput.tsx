import React,{forwardRef,useEffect,useRef,useState} from 'react';
import {IBAN_ERROR,normalizeIban,bankFieldsError} from '../utils/bank-identifiers';
import {ibanInputProps} from './bank-input';
/** Reject oversized paste before native maxLength can silently truncate it. */
export const IbanInput=forwardRef<HTMLInputElement,React.InputHTMLAttributes<HTMLInputElement>>(function IbanInput({value='',onChange,...props},forwarded){
 const ref=useRef<HTMLInputElement>(null),[blocked,setBlocked]=useState(false);
 useEffect(()=>{setBlocked(false);},[value]);
 useEffect(()=>{ref.current?.setCustomValidity(blocked?IBAN_ERROR:bankFieldsError({iban:String(value)})||'');},[value,blocked]);
 function accept(input:HTMLInputElement,raw:string){const next=normalizeIban(raw);if(next.length>26||!/^I?R?\d*$/.test(next)){setBlocked(true);input.setCustomValidity(IBAN_ERROR);return;}setBlocked(false);input.value=next;input.setCustomValidity(bankFieldsError({iban:next})||'');onChange?.({target:input,currentTarget:input} as React.ChangeEvent<HTMLInputElement>);}
 return <input {...props} {...ibanInputProps} data-form-value="iban" type="text" dir="ltr" value={value} ref={node=>{ref.current=node;if(typeof forwarded==='function')forwarded(node);else if(forwarded)forwarded.current=node;}} onChange={e=>accept(e.currentTarget,e.currentTarget.value)} onPaste={e=>{e.preventDefault();const input=e.currentTarget,current=String(value);accept(input,current.slice(0,input.selectionStart??0)+e.clipboardData.getData('text')+current.slice(input.selectionEnd??current.length));}}/>;
});
