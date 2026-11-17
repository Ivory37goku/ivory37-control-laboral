'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'rates.js'), 'utf8'), context, { filename: 'rates.js' });
const rates = context.window.IVORY37Rates;
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

test('invalid rates are rejected and duplicate dates use the last entry', () => {
  const result = rates.normalize([
    { desde: '2026-01-01', normal: 10, extra: 15, jornada: 8 },
    { desde: '2026-01-01', normal: 12, extra: 18, jornada: 8 },
    { desde: '2026-02-01', normal: -1, extra: 18, jornada: 8 },
    { desde: 'invalid', normal: 15, extra: 20, jornada: 8 }
  ], validDate);
  assert.equal(result.length, 1);
  assert.equal(result[0].normal, 12);
});

test('historical rate applies according to work date', () => {
  const history = [
    { desde: '2026-01-01', normal: 10, extra: 15, jornada: 8 },
    { desde: '2026-07-01', normal: 12, extra: 20, jornada: 7.5 }
  ];
  const fallback = { normal: 9, extra: 13, jornada: 8 };
  assert.equal(rates.atDate(history, '2026-06-30', 'extra', fallback), 15);
  assert.equal(rates.atDate(history, '2026-07-01', 'extra', fallback), 20);
  assert.equal(rates.atDate(history, '2025-12-31', 'extra', fallback), 13);
});

test('upsert replaces an existing date without duplicating it', () => {
  const fallback = { normal: 10, extra: 15, jornada: 8 };
  const history = rates.upsert([], { desde: '2026-01-01', normal: 12, extra: 18, jornada: 8 }, fallback);
  const updated = rates.upsert(history, { desde: '2026-01-01', normal: 13, extra: 19, jornada: 8 }, fallback);
  assert.equal(updated.filter(row => row.desde === '2026-01-01').length, 1);
  assert.equal(rates.active(updated, '2026-01-02', fallback).extra, 19);
});

test('fractional rates are rounded to cents', () => {
  const result = rates.normalize([{ desde: '2026-01-01', normal: 12.345, extra: 20.125, jornada: 7.5 }], validDate);
  assert.equal(result[0].normal, 12.35);
  assert.equal(result[0].extra, 20.13);
});

test('historical rates reject impossible dates and malformed updates', () => {
  const fallback = { normal: 10, extra: 15, jornada: 8 };
  const invalid = rates.normalize([
    { desde: '2026-02-30', normal: 10, extra: 15, jornada: 8 },
    { desde: '2025-02-29', normal: 10, extra: 15, jornada: 8 },
    { desde: '2024-02-29', normal: 11, extra: 16, jornada: 8 }
  ], () => true);
  assert.equal(invalid.length, 1);
  assert.equal(invalid[0].desde, '2024-02-29');
  const initial = rates.upsert([], { desde: '2026-01-01', normal: 12, extra: 18, jornada: 8 }, fallback);
  const unchanged = rates.upsert(initial, { desde: '2026-02-30', normal: 100, extra: 100, jornada: 8 }, fallback);
  assert.equal(rates.atDate(unchanged, '2026-12-01', 'normal', fallback), 12);
});

test('invalid tariff updates do not create phantom default versions', () => {
  const fallback = { normal: 10, extra: 15, jornada: 8 };
  const invalid = rates.upsert([], { desde: '2026-02-30', normal: 11, extra: 16, jornada: 8 }, fallback);
  assert.equal(invalid.length, 0);
  const missing = rates.upsert([], null, fallback);
  assert.equal(missing.length, 0);
  const noFallback = rates.upsert([], { desde: '2026-01-01', normal: 11, extra: 16, jornada: 8 }, {});
  assert.equal(noFallback.length, 1);
  assert.equal(noFallback[0].desde, '2026-01-01');
});
