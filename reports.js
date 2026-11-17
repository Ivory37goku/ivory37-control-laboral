/* Serialización de informes reutilizable por PWA, Android y escritorio. */
(function () {
  'use strict';
  function csvCell(value) {
    var text = String(value == null ? '' : value);
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function toCsv(rows) { return '\uFEFF' + rows.map(function (row) { return row.map(csvCell).join(';'); }).join('\r\n'); }
  window.IVORY37Reports = Object.freeze({ csvCell: csvCell, toCsv: toCsv });
})();
