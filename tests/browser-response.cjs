const assert=require('node:assert/strict');
// The real UI consumes delta-v1 internally. Playwright's network response.json()
// does not run that adapter. Read committed state with the exact POST session;
// callers must still prove that the actual UI applied its own response.
exports.readCommittedResponse=async response=>{
 const body=await response.json();if(!body.stateDelta&&!body.stateSnapshot)return body;
 assert.ok(response.status()>=200&&response.status()<300,'a failed POST cannot be replaced by a successful query');assert.equal(response.request().method(),'POST');
 const url=new URL(response.url());assert.equal(url.origin,'http://127.0.0.1:4322');
 const authorization=response.request().headers().authorization;assert.ok(authorization?.startsWith('Bearer '),'real app session required');
 const queried=await fetch(url.origin+'/api/state',{headers:{Authorization:authorization,Connection:'close'},signal:AbortSignal.timeout(5000)});assert.equal(queried.status,200,'current authorization must admit the follow-up query');
 const state=await queried.json();assert.ok(Array.isArray(state.users)&&Array.isArray(state.paymentRequests));return {...body,state};
};
