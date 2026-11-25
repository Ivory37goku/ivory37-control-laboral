(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IVORY37Overtime = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function round2(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }

  function billableHours(row) {
    return Math.max(0, Number(row.horas_extra) - Math.max(0, Number(row.horas_compensadas) || 0));
  }

  function summarize(records, month, rateFor) {
    const rows = (Array.isArray(records) ? records : []).filter((item) => item
      && item.estado === 'confirmado'
      && String(item.fecha || '').slice(0, 7) === String(month)
      && Number.isFinite(Number(item.horas_extra))
      && Number(item.horas_extra) > 0);
    const paid = rows.filter((item) => Boolean(item.pagado_extras));
    const pending = rows.filter((item) => !item.pagado_extras);
    const sumHours = (items, getHours = billableHours) => round2(items.reduce((sum, item) => sum + getHours(item), 0));
    const sumValue = (items) => round2(items.reduce((sum, item) => {
      const rate = typeof rateFor === 'function' ? Number(rateFor(item)) : 0;
      return sum + billableHours(item) * (Number.isFinite(rate) && rate > 0 ? rate : 0);
    }, 0));

    return {
      extraHours: sumHours(rows, item => Number(item.horas_extra)), extraValue: sumValue(rows),
      paidExtraHours: sumHours(paid), paidExtraValue: sumValue(paid),
      pendingExtraHours: sumHours(pending), pendingExtraValue: sumValue(pending)
    };
  }

  return { summarize, billableHours };
});
