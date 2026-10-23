// Creates a NEW synthetic environment only; never reads a live DB or real credential.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getDefaultPermissionsForRole } from '../../src/types/treasury.ts';
import { childEnvironment, sha } from './common.mjs';
import {verifyBuildProof} from './build-verified.mjs';

const [rootArg, artifactArg, expected] = process.argv.slice(2);
assert.ok(rootArg && artifactArg && /^[a-f0-9]{64}$/.test(expected || ''), 'Explicit new root, artifact and manifest hash required');
const root = path.resolve(rootArg), artifact = fs.realpathSync(artifactArg);
const allowed = path.resolve('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/private');
assert.equal(path.dirname(root), allowed, 'Use a new environment in the approved private project directory');
assert.match(path.basename(root), /^permanent-staging(?:-[a-z0-9-]+)?$/);
assert.ok(!fs.existsSync(root), 'Existing data must not be replaced');
const bytes = fs.readFileSync(path.join(artifact, 'release-manifest.json')), manifest = JSON.parse(bytes);
assert.equal(sha(bytes), expected);
verifyBuildProof(fileURLToPath(new URL('../../',import.meta.url)),artifact,manifest);
fs.mkdirSync(root);
if (process.platform === 'win32') {
  const account = execFileSync('whoami', [], { encoding: 'utf8', windowsHide: true }).trim();
  execFileSync('icacls', [root, '/inheritance:r', '/grant:r', `${account}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'], { stdio: 'pipe', windowsHide: true });
} else fs.chmodSync(root, 0o700);
const release = path.join(root, 'releases', expected), data = path.join(root, 'data');
fs.mkdirSync(release, { recursive: true }); fs.mkdirSync(data);
for (const file of [...manifest.files, { path: 'release-manifest.json', sha256: expected }]) {
  assert.ok(!path.isAbsolute(file.path) && !file.path.split(/[\\/]/).includes('..'));
  const value = fs.readFileSync(path.join(artifact, file.path)); assert.equal(sha(value), file.sha256);
  const dest = path.join(release, file.path); fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, value, { flag: 'wx', mode: 0o600 });
}
const roles = ['ADMIN', 'REQUESTER', 'APPROVER', 'ACCOUNTING', 'TREASURY'];
const passwords = {}, users = roles.map(role => {
  const id = role.toLowerCase(), password = crypto.randomBytes(18).toString('base64url'), salt = crypto.randomBytes(16).toString('hex');
  passwords[id] = password;
  return { id: `STAGING-${id}`, personnelCode: id, name: `TEST ${role}`, role, company: 'TEST', department: 'TEST',
    isActive: true, phone: '', preferences: {}, mustChangePassword: false, supervisorId: role === 'REQUESTER' ? 'STAGING-approver' : null,
    supervisorName: role === 'REQUESTER' ? 'TEST APPROVER' : null, passwordSalt: salt, passwordHash: crypto.scryptSync(password, salt, 64).toString('hex') };
});
const state = { users, roleConfigs: roles.map(role => ({ role, title: role, description: 'Synthetic Staging', baseTemplateRole: role,
  defaultLandingSection: role === 'ADMIN' ? 'ADMIN_PANEL' : role, accessScope: role === 'REQUESTER' ? 'SELF_ONLY' : role === 'APPROVER' ? 'ASSIGNED_AND_SUBORDINATES' : 'COMPANY_WIDE',
  allowedCompanies: ['TEST'], approvalLimitRial: 1000000000, paymentLimitRial: 1000000000, permissions: getDefaultPermissionsForRole(role) })),
  companies: [], departments: [], costCenters: [], masterDataCodeSequences: {}, companyBankAccounts: [], advanceRequests: [], paymentRequests: [],
  batchPayments: [], manualPayments: [], dailyCovers: [], receiptArchives: [], notifications: [], securityAuditLogs: [], passwordRecoveryRequests: [], sessions: [], smsLogs: [],
  smsConfig: { enabled: false, provider: 'CUSTOM', apiUrl: '', senderNumber: '', events: {} } };
const gatePassword = crypto.randomBytes(24).toString('base64url');
const config = { kind: 'shahrah-private-staging', syntheticOnly: true, root, manifestSha256: expected,
  port: 55120, backendPort: 55121, gateHash: sha(gatePassword), controlNonce: crypto.randomBytes(24).toString('hex') };
fs.writeFileSync(path.join(root, 'staging.json'), JSON.stringify(config, null, 2), { flag: 'wx', mode: 0o600 });
const seed = path.join(root, 'synthetic-seed.json'); fs.writeFileSync(seed, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
const guard = pathToFileURL(fileURLToPath(new URL('./outbound-guard.mjs', import.meta.url))).href;
execFileSync(process.execPath, ['--import', guard, path.join(release, 'storage-cli.cjs'), 'import', seed, path.join(data, 'treasury.sqlite')],
  { cwd: release, env: childEnvironment(root), stdio: 'pipe', windowsHide: true, timeout: 15000 });
fs.writeFileSync(path.join(root, 'ACCESS.txt'), `STAGING ONLY — مصنوعی؛ از داده واقعی استفاده نکنید.\nURL: http://127.0.0.1:${config.port}/\nرمز دروازه خصوصی: ${gatePassword}\n\nورود واقعی برنامه (حساب‌های صرفاً آزمایشی):\n${Object.entries(passwords).map(([u,p])=>u+' : '+p).join('\n')}\n\nهیچ رمز یا داده‌ای از Production کپی نشده است.\n`, { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ status: 'PASS', root, manifestSha256: expected, syntheticUsers: users.length, privateAccessFile: path.join(root, 'ACCESS.txt'), productionRead: false }));
