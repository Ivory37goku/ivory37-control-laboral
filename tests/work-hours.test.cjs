'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const workHours = require('../work-hours.js');

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
