'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveColor } = require('../theme-tools.js');

test('a selected brand color is preserved and supplies matching RGB channels', () => {
  assert.deepEqual(resolveColor('#7C3AED'), { color: '#7c3aed', rgb: [124, 58, 237], contrast: '#ffffff' });
});

test('brand buttons choose readable text for both light and dark colors', () => {
  assert.equal(resolveColor('#ffee00').contrast, '#06120a');
  assert.equal(resolveColor('#1d4ed8').contrast, '#ffffff');
});

test('invalid color values fall back to the app default', () => {
  assert.deepEqual(resolveColor('not-a-color'), { color: '#a6d94a', rgb: [166, 217, 74], contrast: '#06120a' });
});
