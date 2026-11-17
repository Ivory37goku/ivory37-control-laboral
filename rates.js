/* Reglas puras para el historial de tarifas. */
(function () {
  'use strict';

  function round2(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }

  function validDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var year = Number(value.slice(0, 4));
    var month = Number(value.slice(5, 7));
    var day = Number(value.slice(8, 10));
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= days[month - 1];
  }

  function normalize(value, isDateKey) {
    var parsed = value;
    if (typeof value === 'string') { try { parsed = JSON.parse(value); } catch (_) { parsed = []; } }
    if (!Array.isArray(parsed)) return [];
    var byDate = new Map();
    parsed.forEach(function (item) {
      if (!item || !validDateKey(item.desde) || (typeof isDateKey === 'function' && !isDateKey(item.desde))) return;
      var normal = Number(item.normal); var extra = Number(item.extra); var jornada = Number(item.jornada);
      if (![normal, extra, jornada].every(Number.isFinite) || normal < 0 || extra < 0 || jornada < 1 || jornada > 16) return;
      byDate.set(item.desde, { desde: item.desde, normal: round2(normal), extra: round2(extra), jornada: round2(jornada) });
    });
    return Array.from(byDate.values()).sort(function (a, b) { return a.desde.localeCompare(b.desde); });
  }

  function atDate(history, date, kind, fallback) {
    var selected = null;
    normalize(history, validDateKey).forEach(function (item) { if (item.desde <= date) selected = item; });
    return selected ? selected[kind] : Number(fallback[kind]) || 0;
  }

  function upsert(history, version, fallback) {
    var rows = normalize(history, validDateKey);
    if (!version || !normalize([version], validDateKey).length) return rows;
    if (!rows.length) {
      var initial = normalize([{ desde: '1970-01-01', normal: fallback && fallback.normal, extra: fallback && fallback.extra, jornada: fallback && fallback.jornada }], validDateKey);
      rows = initial;
    }
    rows = rows.filter(function (item) { return item.desde !== version.desde; });
    rows.push({ desde: version.desde, normal: round2(version.normal), extra: round2(version.extra), jornada: round2(version.jornada) });
    return rows.sort(function (a, b) { return a.desde.localeCompare(b.desde); });
  }

  function active(history, date, fallback) {
    var selected = null;
    normalize(history, validDateKey).forEach(function (item) { if (item.desde <= date) selected = item; });
    return selected || { normal: Number(fallback.normal) || 0, extra: Number(fallback.extra) || 0, jornada: Number(fallback.jornada) || 0 };
  }

  window.IVORY37Rates = Object.freeze({ normalize: normalize, atDate: atDate, upsert: upsert, active: active });
})();
