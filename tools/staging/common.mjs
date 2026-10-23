import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

export const sha = value => crypto.createHash('sha256').update(value).digest('hex');
export function readConfig(root) {
  root = fs.realpathSync(root);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'staging.json'), 'utf8'));
  assert.equal(config.kind, 'shahrah-private-staging');
  assert.equal(config.syntheticOnly, true);
  assert.equal(fs.realpathSync(config.root), root);
  assert.match(config.manifestSha256, /^[a-f0-9]{64}$/);
  for (const port of [config.port, config.backendPort]) assert.ok(Number.isInteger(port) && port > 1024 && port < 65536);
  assert.notEqual(config.port, config.backendPort);
  const release = path.join(root, 'releases', config.manifestSha256);
  const data = path.join(root, 'data');
  assert.equal(fs.realpathSync(release), release);
  assert.equal(fs.realpathSync(data), data);
  const bytes = fs.readFileSync(path.join(release, 'release-manifest.json'));
  assert.equal(sha(bytes), config.manifestSha256);
  const manifest = JSON.parse(bytes);
  for (const file of manifest.files) {
    assert.ok(!path.isAbsolute(file.path) && !file.path.split(/[\\/]/).includes('..'));
    const full = path.join(release, file.path);
    assert.equal(fs.realpathSync(full), full);
    assert.equal(sha(fs.readFileSync(full)), file.sha256);
  }
  assert.ok(fs.existsSync(path.join(data, 'treasury.sqlite')), 'Missing synthetic SQLite; no automatic reseed');
  return { ...config, root, release, data };
}
export function childEnvironment(root) {
  const file=path.join(root,'staging.json'),real=fs.existsSync(file)&&JSON.parse(fs.readFileSync(file,'utf8')).cardinfoRealTest===true;
  const env = {};
  for (const name of ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA']) if (process.env[name]) env[name] = process.env[name];
  return { ...env, NODE_ENV: 'production', SHAHRAH_STAGING_ROOT: root,
    TREASURY_STORAGE_MODE: 'sqlite', TREASURY_DATA_DIR: path.join(root, 'data'), DISABLE_EXTERNAL_INTEGRATIONS: 'true', TREASURY_BANK_INQUIRY_MOCK:real?'false':'true',
    ...(real?{SHAHRAH_STAGING_CARDINFO_REAL:'true',TREASURY_CARDINFO_VAULT_DIR:path.join(root,'secrets')}:{}) };
}
