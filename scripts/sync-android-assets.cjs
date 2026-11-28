'use strict';
// Copia los archivos web a la app Android para que nunca queden desincronizados.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'android-app', 'app', 'src', 'main', 'assets');
const files = ['index.html', 'app.js', 'rates.js', 'calendar.js', 'reports.js', 'work-hours.js', 'backup-tools.js', 'theme-tools.js', 'overtime-tools.js', 'pwa.js', 'spotlight.js', 'supabase-config.js', 'supabase-sync.js', 'sw.js', 'manifest.json', 'brand-icon.svg', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'assets/ivory37-logo.jpg', 'vendor/supabase.js', 'vendor/SUPABASE-LICENSE.txt'];
for (const f of files) {
  const to = path.join(dest, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(root, f), to);
}
console.log('Android assets sincronizados:', files.length, 'archivos');
