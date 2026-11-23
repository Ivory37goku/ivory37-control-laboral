'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
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

test('Electron acknowledges a storage migration once, after persisting the marker', () => {
  const handlers = new Map();
  let markerWritten = false;
  const electron = {
    app: {
      setName() {}, setAppUserModelId() {}, setPath() {}, getPath() { return root; },
      getAppPath() { return root; }, commandLine: { getSwitchValue() { return ''; } },
      whenReady() { return { then() {} }; }, on() {}
    },
    ipcMain: { on(name, handle) { handlers.set(name, handle); }, handle() {} }
  };
  vm.runInNewContext(read('desktop/main.cjs'), {
    URL,
    require(name) {
      if (name === 'electron') return electron;
      if (name === 'node:fs') return { mkdirSync() {}, writeFileSync() { markerWritten = true; } };
      return require(name);
    }
  });
  const replies = [];
  const replyTo = (url) => ({
    senderFrame: { url },
    set returnValue(value) { replies.push({ value, markerWritten }); }
  });
  const finish = handlers.get('ivory37:finish-storage-migration');
  finish(replyTo('https://example.invalid/index.html'));
  finish(replyTo(pathToFileURL(path.join(root, 'index.html')).href + '?nativeRestore=1'));
  assert.deepEqual(replies, [
    { value: false, markerWritten: false },
    { value: true, markerWritten: true }
  ]);
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


test('the document blocks injected scripts, remote frames and form exfiltration', () => {
  const html = read('index.html');
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(policy, /script-src 'self';/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  for (const directive of ['object-src', 'frame-src', 'base-uri', 'form-action']) {
    assert.ok(policy.includes(directive + " 'none'"));
  }
  assert.match(policy, /https:\/\/vpdpketyattbmzghujmv\.supabase\.co/);
});


test('desktop permissions deny media and foreign documents while retaining local notifications', () => {
  const context = {
    URL,
    require(name) {
      if (name === 'electron') return {
        app: { setName() {}, setAppUserModelId() {}, setPath() {}, getPath: () => root,
          getAppPath: () => root, commandLine: { getSwitchValue: () => '' },
          whenReady: () => ({ then() {} }), on() {} },
        ipcMain: { on() {}, handle() {} }
      };
      return require(name);
    }
  };
  vm.runInNewContext(read('desktop/main.cjs') + '\nglobalThis.permissionTest = canUsePermission;', context);
  const contents = { getURL: () => pathToFileURL(path.join(root, 'index.html')).href };
  assert.equal(context.permissionTest(contents, 'notifications', { isMainFrame: true }, contents), true);
  for (const permission of ['media', 'geolocation', 'clipboard-read', 'display-capture', 'unknown']) {
    assert.equal(context.permissionTest(contents, permission, {}, contents), false);
  }
  assert.equal(context.permissionTest(contents, 'notifications', { requestingUrl: 'https://example.invalid/' }, contents), false);
  assert.equal(context.permissionTest(contents, 'notifications', { isMainFrame: false }, contents), false);
  assert.equal(context.permissionTest(null, 'notifications', {}, contents), false);
});
