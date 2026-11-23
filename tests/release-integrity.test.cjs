'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Android packaged web scripts match web release', () => {
  for (const name of JSON.parse(read('package.json')).build.files.filter(name => !name.startsWith('desktop/'))) {
    assert.deepEqual(fs.readFileSync(path.join(root, 'android-app/app/src/main/assets', name)), fs.readFileSync(path.join(root, name)), name + ' differs between Android and web');
  }
  assert.equal(read('android-app/app/src/main/assets/index.html'), read('index.html'), 'Android HTML differs from web');
  assert.equal(read('android-app/app/src/main/assets/overtime-tools.js'), read('overtime-tools.js'));
});

test('Android runs the installed app bundle and migrates hosted data only once', () => {
  const activity = read('android-app/app/src/main/java/com/ivory37/controllaboral/MainActivity.java');
  assert.match(activity, /webView\.loadUrl\(pendingShadowMigration \? LOCAL_URL \+ "\?nativeRestore=1" : LOCAL_URL\)/);
  assert.match(activity, /LOCAL_STORAGE_MIGRATED_KEY/);
  assert.match(activity, /completeLocalStorageMigration/);
  assert.doesNotMatch(activity, /HOSTED_URL|HOSTED_HOST|beginHostedApp/);
  assert.match(read('app.js'), /localStorage\.clear\(\);[\s\S]*bridge\.completeLocalStorageMigration\(\)/);
});

test('PWA precache includes application scripts', () => {
  const sw = read('sw.js');
  for (const name of ['index.html', 'app.js', 'rates.js', 'calendar.js', 'reports.js', 'work-hours.js', 'backup-tools.js', 'theme-tools.js', 'overtime-tools.js', 'supabase-sync.js', 'storage.js', 'privacy.js', 'updates.js']) {
    assert.ok(sw.includes("'./" + name + "'"), name + ' missing from offline cache');
  }
  assert.match(read('index.html'), /chart-month-hours/);
  assert.match(read('app.js'), /fmtHours\(row\.extraHours\)/);
  assert.match(read('app.js'), /class="chart-month-hours">\$\{esc\(fmtHours\(row\.extraHours\)\)\} extra/);
  assert.doesNotMatch(read('app.js'), /filter\(\(row\) => row\.total > 0 \|\| row\.extraHours > 0\)/);
});

test('web, Android, Windows and changelog share the release version', () => {
  const version = JSON.parse(read('package.json')).version;
  assert.equal(JSON.parse(read('package-lock.json')).version, version);
  assert.match(read('index.html'), new RegExp('<meta name="app-version" content="' + version + '">'));
  assert.match(read('app.js'), new RegExp("content \\|\\| '" + version + "'"));
  assert.match(read('android-app/app/build.gradle'), new RegExp("versionName '" + version + "'"));
  assert.match(read('sw.js'), new RegExp("const RELEASE_VERSION = '" + version + "'"));
  assert.match(read('CHANGELOG.md'), new RegExp('## ' + version.replace(/\./g, '\\.') + ' —'));
});

test('app keeps explicit pause and overnight shift calculation', () => {
  const app = read('app.js');
  const workHours = read('work-hours.js');
  assert.match(app, /window\.IVORY37WorkHours/);
  assert.match(workHours, /minutes < 0 \? minutes \+ 1440 : minutes/);
  assert.match(workHours, /Math\.max\(0, minutes - pause\)/);
  assert.match(app, /descanso_minutos/);
});

test('synchronization retains conflict tracking', () => {
  const sync = read('supabase-sync.js');
  assert.match(sync, /CONFLICT_KEY/);
  assert.match(sync, /conflicts/);
  assert.match(sync, /deleted/);
});

test('PWA offers only newer service workers and keeps updates out of active forms', () => {
  const pwa = read('pwa.js');
  const schedule = pwa.match(/function scheduleSafeUpdate\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(schedule, 'update scheduling function is present');
  assert.doesNotMatch(schedule[1], /postMessage/);
  assert.match(schedule[1], /!safeToUpdate\(\)/);
  assert.match(pwa, /type: 'GET_VERSION'/);
  assert.match(pwa, /compareVersions\(version, appVersion\) <= 0/);
  assert.match(pwa, /updateBtn\.addEventListener\('click'/);
  assert.doesNotMatch(pwa, /else window\.location\.reload\(\)/);
});

test('Windows release creates only the installer, never a portable executable', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['dist:win'], 'electron-builder --win nsis --x64');
  assert.equal(pkg.scripts['dist:win:portable'], undefined);
  assert.deepEqual(pkg.build.win.target.map(target => target.target), ['nsis']);

  const workflow = read('.github/workflows/windows-build.yml');
  assert.match(workflow, /npm run dist:win:setup/);
  assert.match(workflow, /control-laboral-windows-setup/);
  assert.doesNotMatch(workflow, /portable/i);

  const desktopReadme = read('desktop/README.md');
  assert.match(desktopReadme, /dist:win:setup/);
  assert.doesNotMatch(desktopReadme, /portable/i);
  assert.match(read('README.md'), /npm run dist:win:setup/);
  assert.doesNotMatch(read('README.md'), /portable/i);
});
