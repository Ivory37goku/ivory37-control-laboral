'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const workHours = require('../work-hours.js');

test('split and overnight shifts count gaps once and reject overlapping intervals', () => {
  const minutes = workHours.interruptionMinutes;
  assert.equal(minutes('08:00', '20:00', [{ desde: '12:00', hasta: '16:00' }]), 240);
  assert.equal(minutes('22:00', '06:00', [{ desde: '23:45', hasta: '00:15' }, { desde: '03:00', hasta: '03:15' }]), 45);
  assert.equal(minutes('08:00', '20:00', [{ desde: '12:00', hasta: '16:00' }, { desde: '15:00', hasta: '17:00' }]), null);
  assert.equal(minutes('22:00', '06:00', [{ desde: '05:00', hasta: '07:00' }]), null);
});

test('normal shift duration and pause deduction are exact', () => {
  assert.equal(workHours.minutesBetween('08:00', '16:00'), 480);
  assert.equal(workHours.hoursBetween('08:00', '16:00'), 8);
  assert.equal(workHours.netHoursBetween('08:00', '16:00', 30), 7.5);
});

test('overnight shifts cross midnight without losing a minute', () => {
  assert.equal(workHours.minutesBetween('22:00', '06:00'), 480);
  assert.equal(workHours.netHoursBetween('22:00', '06:00', 45), 7.25);
  assert.equal(workHours.minutesBetween('23:59', '00:00'), 1);
  assert.equal(workHours.hoursBetween('23:59', '00:00'), 0.02);
});

test('invalid times and invalid pauses are rejected', () => {
  assert.equal(workHours.toMinutes('24:00'), null);
  assert.equal(workHours.minutesBetween('08:00', '8:00'), null);
  assert.equal(workHours.hoursBetween('', '16:00'), null);
  assert.equal(workHours.netHoursBetween('08:00', '16:00', -1), null);
  assert.equal(workHours.netHoursBetween('08:00', '16:00', NaN), null);
});

test('zero-length shifts and pauses at the full shift duration remain zero', () => {
  assert.equal(workHours.minutesBetween('08:00', '08:00'), 0);
  assert.equal(workHours.netHoursBetween('08:00', '08:00', 0), 0);
  assert.equal(workHours.netHoursBetween('08:00', '16:00', 480), 0);
});
