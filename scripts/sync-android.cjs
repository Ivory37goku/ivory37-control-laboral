'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'android-app/app/src/main/assets');
const files = require('../package.json').build.files.filter(file => !file.startsWith('desktop/'));
for (const file of files) {
  const source = path.resolve(root, file);
  const target = path.resolve(destination, file);
  if (!source.startsWith(root + path.sep) || !target.startsWith(destination + path.sep)) throw new Error('Invalid asset path: ' + file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
console.log('Android assets synchronized: ' + files.length);
