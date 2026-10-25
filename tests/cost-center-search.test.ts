import {test} from 'node:test';import assert from 'node:assert/strict';import {filterCostCenterOptions} from '../src/utils/cost-center-search';
test('cost center search matches Persian aliases, partial name, zero-prefixed Persian codes and word combinations without changing values',()=>{
 const options=[{label:'TEST مخبری یک — 003011',value:'stored-name'},{label:'TEST مخبری دو — 003012',value:'stable-id'},{label:'TEST انبار — 003013',value:'other'}],before=structuredClone(options);
 assert.deepEqual(filterCostCenterOptions(options,'مخبري'),options.slice(0,2));assert.deepEqual(filterCostCenterOptions(options,'۰۰۳۰۱۲'),[options[1]]);assert.deepEqual(filterCostCenterOptions(options,'مخبری 003011'),[options[0]]);assert.deepEqual(filterCostCenterOptions(options,'انبار'),[options[2]]);assert.deepEqual(filterCostCenterOptions(options,'نام ناموجود'),[]);assert.equal(filterCostCenterOptions(options,'  '),options);assert.deepEqual(options,before);
});
