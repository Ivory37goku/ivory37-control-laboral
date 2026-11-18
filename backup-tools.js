(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IVORY37BackupTools = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function create(data, backupDate) {
    const backup = JSON.parse(JSON.stringify(data));
    if (!Array.isArray(backup.ajustes)) backup.ajustes = [];
    const row = backup.ajustes.find((item) => item && item.clave === 'last_backup');
    if (row) row.valor = String(backupDate);
    else backup.ajustes.push({ clave: 'last_backup', valor: String(backupDate) });
    return backup;
  }

  function hasInvalidDates(input, isDateKey) {
    const obj = input && typeof input === 'object' ? input : {};
    return ['jornadas', 'viajes', 'pagos', 'ausencias'].some((key) => Array.isArray(obj[key])
      && obj[key].some((item) => item && item.fecha && !isDateKey(String(item.fecha).slice(0, 10))));
  }

  function parse(raw, isDateKey) {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.jornadas)) throw new Error('Formato');
    if (parsed.jornadas.length > 50000) throw new Error('Demasiados');
    if (hasInvalidDates(parsed, isDateKey)) throw new Error('Fecha');
    return parsed;
  }

  return { create, parse, hasInvalidDates };
});
