import {CARD_ERROR,IBAN_ERROR} from '../utils/bank-identifiers';
// Native constraint validation complements, never replaces, server validation.
export const cardInputProps={inputMode:'numeric' as const,pattern:'[0-9]{4}(-?[0-9]{4}){3}',title:CARD_ERROR,maxLength:128};
export const ibanInputProps={inputMode:'text' as const,pattern:'IR[0-9]{24}',title:IBAN_ERROR,maxLength:128};
