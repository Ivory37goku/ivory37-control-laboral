'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Android packaged web scripts match web release', () => {
  for (const name of ['app.js', 'rates.js', 'calendar.js', 'reports.js', 'pwa.js', 'spotlight.js', 'supabase-sync.js']) {
    assert.equal(read('android-app/app/src/main/assets/' + name), read(name), name + ' differs between Android and web');
  }
});

test('PWA precache includes application scripts', () => {
  const sw = read('sw.js');
  for (const name of ['index.html', 'app.js', 'rates.js', 'calendar.js', 'reports.js', 'supabase-sync.js']) {
    assert.ok(sw.includes("'./" + name + "'"), name + ' missing from offline cache');
  }
});

test('app keeps explicit pause and overnight shift calculation', () => {
  const app = read('app.js');
  assert.match(app, /if \(diff < 0\) diff \+= 1440/);
  assert.match(app, /Math\.max\(0, minutes - pauseMinutes\)/);
  assert.match(app, /descanso_minutos/);
});

test('synchronization retains conflict tracking', () => {
  const sync = read('supabase-sync.js');
  assert.match(sync, /CONFLICT_KEY/);
  assert.match(sync, /conflicts/);
  assert.match(sync, /deleted/);
});

test('PWA updates require explicit user confirmation to protect unsaved edits', () => {
  const pwa = read('pwa.js');
  const schedule = pwa.match(/function scheduleSafeUpdate\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(schedule, 'update scheduling function is present');
  assert.doesNotMatch(schedule[1], /postMessage/);
  assert.match(pwa, /updateBtn\.addEventListener\('click'/);
  assert.match(pwa, /Guarda y cierra los formularios/);
});
