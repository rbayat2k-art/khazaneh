import {test} from 'node:test';import assert from 'node:assert/strict';import {inlineDocumentError} from '../src/server/documents';
test('user supplied SVG cannot bypass active-content rules using XML namespaces or CSS escapes',()=>{
 for(const text of ['<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg"><s:script>alert(1)</s:script></svg>','<svg xmlns="http://www.w3.org/2000/svg"><style>@im\\port "https://invalid.example/x";</style></svg>'])assert.ok(inlineDocumentError('data:image/svg+xml;base64,'+Buffer.from(text).toString('base64')));
});
test('bounded raster and PDF MIME labels remain admitted; remote URLs and disallowed MIME labels are not',()=>{
 for(const type of ['image/png','image/jpeg','image/webp','image/gif','application/pdf'])assert.equal(inlineDocumentError('data:'+type+';base64,VEVTVA=='),null);
 for(const value of ['https://invalid.example/a.png','javascript:alert(1)','data:text/html;base64,VEVTVA==','data:image/png;base64,@@@','data:image/png;base64,'])assert.ok(inlineDocumentError(value));
});
