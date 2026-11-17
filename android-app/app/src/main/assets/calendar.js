/* Normalización y reglas de fechas de calendario. */
(function () {
  'use strict';
  var TYPES = ['descanso', 'vacaciones', 'baja', 'festivo', 'otro'];
  var LABELS = { descanso: 'Descanso', vacaciones: 'Vacaciones', baja: 'Baja', festivo: 'Festivo', otro: 'Otra incidencia' };

  function normalize(rows, isDateKey, uid) {
    var byDate = new Map();
    (Array.isArray(rows) ? rows : []).slice().sort(function (a, b) { return String(a && a.id).localeCompare(String(b && b.id)); }).forEach(function (item) {
      if (!item || !item.fecha) return null;
      var fecha = String(item.fecha).slice(0, 10);
      if (!isDateKey(fecha) || TYPES.indexOf(item.tipo) < 0) return;
      var id = item.id == null ? uid() : item.id;
      byDate.set(fecha, { id: id, grupo: String(item.grupo || id), fecha: fecha, tipo: item.tipo, concepto: String(item.concepto || ''), notas: String(item.notas || ''), creado: item.creado || new Date().toISOString() });
    });
    return Array.from(byDate.values()).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  }

  function datesInRange(from, to, parseKey, dateKey, addDays, maxDays) {
    var dates = [];
    for (var date = parseKey(from); dateKey(date) <= to; date = addDays(date, 1)) {
      dates.push(dateKey(date));
      if (dates.length > (maxDays || 366)) return [];
    }
    return dates;
  }

  function hasDate(rows, date) { return (rows || []).some(function (item) { return item.fecha === date; }); }
  function label(type) { return LABELS[type] || 'Incidencia'; }

  window.IVORY37Calendar = Object.freeze({ types: TYPES.slice(), normalize: normalize, datesInRange: datesInRange, hasDate: hasDate, label: label });
})();
