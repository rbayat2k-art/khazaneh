import test from 'node:test';import assert from 'node:assert/strict';
import {getDefaultPermissionsForRole,normalizeRolePermissionSet,type RolePermissionSet} from '../src/types/treasury';
import {PERMISSION_GROUPS,PERMISSION_CONTROLS,KNOWN_PERMISSION_KEYS,MENU_ENTRIES,MENU_TITLES,DISPLAY_FALLBACKS,permissionValue,permissionCount,permissionPreset,permissionPatchError,menuVisible,visibleMenus,withNavigationPermissions,effectiveNavigationPermissions,supervisorCompanyAllowed} from '../src/utils/permission-registry';

test('all main menus have their exact own card; each navigation entry and active permission has one control',()=>{
 assert.deepEqual(PERMISSION_GROUPS.map(g=>g.title),Object.values(MENU_TITLES));
 const keys=PERMISSION_CONTROLS.map(i=>i.key);assert.equal(new Set(keys).size,keys.length);assert.equal(keys.length,65);assert.equal(MENU_ENTRIES.length,40);
 for(const entry of MENU_ENTRIES)assert.ok(keys.includes(entry.permission),entry.id);
 for(const key of Object.keys(getDefaultPermissionsForRole('ADMIN')))assert.ok(KNOWN_PERMISSION_KEYS.has(key),key);
});
test('all/minimum presets cover inquiry, resubmission and operations without syncing retained legacy values',()=>{
 const initial={...getDefaultPermissionsForRole('REQUESTER'),canAccessApproverWorkspace:false,canAccessAccountingWorkspace:true};
 const before=JSON.stringify(initial),all=permissionPreset(initial,true),min=permissionPreset(all,false);
 assert.equal(permissionCount(all),65);for(const key of ['canManageBankInquiry','canInquireBankDetails','canConfirmBankOwner','canResubmitRevision','canSubmitSinglePayment','canManageBankAccounts','canCreateManualPayment','canCloseDailyCover','canViewReceiptArchive'] as const)assert.equal(all[key],true,key);
 assert.equal(permissionCount(min),4);assert.equal(min.canShowTrackingAll,true);assert.equal(min.canViewRequests,true);assert.equal(min.canViewAttachments,true);assert.equal(min.canAccessSettings,true);assert.equal(min.canExecutePayment,false);assert.equal(min.canSubmitSinglePayment,false);assert.equal(min.canCreateRequest,false);
 assert.equal(all.canAccessApproverWorkspace,false);assert.equal(all.canAccessAccountingWorkspace,true);assert.equal(JSON.stringify(initial),before);
});
test('all legacy default roles inherit identical menu availability without storing new flags',()=>{
 for(const role of ['ADMIN','REQUESTER','APPROVER','ACCOUNTING','TREASURY']){const p=normalizeRolePermissionSet(getDefaultPermissionsForRole(role),role),before=JSON.stringify(p),resolved=withNavigationPermissions(p);
  for(const key of Object.keys(DISPLAY_FALLBACKS) as (keyof typeof DISPLAY_FALLBACKS)[])assert.equal(resolved[key],permissionValue(p,key));
  assert.equal(JSON.stringify(p),before);assert.equal(Object.keys(p).some(k=>k.startsWith('canShow')),false);
  assert.equal(menuVisible(p,'FORM_PAYMENT_SINGLE'),p.canCreatePaymentSingle);
  assert.equal(menuVisible(p,'TRACK_ALL'),Boolean(p.canAccessRequesterSection||p.canViewRequests!==false));
 }
});
test('submenu display revocation changes only navigation, never grants or revokes financial actions',()=>{
 const p=normalizeRolePermissionSet(getDefaultPermissionsForRole('TREASURY'),'TREASURY'),next={...p,canShowExternalOrder:false,canShowTreasuryInquiry:false,canInquireBankDetails:true};
 assert.equal(menuVisible(next,'TREASURY_EXTERNAL_ORDER'),false);assert.equal(menuVisible(next,'TREASURY_BANK_INQUIRY'),false);assert.equal(next.canExecutePayment,p.canExecutePayment);assert.equal(next.canCreateManualPayment,p.canCreateManualPayment);
 const approver={...normalizeRolePermissionSet(getDefaultPermissionsForRole('APPROVER'),'APPROVER'),canShowApproverPending:false};assert.equal(menuVisible(approver,'APPROVER_PENDING'),false);assert.ok(visibleMenus(approver,'APPROVER').length>0);assert.equal(approver.canApprove,true);
 assert.equal(menuVisible({...approver,canAccessApproverCartable:false},'APPROVER_ALL_MY_RECORDS'),false);assert.equal(menuVisible(p,'UNDECLARED'),false);
});
test('display and submission are intentionally separate controls with accurate descriptions and no hidden sync',()=>{
 for(const [display,action] of [['canCreatePaymentSingle','canSubmitSinglePayment'],['canCreatePaymentBatch','canSubmitBatchPayment'],['canCreateAdvanceSingle','canSubmitSingleAdvance'],['canCreateAdvanceBatch','canSubmitBatchAdvance']] as const){
  const p=normalizeRolePermissionSet({...getDefaultPermissionsForRole('REQUESTER'),[display]:false,[action]:true},'REQUESTER');assert.equal(p[display],false);assert.equal(p[action],true);assert.equal(PERMISSION_CONTROLS.find(i=>i.key===display)?.kind,'DISPLAY');assert.equal(PERMISSION_CONTROLS.find(i=>i.key===action)?.kind,'ACTION');
 }
});
test('server permission patch schema rejects truthy strings, arrays, unknown fields and malformed values',()=>{
 for(const v of [null,[],true,1,{canApprove:'false'},{canApprove:1},{canApprove:null},{UNDECLARED:true}])assert.ok(permissionPatchError(v));
 for(const key of KNOWN_PERMISSION_KEYS)for(const v of [true,false])assert.equal(permissionPatchError({[key]:v}),undefined);
 assert.equal(permissionPatchError({}),undefined);
 assert.equal(permissionPatchError({OLD_CLIENT_FLAG:false},{OLD_CLIENT_FLAG:false} as any),undefined);
 assert.ok(permissionPatchError({OLD_CLIENT_FLAG:true},{OLD_CLIENT_FLAG:false} as any));
});
test('supervisor company eligibility uses the union and stable id/name, not their own company alone',()=>{
 const u:any={id:'TEST',role:'APPROVER',additionalRoles:['ACCOUNTING'],company:'OTHER'};const roles=[{role:'APPROVER',allowedCompanies:['C1']},{role:'ACCOUNTING',allowedCompanies:['TEST TWO']}],companies=[{id:'C1',name:'TEST ONE'},{id:'C2',name:'TEST TWO'}];
 assert.ok(supervisorCompanyAllowed(u,'TEST ONE',roles,companies));assert.ok(supervisorCompanyAllowed(u,'C2',roles,companies));assert.equal(supervisorCompanyAllowed(u,'OTHER',roles,companies),false);assert.equal(supervisorCompanyAllowed(u,'TEST ONE',[],companies),false);
 assert.ok(supervisorCompanyAllowed({...u,role:'ADMIN'},'ANY',[],[]));
 assert.ok(supervisorCompanyAllowed({...u,supervisorAllowedCompanies:['TEST ONE','C1']},'TEST ONE',[],companies));
 assert.equal(supervisorCompanyAllowed({...u,supervisorAllowedCompanies:[]},'TEST ONE',roles,companies),false);
});
test('missing navigation flags inherit final effective legacy rights including cross-role AND, while explicit false and personal overrides are honored',()=>{
 const a={...getDefaultPermissionsForRole('REQUESTER'),canAccessTreasuryManualPayment:true,canCreateRequest:true,canSubmitSinglePayment:false},b={...a,canAccessTreasuryManualPayment:false,canCreateRequest:false,canSubmitSinglePayment:true};
 const combined={...a,canAccessTreasuryManualPayment:true,canCreateRequest:true,canSubmitSinglePayment:true};assert.equal(effectiveNavigationPermissions(combined,[a,b]).canShowExternalOrder,true);
 assert.equal(effectiveNavigationPermissions(combined,[{...a,canShowExternalOrder:false},{...b,canShowExternalOrder:false}]).canShowExternalOrder,false);
 assert.equal(effectiveNavigationPermissions(combined,[a,b],{canShowExternalOrder:false}).canShowExternalOrder,false);
 assert.equal(effectiveNavigationPermissions({...combined,canViewRequests:false,canAccessRequesterSection:false},[a,b]).canShowTrackingAll,false);
});

test('an unrelated supplementary role cannot resurrect an explicitly hidden reviewer submenu',()=>{
 const approver={...getDefaultPermissionsForRole('APPROVER'),canShowApproverPending:false},requester=getDefaultPermissionsForRole('REQUESTER'),combined={...requester,...approver};
 assert.equal(effectiveNavigationPermissions(combined,[approver,requester]).canShowApproverPending,false);
 assert.equal(effectiveNavigationPermissions(combined,[approver,getDefaultPermissionsForRole('APPROVER')]).canShowApproverPending,true);
});
