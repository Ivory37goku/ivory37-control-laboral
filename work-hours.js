(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IVORY37WorkHours = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function toMinutes(value) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value == null ? '' : value).trim());
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function minutesBetween(start, end) {
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    if (startMinutes == null || endMinutes == null) return null;
    const minutes = endMinutes - startMinutes;
    return minutes < 0 ? minutes + 1440 : minutes;
  }

  function round2(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }

  function hoursBetween(start, end) {
    const minutes = minutesBetween(start, end);
    return minutes == null ? null : round2(minutes / 60);
  }

  function netHoursBetween(start, end, pauseMinutes) {
    const minutes = minutesBetween(start, end);
    const pause = Number(pauseMinutes);
    if (minutes == null || !Number.isFinite(pause) || pause < 0) return null;
    return round2(Math.max(0, minutes - pause) / 60);
  }

  return { toMinutes, minutesBetween, hoursBetween, netHoursBetween };
});
