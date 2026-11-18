'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Electron isolates web content from Node and enables sandbox', () => {
  const main = read('desktop/main.cjs');
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /webSecurity:\s*true/);
  assert.match(main, /allowRunningInsecureContent:\s*false/);
});

test('Electron restricts file export to approved types and size', () => {
  const main = read('desktop/main.cjs');
  assert.match(main, /isTrustedAppDocument\(event\.senderFrame\?\.url/);
  assert.match(main, /application\/json/);
  assert.match(main, /text\/csv/);
  assert.match(main, /12 \* 1024 \* 1024/);
});

test('Electron desktop bridge does not expose raw ipcRenderer', () => {
  const preload = read('desktop/preload.cjs');
  assert.match(preload, /contextBridge\.exposeInMainWorld/);
  assert.doesNotMatch(preload, /ipcRenderer:\s*ipcRenderer/);
});

test('Android disables system backup and cleartext traffic', () => {
  const manifest = read('android-app/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:allowBackup='false'/);
  assert.match(manifest, /android:usesCleartextTraffic='false'/);
});

test('Supabase sync tables are owner-scoped and the event helper is not an RPC', () => {
  const sql = read('supabase/setup.sql');
  for (const table of ['ivory37_sync', 'gestion_clientes']) {
    const policies = sql.match(new RegExp('create policy[^;]+on public\\.' + table + '[\\s\\S]*?;', 'gi')) || [];
    assert.match(sql, new RegExp('alter table public\\.' + table + ' enable row level security', 'i'));
    assert.ok(policies.some(policy => /for select to authenticated using \(\(select auth\.uid\(\)\) = user_id\)/i.test(policy)));
    assert.ok(policies.some(policy => /for insert to authenticated with check \(\(select auth\.uid\(\)\) = user_id\)/i.test(policy)));
    assert.ok(policies.some(policy => /for update to authenticated using \(\(select auth\.uid\(\)\) = user_id\)[\s\S]*?with check \(\(select auth\.uid\(\)\) = user_id\)/i.test(policy)));
  }
  assert.match(sql, /revoke execute on function public\.rls_auto_enable\(\) from public, anon, authenticated/i);
});
