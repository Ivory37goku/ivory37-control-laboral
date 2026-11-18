'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize } = require('../overtime-tools.js');

const records = [
  { fecha: '2026-10-02', estado: 'confirmado', horas_extra: 1.25, pagado_extras: false },
  { fecha: '2026-10-18', estado: 'confirmado', horas_extra: 2, pagado_extras: true },
  { fecha: '2026-10-20', estado: 'provisional', horas_extra: 8, pagado_extras: false },
  { fecha: '2026-11-01', estado: 'confirmado', horas_extra: 4, pagado_extras: false }
];

test('monthly overtime separates confirmed, paid and pending hours at historical rates', () => {
  const month = summarize(records, '2026-10', item => item.fecha < '2026-10-15' ? 10 : 12);
  assert.deepEqual(month, {
    extraHours: 3.25, extraValue: 36.5,
    paidExtraHours: 2, paidExtraValue: 24,
    pendingExtraHours: 1.25, pendingExtraValue: 12.5
  });
});

test('each month is independent and months without confirmed extras return zeroes', () => {
  assert.deepEqual(summarize(records, '2026-11', () => 15), {
    extraHours: 4, extraValue: 60,
    paidExtraHours: 0, paidExtraValue: 0,
    pendingExtraHours: 4, pendingExtraValue: 60
  });
  assert.deepEqual(summarize(records, '2026-12', () => 15), {
    extraHours: 0, extraValue: 0,
    paidExtraHours: 0, paidExtraValue: 0,
    pendingExtraHours: 0, pendingExtraValue: 0
  });
});
