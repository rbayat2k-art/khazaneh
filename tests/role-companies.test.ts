import test from 'node:test';import assert from 'node:assert/strict';
import {companySelected,toggleRoleCompany,roleCompaniesError} from '../src/utils/role-companies';
const companies=[{id:'A',name:'TEST A'},{id:'B',name:'TEST B'}];
test('role company checkbox resolves legacy names and stable IDs without touching other grants',()=>{
 const values=['TEST A','A','LEGACY','B'];assert.ok(companySelected(values,companies[0]));assert.deepEqual(toggleRoleCompany(values,companies[0],false),['LEGACY','B']);assert.deepEqual(values,['TEST A','A','LEGACY','B']);assert.deepEqual(toggleRoleCompany(['LEGACY'],companies[0],true),['LEGACY','A']);assert.equal(toggleRoleCompany(values,companies[0],true),values);
 const spaced=[' TEST A ',' A ',' OLD '];assert.ok(companySelected(spaced,companies[0]));assert.deepEqual(toggleRoleCompany(spaced,companies[0],false),[' OLD ']);assert.equal(toggleRoleCompany(spaced,companies[0],true),spaced);
});
test('role company validation rejects malformed or newly invented grants but retains unknown existing strings',()=>{
 for(const value of [null,'A',{},[null],[2],[''],['   '],['UNKNOWN']])assert.ok(roleCompaniesError(value,[],companies));
 for(const value of [[],['A'],[' TEST B '],['OLD','A']])assert.equal(roleCompaniesError(value,['OLD'],companies),undefined);
});
