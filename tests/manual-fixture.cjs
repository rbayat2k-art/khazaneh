// Explicit synthetic positive fixture only; supplied blank/invalid fields are retained.
const crypto=require('node:crypto');
exports.manualFixture=body=>({idempotencyKey:'pay-idem-'+crypto.randomUUID(),description:'TEST real uploaded receipt',orderedBy:'TEST outside manager',bankRefNumber:'TEST-'+crypto.randomUUID(),receiptFileName:'TEST-bank.png',receiptFileUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=',...body});
