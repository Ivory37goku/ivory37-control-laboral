(function () {
  'use strict';

  const KEY = '工V龱尺ㄚ㇌7_data_v1';
  const APP_VERSION = (document.querySelector('meta[name="app-version"]') || {}).content || '3.3.9';
  const backupTools = window.IVORY37BackupTools;
  const themeTools = window.IVORY37Theme;
  const NOTIF_KEY = '工V龱尺ㄚ㇌7_reminder';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const DEFAULTS = {
    hora_normal_euros: '12.50', hora_extra_euros: '19.69', horas_normales_dia: '8', pausa_habitual_minutos: '0',
    horario_habitual: '08:00-16:00', app_name: 'Control Laboral', app_color: '#a6d94a',
    custom_logo: '', logo_bg: 'dark', user_name: '', user_role: 'Control laboral',
    user_avatar: '', auto_fichaje: '1', estimation: '0', nomina_auto_omitidas: '', tarifa_historial: '[]'
  };

  let data = null;
  let loadError = false;
  let modalSave = null;
  let modalDelete = null;
  let lastFocus = null;
  let lastAutoCheck = 0;
  let ratesDirty = false;

  const ui = { tab: 'dashboard', filter: 'all', query: '', limit: 30, today: '', hour: -1 };

  const pad = (n) => String(n).padStart(2, '0');
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const fmtInput = (n) => String(n == null ? '' : n).replace('.', ',');

  const num = (v, fallback) => {
    const fail = fallback === undefined ? 0 : fallback;
    if (typeof v === 'number') return Number.isFinite(v) ? v : fail;
    let s = String(v == null ? '' : v).trim();
    if (!s) return fail;
    s = s.replace(/[€\s]/g, '');
    const sign = /^[+-]/.test(s) ? s[0] : '';
    const body = sign ? s.slice(1) : s;
    if (!body || !/^\d[\d.,]*$/.test(body)) return fail;
    const dots = (body.match(/\./g) || []).length;
    const commas = (body.match(/,/g) || []).length;
    let normalized = body;
    if (dots && commas) {
      const decimal = body.lastIndexOf(',') > body.lastIndexOf('.') ? ',' : '.';
      const group = decimal === ',' ? '.' : ',';
      const parts = body.split(decimal);
      if (parts.length !== 2 || !/^\d+$/.test(parts[1])) return fail;
      const grouped = group === '.' ? /^\d{1,3}(?:\.\d{3})+$/ : /^\d{1,3}(?:,\d{3})+$/;
      if (parts[0].indexOf(group) !== -1 && !grouped.test(parts[0])) return fail;
      normalized = parts[0].split(group).join('') + '.' + parts[1];
    } else if (commas > 1) {
      if (!/^\d{1,3}(?:,\d{3})+$/.test(body)) return fail;
      normalized = body.replace(/,/g, '');
    } else if (dots > 1) {
      if (!/^\d{1,3}(?:\.\d{3})+$/.test(body)) return fail;
      normalized = body.replace(/\./g, '');
    } else if (commas === 1) {
      const parts = body.split(',');
      if (!/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) return fail;
      normalized = parts[1].length === 3 && parts[0].length <= 3 ? parts[0] + parts[1] : parts[0] + '.' + parts[1];
    }
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) return fail;
    const n = Number(sign + normalized);
    return Number.isFinite(n) ? n : fail;
  };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseKey(key) { const parts = String(key).split('-').map(Number); const d = new Date(0); d.setHours(0, 0, 0, 0); d.setFullYear(parts[0], (parts[1] || 1) - 1, parts[2] || 1); return d; }
  function monthKey(date) { return dateKey(date).slice(0, 7); }
  function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

  const moneyFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
  const hoursFmt = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtMoney = (n) => moneyFmt.format(Number.isFinite(Number(n)) ? Number(n) : 0);
  const fmtHours = (n) => hoursFmt.format(Number.isFinite(Number(n)) ? Number(n) : 0) + ' h';

  function isDateKey(value) { const v = String(value == null ? '' : value); const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); if (!m) return false; const d = parseKey(v); return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]); }
  function fmtDate(key) { if (!isDateKey(key)) return '—'; return parseKey(key).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function fmtMonth(key) { if (!isDateKey(String(key) + '-01')) return String(key || '—'); return parseKey(key + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); }
  function hhmm(value) { const v = String(value == null ? '' : value).trim(); return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : ''; }
  const { toMinutes, minutesBetween, hoursBetween, netHoursBetween } = window.IVORY37WorkHours;
  function habitualPauseMinutes() { return clamp(Math.round(num(setting('pausa_habitual_minutos'), 0)), 0, 1440); }
  function recordPauseMinutes(record) { return clamp(Math.round(num(record && record.descanso_minutos, 0)), 0, 1440); }
  function weekdaysInMonth(month) { const year = Number(month.slice(0, 4)); const m = Number(month.slice(5, 7)); const days = new Date(year, m, 0).getDate(); const out = []; for (let day = 1; day <= days; day++) { const d = new Date(year, m - 1, day); const wd = d.getDay(); if (wd !== 0 && wd !== 6) out.push(d); } return out; }
  const isSafeImage = (v) => /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(String(v || ''));

  function normalize(input) {
    const obj = input && typeof input === 'object' ? input : {};
    const arr = (v) => (Array.isArray(v) ? v : []);
    const bool = (v) => v === true || v === 1 || v === '1' || (typeof v === 'string' && v.trim().toLowerCase() === 'true');
    const jornadas = arr(obj.jornadas).map((item) => {
      if (!item || !item.fecha) return null;
      const fecha = String(item.fecha).slice(0, 10);
      if (!isDateKey(fecha)) return null;
      const entrada = hhmm(item.entrada);
      const salida = hhmm(item.salida);
      let estado = item.estado === 'provisional' ? 'provisional' : item.estado === 'confirmado' ? 'confirmado' : '';
      if (!estado) {
        const notes = String(item.notas || '').toLowerCase();
        if (notes.indexOf('provisional') !== -1 || notes.indexOf('orientativa') !== -1) estado = 'provisional';
        else if (notes.indexOf('[confirmado]') !== -1 || notes.indexOf('[revisado]') !== -1) estado = 'confirmado';
        else estado = (entrada && salida) ? 'confirmado' : 'provisional';
      }
      return { id: item.id == null ? uid() : item.id, fecha, entrada, salida, horas_normales: clamp(round2(num(item.horas_normales, 0)), 0, 24), horas_extra: clamp(round2(num(item.horas_extra, 0)), 0, 24), descanso_minutos: clamp(Math.round(num(item.descanso_minutos, 0)), 0, 1440), estado, notas: String(item.notas || ''), pagado_extras: bool(item.pagado_extras), fecha_pago_extras: String(item.fecha_pago_extras || ''), auto: bool(item.auto), backfill: bool(item.backfill), creado: item.creado || new Date().toISOString() };
    }).filter(Boolean);
    const viajes = arr(obj.viajes).map((item) => {
      if (!item || !item.fecha) return null;
      const fecha = String(item.fecha).slice(0, 10);
      if (!isDateKey(fecha)) return null;
      return { id: item.id == null ? uid() : item.id, fecha, concepto: String(item.concepto || 'Viaje'), importe: round2(Math.max(0, num(item.importe, 0))), pagado: bool(item.pagado) ? 1 : 0, fecha_pago: String(item.fecha_pago || ''), notas: String(item.notas || ''), creado: item.creado || new Date().toISOString() };
    }).filter(Boolean);
    const pagos = arr(obj.pagos).map((item) => {
      if (!item) return null;
      const tipo = item.tipo === 'nomina_auto' || item.tipo === 'nomina_mensual' ? item.tipo : 'nomina_mensual';
      const fecha = String(item.fecha || '').slice(0, 10);
      if (!isDateKey(fecha)) return null;
      return { id: item.id == null ? uid() : item.id, fecha, concepto: String(item.concepto || 'Nómina'), importe: round2(Math.max(0, num(item.importe, 0))), tipo, mes_key: item.mes_key || fecha.slice(0, 7), confirmado: bool(item.confirmado), horas_normales_mes: round2(num(item.horas_normales_mes, 0)), horas_extra_mes: round2(num(item.horas_extra_mes, 0)), dias_laborables: Math.max(0, Math.round(num(item.dias_laborables, 0))), manual_edit: bool(item.manual_edit), actualizado: item.actualizado || '', created: item.created || new Date().toISOString() };
    }).filter(Boolean);
    const ausencias = window.IVORY37Calendar.normalize(arr(obj.ausencias), isDateKey, uid);
    const settingsMap = new Map();
    arr(obj.ajustes).forEach((a) => { if (!a || typeof a.clave !== 'string') return; settingsMap.set(a.clave, a.valor == null ? '' : String(a.valor)); });
    const legacyLogo = settingsMap.get('app_logo') || '';
    if (!settingsMap.get('custom_logo') && legacyLogo && isSafeImage(legacyLogo)) settingsMap.set('custom_logo', legacyLogo);
    settingsMap.delete('app_logo'); settingsMap.delete('seeded_demo');
    if (!isSafeImage(settingsMap.get('custom_logo'))) { settingsMap.set('custom_logo', ''); settingsMap.set('logo_ratio', ''); }
    if (settingsMap.has('user_avatar') && settingsMap.get('user_avatar') && settingsMap.get('user_avatar') !== '@logo' && !isSafeImage(settingsMap.get('user_avatar'))) settingsMap.set('user_avatar', '');
    const ajustes = Array.from(settingsMap, ([clave, valor]) => ({ clave, valor }));
    return { jornadas, viajes, pagos, ausencias, ajustes };
  }

  function hasInvalidDates(input) {
    const obj = input && typeof input === 'object' ? input : {};
    const invalid = (rows) => Array.isArray(rows) && rows.some((item) => item && item.fecha && !isDateKey(String(item.fecha).slice(0, 10)));
    return invalid(obj.jornadas) || invalid(obj.viajes) || invalid(obj.pagos) || invalid(obj.ausencias);
  }

  function loadData() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const parsed = JSON.parse(raw); if (hasInvalidDates(parsed)) { loadError = true; console.error('Hay fechas no válidas en los datos guardados; no se han sobrescrito.'); return normalize({}); } return normalize(parsed); } } catch (err) { loadError = true; console.error('No se pudo leer el almacenamiento local:', err); }
    return normalize({});
  }

  function nativeStorageBridge() { return window.AndroidBridge || window.IVORY37DesktopBridge || null; }
  function storageSnapshot() {
    const snapshot = {};
    try { for (let index = 0; index < localStorage.length; index++) { const key = localStorage.key(index); if (key) snapshot[key] = localStorage.getItem(key); } }
    catch (err) { console.warn('No se pudo preparar la copia local del almacenamiento.'); }
    return snapshot;
  }
  function mirrorNativeStorage() {
    const bridge = nativeStorageBridge();
    if (!bridge || typeof bridge.saveLocalStorage !== 'function') return;
    try { bridge.saveLocalStorage(JSON.stringify(storageSnapshot())); }
    catch (err) { console.warn('No se pudo actualizar la copia local de la app.'); }
  }
  function restoreNativeStorage() {
    const bridge = nativeStorageBridge();
    const params = new URLSearchParams(location.search);
    const forceRestore = params.get('nativeRestore') === '1';
    if (!bridge || typeof bridge.getLocalStorageSnapshot !== 'function') {
      if (forceRestore) loadError = true;
      return !forceRestore;
    }
    try {
      if (!forceRestore && localStorage.getItem(KEY) !== null) return true;
      const raw = bridge.getLocalStorageSnapshot();
      if (!raw || raw.length > 12 * 1024 * 1024) throw new Error('La copia local no está disponible.');
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('La copia local no es válida.');
      if (forceRestore) {
        if (typeof saved[KEY] !== 'string' || typeof bridge.completeLocalStorageMigration !== 'function') throw new Error('Faltan los datos para completar la migración.');
        const savedData = JSON.parse(saved[KEY]);
        if (!savedData || typeof savedData !== 'object' || Array.isArray(savedData)) throw new Error('Los datos guardados no son válidos.');
        const previous = storageSnapshot();
        try {
          localStorage.clear();
          Object.keys(saved).forEach((key) => {
            if (typeof saved[key] === 'string' && key.length < 512) localStorage.setItem(key, saved[key]);
          });
        } catch (restoreError) {
          try {
            localStorage.clear();
            Object.keys(previous).forEach((key) => localStorage.setItem(key, previous[key]));
          } catch (rollbackError) { console.error('No se pudo revertir la restauración local:', rollbackError); }
          throw restoreError;
        }
        bridge.completeLocalStorageMigration();
        window.history.replaceState(null, '', location.pathname + location.hash);
        return true;
      }
      Object.keys(saved).forEach((key) => {
        if (typeof saved[key] === 'string' && key.length < 512 && localStorage.getItem(key) === null) localStorage.setItem(key, saved[key]);
      });
      return true;
    } catch (err) {
      if (forceRestore) loadError = true;
      console.error('No se pudo restaurar la copia local de la app:', err);
      return !forceRestore;
    }
  }
  function ensureInternalBackup() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const today = dateKey(new Date());
      if (localStorage.getItem(KEY + '_backup_date') === today && localStorage.getItem(KEY + '_backup')) return;
      localStorage.setItem(KEY + '_backup', raw);
      localStorage.setItem(KEY + '_backup_date', today);
    } catch (err) { console.warn('No se pudo actualizar la copia interna diaria.'); }
  }

  function setting(key, fallback) { const row = data.ajustes.find((a) => a.clave === key); if (row) return row.valor; if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) return DEFAULTS[key]; return fallback === undefined ? '' : fallback; }
  function setSetting(key, value) { const row = data.ajustes.find((a) => a.clave === key); if (row) row.valor = String(value); else data.ajustes.push({ clave: key, valor: String(value) }); }
  function removeSetting(key) { data.ajustes = data.ajustes.filter((row) => row.clave !== key); }

  const isAutoGenerated = (j) => Boolean(j.backfill);
  const rateNormal = () => num(setting('hora_normal_euros'), 12.5);
  const rateExtra = () => num(setting('hora_extra_euros'), 19.69);
  const legacyDayHours = () => num(setting('horas_normales_dia'), 8);
  const dayHours = () => rateOn(dateKey(new Date()), 'jornada');
  function rateHistory() {
    return window.IVORY37Rates.normalize(setting('tarifa_historial', '[]'), isDateKey);
  }
  function rateOn(date, kind) {
    const key = kind === 'extra' ? 'extra' : kind === 'jornada' ? 'jornada' : 'normal';
    return window.IVORY37Rates.atDate(rateHistory(), date, key, { normal: rateNormal(), extra: rateExtra(), jornada: legacyDayHours() });
  }
  function saveRateVersion(version) {
    const history = window.IVORY37Rates.upsert(rateHistory(), version, { normal: rateNormal(), extra: rateExtra(), jornada: legacyDayHours() });
    setSetting('tarifa_historial', JSON.stringify(history));
    const today = dateKey(new Date());
    const current = window.IVORY37Rates.active(history, today, { normal: rateNormal(), extra: rateExtra(), jornada: legacyDayHours() });
    setSetting('hora_normal_euros', current.normal.toFixed(2));
    setSetting('hora_extra_euros', current.extra.toFixed(2));
    setSetting('horas_normales_dia', String(current.jornada));
  }
  function calendarEntryOn(date) { return data.ausencias.find((item) => item.fecha === date) || null; }
  function calendarLabel(type) { return window.IVORY37Calendar.label(type); }
  const isEstimation = () => setting('estimation') === '1';
  const isAutoFichaje = () => setting('auto_fichaje') === '1';

  function initials(value) { const parts = String(value == null ? '' : value).trim().split(/\s+/).filter(Boolean); if (!parts.length) return '37'; return (parts[0].charAt(0) + (parts[1] ? parts[1].charAt(0) : '')).toUpperCase(); }
  function scheduleWindow() { const raw = String(setting('horario_habitual') || ''); const match = raw.match(/(\d{1,2}:\d{2})\s*(?:[-–]|\ba\b)\s*(\d{1,2}:\d{2})/i); if (!match) return null; const start = hhmm(match[1].padStart(5, '0')); const end = hhmm(match[2].padStart(5, '0')); if (!start || !end) return null; const startMin = toMinutes(start); const endMin = toMinutes(end); if (startMin === endMin) return null; return { start, end, startMin, endMin, overnight: endMin < startMin, hours: hoursBetween(start, end) }; }
  function jornadaForDate(date) {
    const rows = data.jornadas.filter((item) => item.fecha === date);
    return rows.find((item) => !item.auto && item.entrada && item.salida)
      || rows.find((item) => !item.auto)
      || rows.find((item) => item.entrada && item.salida)
      || rows[0]
      || null;
  }
  function openJornadaForDate(date) {
    const rows = data.jornadas.filter((item) => item.fecha === date && item.entrada && !item.salida);
    if (data.jornadas.some((item) => item.fecha === date && !item.auto && item.entrada && item.salida)) return null;
    return rows.find((item) => !item.auto) || rows[0] || null;
  }

  function missingMonthDays() {
    const month = monthKey(new Date()); const today = new Date(); today.setHours(0, 0, 0, 0);
    const existing = new Set(data.jornadas.filter((j) => j.fecha.slice(0, 7) === month).map((j) => j.fecha));
    const exceptions = new Set(data.ausencias.map((item) => item.fecha));
    return weekdaysInMonth(month).filter((d) => d <= today && !existing.has(dateKey(d)) && !exceptions.has(dateKey(d)));
  }

  function persist(message) {
    if (loadError) { toast('No se pudieron leer tus datos guardados. Importa un backup o usa «Borrar todo».', 'error'); return false; }
    let previous = null;
    try { previous = localStorage.getItem(KEY); } catch (err) { console.error('No se pudo leer la copia previa:', err); }
    const restorePrevious = () => {
      if (previous) {
        try { data = normalize(JSON.parse(previous)); return; } catch (err) { console.error('No se pudo recuperar la copia previa:', err); }
      }
      // Si no se pudo leer un estado anterior, conserva la edición en memoria.
      // Vaciarla aquí podía borrar jornadas tras un fallo de almacenamiento.
    };
    try { syncPayrolls(); }
    catch (err) { console.error('syncPayrolls:', err); restorePrevious(); toast('Error al recalcular las nóminas.', 'error'); return false; }
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (err) { saved = false; console.error(err); restorePrevious(); toast('No se pudo guardar. Libera espacio o exporta un backup.', 'error'); return false; }
    window.IVORY37CloudSync?.queue(data);
    mirrorNativeStorage();
    renderAll(); updateStorageUsage(); if (message) toast(message);
    return true;
  }

  function estimatedDates(month, records) {
    if (!isEstimation()) return [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const existing = new Set((records || data.jornadas.filter((j) => j.fecha.slice(0, 7) === month)).map((j) => j.fecha));
    const exceptions = new Set(data.ausencias.map((item) => item.fecha));
    return weekdaysInMonth(month).filter((date) => date <= today && !existing.has(dateKey(date)) && !exceptions.has(dateKey(date))).map(dateKey);
  }
  function estimatedDays(month, records) { return estimatedDates(month, records).length; }
  function monthStats(month) {
    const allRecords = data.jornadas.filter((j) => j.fecha.slice(0, 7) === month);
    const records = allRecords.filter((j) => j.estado === 'confirmado');
    const normal = round2(records.reduce((sum, j) => sum + j.horas_normales, 0));
    const extra = round2(records.reduce((sum, j) => sum + j.horas_extra, 0));
    const estimated = estimatedDates(month, allRecords);
    const estimatedHours = round2(estimated.reduce((sum, date) => sum + rateOn(date, 'jornada'), 0));
    const normalValue = round2(records.reduce((sum, j) => sum + j.horas_normales * rateOn(j.fecha, 'normal'), 0) + estimated.reduce((sum, date) => sum + rateOn(date, 'jornada') * rateOn(date, 'normal'), 0));
    const extraValue = round2(records.reduce((sum, j) => sum + j.horas_extra * rateOn(j.fecha, 'extra'), 0));
    return { days: records.length, normal, extra, estimated: estimated.length, normalTotal: round2(normal + estimatedHours), normalValue, extraValue };
  }

  function totals() {
    let extraH = 0; let extraPending = 0; let extraPaid = 0; let extraEarned = 0; let trips = 0; let tripsPaid = 0; let autoPaid = 0; let payrollPending = 0; let manualPaid = 0;
    data.jornadas.forEach((j) => { if (j.estado !== 'confirmado') return; const value = j.horas_extra * rateOn(j.fecha, 'extra'); extraH += j.horas_extra; extraEarned += value; if (j.pagado_extras) extraPaid += value; else extraPending += value; });
    data.viajes.forEach((v) => { trips += v.importe; if (v.pagado) tripsPaid += v.importe; });
    data.pagos.forEach((p) => { if (p.tipo === 'nomina_auto') { if (p.confirmado) autoPaid += p.importe; else payrollPending += p.importe; } else if (p.confirmado) manualPaid += p.importe; });
    const payrollPaid = autoPaid + manualPaid; const payrollEarned = payrollPaid + payrollPending; const earned = round2(payrollEarned + extraEarned + trips); const collected = round2(payrollPaid + extraPaid + tripsPaid);
    return { extraH: round2(extraH), extraPending: round2(extraPending), extraPaid: round2(extraPaid), extraValue: round2(extraEarned), trips: round2(trips), tripsPaid: round2(tripsPaid), payrollPaid: round2(payrollPaid), payrollPending: round2(payrollPending), earned, collected, pending: round2(earned - collected), rn: rateNormal(), re: rateExtra() };
  }

  function syncPayrolls() {
    const manuallyCompletedDates = new Set(data.jornadas.filter((item) => !item.auto && item.entrada && item.salida).map((item) => item.fecha));
    if (manuallyCompletedDates.size) data.jornadas = data.jornadas.filter((item) => !item.auto || !manuallyCompletedDates.has(item.fecha));
    const months = new Set(data.jornadas.filter((j) => j.estado === 'confirmado').map((j) => j.fecha.slice(0, 7)));
    const omitted = new Set(String(setting('nomina_auto_omitidas') || '').split(',').filter(Boolean));
    Array.from(months).sort().forEach((month) => {
      if (omitted.has(month)) return;
      const stats = monthStats(month); const amount = stats.normalValue;
      const existing = data.pagos.find((p) => p.tipo === 'nomina_auto' && p.mes_key === month);
      if (existing) { if (!existing.confirmado && !existing.manual_edit && existing.importe !== amount) { existing.importe = amount; existing.actualizado = new Date().toISOString(); } existing.horas_normales_mes = stats.normalTotal; existing.horas_extra_mes = stats.extra; existing.dias_laborables = stats.days; }
      else { data.pagos.push({ id: uid(), fecha: month + '-28', concepto: 'Nómina ' + fmtMonth(month), importe: amount, tipo: 'nomina_auto', mes_key: month, confirmado: false, horas_normales_mes: stats.normalTotal, horas_extra_mes: stats.extra, dias_laborables: stats.days, manual_edit: false, created: new Date().toISOString() }); }
    });
    data.pagos = data.pagos.filter((p) => { if (p.tipo !== 'nomina_auto') return true; if (omitted.has(p.mes_key)) return false; if (p.confirmado) return true; if (p.manual_edit) return true; return months.has(p.mes_key); });
  }

  function monthBreakdown(month) {
    let payroll = 0; let extras = 0; let trips = 0;
    data.pagos.forEach((p) => { if (p.tipo === 'nomina_auto' && p.mes_key === month && !p.confirmado) payroll += p.importe; });
    data.jornadas.forEach((j) => { if (j.estado === 'confirmado' && j.fecha.slice(0, 7) === month && !j.pagado_extras) extras += j.horas_extra * rateOn(j.fecha, 'extra'); });
    data.viajes.forEach((v) => { if (v.fecha.slice(0, 7) === month && !v.pagado) trips += v.importe; });
    payroll = round2(payroll); extras = round2(extras); trips = round2(trips);
    return { payroll, extras, trips, total: round2(payroll + extras + trips) };
  }

  function overtimeMonthBreakdown(month) {
    return window.IVORY37Overtime.summarize(data.jornadas, month, (j) => rateOn(j.fecha, 'extra'));
  }

  function niceScale(max) { const raw = Math.max(max, 1) / 9; const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1)))); const step = [1, 2, 2.5, 5, 10].map((x) => x * pow).find((s) => s >= raw) || pow * 10; return { step, max: Math.ceil(max / step) * step }; }

  function renderDataTools() {
    const auto = data.jornadas.filter(isAutoGenerated); const cleanup = $('#cleanup-auto-btn');
    if (cleanup) { cleanup.hidden = auto.length === 0; cleanup.textContent = auto.length === 1 ? 'Quitar 1 autogenerada' : 'Quitar ' + auto.length + ' autogeneradas'; }
    updateFillLabel(); renderBackupInfo();
    const setupBtn = $('#setup-show-btn'); if (setupBtn) setupBtn.hidden = setting('setup_dismissed') !== '1';
  }

  function renderNotifState() { const el = $('#notif-state'); if (!el) return; if (!('Notification' in window)) el.textContent = 'No compatible'; else el.textContent = Notification.permission === 'granted' ? 'Activados' : Notification.permission === 'denied' ? 'Bloqueados' : 'Sin activar'; }
  function renderAll() { renderDashboard(); renderJornadas(); renderCalendar(); renderTrips(); renderPagos(); renderSetup(); renderDataTools(); updateStorageUsage(); }
  function updateFillLabel() { const fill = $('#fill-month-btn'); if (!fill) return; const missing = missingMonthDays().length; const label = fill.querySelector('span'); if (label) label.textContent = missing ? 'Completar mes (' + missing + ')' : 'Completar mes'; }

  /* ---------- DASHBOARD 3.0 ---------- */
  function renderHero() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
    const greetingEl = $('#hero-greeting'); if (greetingEl) greetingEl.textContent = greeting;
    const todayLabel = $('#today-label'); if (todayLabel) todayLabel.textContent = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const name = String(setting('user_name') || 'Control Laboral').trim() || 'Control Laboral';
    const nameEl = $('#hero-name'); if (nameEl) nameEl.textContent = name;
    const today = dateKey(now);
    const j = jornadaForDate(today);
    let todayHours = 0; let metaText = 'Sin fichar';
    if (j) {
      if (j.entrada && j.salida) { todayHours = round2(j.horas_normales + j.horas_extra); metaText = j.entrada + '–' + j.salida; }
      else if (j.entrada) { const mins = toMinutes(j.entrada); const nowMins = now.getHours() * 60 + now.getMinutes(); todayHours = round2((((nowMins - mins) % 1440) + 1440) % 1440 / 60); metaText = 'Desde ' + j.entrada + ' · en curso'; }
      else { todayHours = round2(j.horas_normales + j.horas_extra); metaText = 'Registro manual'; }
    }
    const hoursEl = $('#hero-today-hours'); if (hoursEl) hoursEl.textContent = fmtHours(todayHours);
    const win = scheduleWindow();
    const metaEl = $('#hero-today-meta');
    if (metaEl) metaEl.innerHTML = esc(metaText) + (win ? ' · <b>' + esc(win.start + '-' + win.end) + '</b>' : '');
    const sub = $('#hero-sub');
    const hasData = data.jornadas.length || data.viajes.length || data.pagos.length || data.ausencias.length;
    const t = totals();
    if (sub) { if (!hasData) sub.textContent = 'Empieza fichando o creando tu primera jornada.'; else if (t.pending > 0) sub.textContent = 'Te quedan ' + fmtMoney(t.pending) + ' por cobrar.'; else sub.textContent = 'Todo al día. Buen trabajo.'; }
    const badges = $('#hero-badges');
    if (badges) {
      const list = [];
      if (hasData && t.pending > 0) list.push('<span class="badge bad">' + fmtMoney(t.pending) + ' por cobrar</span>');
      if (hasData && t.pending === 0) list.push('<span class="badge ok">Todo al día</span>');
      if (j && j.entrada && !j.salida) list.push('<span class="badge info">Jornada abierta</span>');
      if (isEstimation()) list.push('<span class="badge warn">Estimación activa</span>');
      badges.innerHTML = list.join('');
    }
  }

  function renderRadial() {
    const now = new Date();
    const today = dateKey(now);
    const yesterday = dateKey(addDays(now, -1));
    const base = dayHours();
    let j = jornadaForDate(today);
    if (!j) j = openJornadaForDate(yesterday);
    const ring = $('#radial-progress');
    const eyebrow = $('#radial-eyebrow');
    const hoursEl = $('#radial-hours');
    const subEl = $('#radial-sub');
    const dot = $('#ring-dot');
    const inline = $('#today-status-inline');
    const qaIn = $('#qa-clock-in');
    const qaOut = $('#qa-clock-out');
    if (!ring || !eyebrow) return;
    const circumference = 2 * Math.PI * 88;
    let worked = 0; let label = 'Sin fichar'; let subLabel = 'Hoy'; let dotClass = 'dot'; let inlineText = 'Sin actividad registrada';
    if (!j) { worked = 0; }
    else if (j.entrada && j.salida) { worked = round2(j.horas_normales + j.horas_extra); label = 'Jornada cerrada'; subLabel = j.entrada + ' – ' + j.salida; inlineText = 'Cerrada · ' + j.entrada + '–' + j.salida; }
    else if (j.entrada) { const mins = toMinutes(j.entrada); const nowMins = now.getHours() * 60 + now.getMinutes(); const dayOffset = j.fecha === yesterday ? 1440 : 0; worked = round2((((nowMins - mins + dayOffset) % 1440) + 1440) % 1440 / 60); label = 'Trabajando'; subLabel = 'Desde ' + j.entrada; dotClass = 'dot live'; inlineText = 'Trabajando desde ' + j.entrada; }
    else { worked = round2(j.horas_normales + j.horas_extra); label = 'Sin fichaje'; subLabel = fmtHours(worked) + ' manuales'; inlineText = 'Registro sin fichaje'; }
    const pct = clamp(worked / base, 0, 1);
    ring.setAttribute('stroke-dasharray', (pct * circumference).toFixed(2) + ' ' + circumference.toFixed(2));
    eyebrow.textContent = label;
    hoursEl.textContent = fmtHours(worked);
    subEl.textContent = subLabel;
    if (dot) dot.className = dotClass;
    if (inline) inline.textContent = inlineText;
    if (qaIn) qaIn.textContent = j && j.entrada ? 'A las ' + j.entrada : 'Fichar ahora';
    if (qaOut) qaOut.textContent = j && j.salida ? 'A las ' + j.salida : 'Cerrar jornada';
  }

  function renderSparklines() {
    const spark = $('#kpi-hero-spark'); if (!spark) return;
    const months = new Set();
    data.pagos.forEach((p) => months.add(p.mes_key));
    data.jornadas.forEach((j) => months.add(j.fecha.slice(0, 7)));
    const list = Array.from(months).filter(Boolean).sort().slice(-8);
    if (!list.length) { spark.innerHTML = ''; return; }
    const values = list.map((m) => {
      let paid = 0;
      data.pagos.forEach((p) => { if (p.mes_key === m && p.confirmado) paid += p.importe; });
      data.jornadas.forEach((j) => { if (j.fecha.slice(0, 7) === m && j.pagado_extras) paid += j.horas_extra * rateOn(j.fecha, 'extra'); });
      data.viajes.forEach((v) => { if (v.fecha.slice(0, 7) === m && v.pagado) paid += v.importe; });
      return paid;
    });
    const max = Math.max.apply(null, values.concat([1]));
    spark.innerHTML = values.map((v) => '<i style="height:' + Math.max(8, (v / max) * 100).toFixed(1) + '%"></i>').join('');
  }

  function renderWeek() {
    const box = $('#week-chart'); const summary = $('#week-summary'); const badge = $('#week-badge');
    if (!box) return;
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7)); monday.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 0; i < 7; i++) { const d = addDays(monday, i); const key = dateKey(d); const j = data.jornadas.find((x) => x.fecha === key); const hours = j ? (j.horas_normales + j.horas_extra) : 0; days.push({ d, key, hours, isToday: key === dateKey(now) }); }
    const total = round2(days.reduce((s, d) => s + d.hours, 0));
    const max = Math.max.apply(null, days.map((d) => d.hours).concat([1]));
    box.innerHTML = days.map((d) => {
      const h = (d.hours / max) * 100;
      const label = d.d.toLocaleDateString('es-ES', { weekday: 'short' });
      return '<div class="week-col' + (d.isToday ? ' is-today' : '') + '"><div class="bar" style="height:' + Math.max(3, h).toFixed(1) + '%">' + (d.hours > 0 ? '<span class="h">' + hoursFmt.format(d.hours) + '</span>' : '') + '</div><span class="d">' + esc(label) + '</span></div>';
    }).join('');
    if (badge) badge.textContent = fmtHours(total);
    if (summary) { const baseWeek = round2(dayHours() * 5); const pct = baseWeek > 0 ? Math.round((total / baseWeek) * 100) : 0; summary.innerHTML = '<span>Total <b>' + fmtHours(total) + '</b> / ' + fmtHours(baseWeek) + '</span><span><b>' + pct + '%</b></span>'; }
  }

  function renderNextPayroll() {
    const valueEl = $('#next-pay-value'); const metaEl = $('#next-pay-meta');
    if (!valueEl || !metaEl) return;
    const month = monthKey(new Date());
    const stats = monthStats(month);
    const rn = rateNormal(); const re = rateExtra();
    const estimatedAmount = round2(stats.normalValue + stats.extraValue);
    valueEl.textContent = fmtMoney(estimatedAmount);
    const parts = [fmtHours(stats.normalTotal) + ' normales', stats.extra > 0 ? '+' + fmtHours(stats.extra) + ' extra' : null, 'tarifas por fecha', fmtMonth(month)].filter(Boolean);
    metaEl.innerHTML = parts.map(esc).join(' · ');
  }

  function renderHeatmap() {
    const box = $('#heatmap'); if (!box) return;
    const now = new Date(); const end = new Date(now); end.setHours(0, 0, 0, 0);
    const start = addDays(end, -83);
    const cells = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const key = dateKey(d); const j = data.jornadas.find((x) => x.fecha === key);
      const hours = j ? (j.horas_normales + j.horas_extra) : 0;
      const base = rateOn(key, 'jornada');
      let lvl = 0;
      if (hours > 0) lvl = hours >= base ? 4 : hours >= base * 0.75 ? 3 : hours >= base * 0.5 ? 2 : 1;
      cells.push({ key, lvl, title: key + ' · ' + fmtHours(hours) });
    }
    box.innerHTML = cells.map((c) => '<i class="hm-cell" data-lvl="' + c.lvl + '" title="' + esc(c.title) + '"></i>').join('');
  }

  function renderDashboard() {
    const t = totals();
    const collectedEl = $('#kpi-collected'); if (collectedEl) collectedEl.textContent = fmtMoney(t.collected);
    const pendingEl = $('#kpi-pending'); if (pendingEl) pendingEl.textContent = fmtMoney(t.pending);
    const extraEl = $('#kpi-extra'); if (extraEl) extraEl.textContent = fmtHours(t.extraH);
    const extraValEl = $('#kpi-extra-value'); if (extraValEl) extraValEl.textContent = fmtMoney(t.extraValue);
    const estFlag = $('#kpi-est-flag'); if (estFlag) estFlag.hidden = !isEstimation();
    const pct = t.earned > 0 ? clamp(t.collected / t.earned, 0, 1) : 0;
    const circumference = 2 * Math.PI * 50;
    const arc = $('#donut-arc');
    if (arc) arc.setAttribute('stroke-dasharray', (pct * circumference).toFixed(2) + ' ' + circumference.toFixed(2));
    const pctEl = $('#donut-pct'); if (pctEl) pctEl.textContent = Math.round(pct * 100) + '%';
    const subEl = $('#donut-sub'); if (subEl) subEl.innerHTML = '<b>' + fmtMoney(t.collected) + '</b> cobrado';
    const sub2El = $('#donut-sub2'); if (sub2El) sub2El.innerHTML = '<b>' + fmtMoney(Math.max(0, t.pending)) + '</b> pend.';
    const status = $('#donut-status');
    if (status) { status.textContent = pct >= 1 ? 'Al día' : pct >= 0.9 ? 'Casi al día' : pct >= 0.5 ? 'Parcial' : 'Pendiente'; status.className = 'badge ' + (pct >= 1 ? 'ok' : pct >= 0.5 ? 'warn' : 'bad'); }
    renderBars(); renderRecentPayrolls(); renderHero(); renderRadial(); renderSparklines(); renderWeek(); renderNextPayroll(); renderHeatmap();
  }

  function renderBars() {
    const months = new Set();
    data.jornadas.forEach((j) => months.add(j.fecha.slice(0, 7)));
    data.pagos.forEach((p) => months.add(p.mes_key));
    data.viajes.forEach((v) => months.add(v.fecha.slice(0, 7)));
    const rows = Array.from(months).filter(Boolean).sort().map((month) => Object.assign({ month }, monthBreakdown(month), overtimeMonthBreakdown(month))).slice(-8);
    const box = $('#bars'); const legend = $('#bars-legend'); const caption = $('#bars-caption');
    const totalEl = $('#bars-total'); const pendingTotal = round2(rows.reduce((s, r) => s + r.total, 0));
    if (totalEl) { totalEl.textContent = fmtMoney(pendingTotal); totalEl.title = 'Importe pendiente total en los meses mostrados'; totalEl.className = 'badge ' + (pendingTotal > 0 ? 'bad' : 'ok'); }
    const overtimeRows = rows.filter((row) => row.extraHours > 0);
    const overtimeHours = round2(overtimeRows.reduce((sum, row) => sum + row.extraHours, 0));
    const overtimeValue = round2(overtimeRows.reduce((sum, row) => sum + row.extraValue, 0));
    const overtimeSummary = $('#bars-extra-summary');
    if (overtimeSummary) overtimeSummary.textContent = overtimeRows.length ? fmtHours(overtimeHours) + ' · ' + fmtMoney(overtimeValue) : 'Sin extras confirmadas';
    const overtimeDetails = $('#bars-extra-details');
    const overtimeNote = $('#bars-extra-note');
    if (overtimeDetails) {
      overtimeDetails.innerHTML = overtimeRows.map((row) => {
        const month = parseKey(row.month + '-01').toLocaleDateString('es-ES', { month: 'short' });
        const receivedKey = 'overtime_received_' + row.month;
        const receivedRaw = setting(receivedKey, '');
        const received = receivedRaw === '' ? NaN : num(receivedRaw, NaN);
        const hasReceived = Number.isFinite(received) && received >= 0;
        const difference = hasReceived ? round2(row.extraValue - received) : null;
        const comparison = !hasReceived
          ? '<small class="chart-extra-difference muted">Registra lo recibido para comparar</small>'
          : difference > 0.009
            ? '<small class="chart-extra-difference bad">Diferencia: faltan ' + esc(fmtMoney(difference)) + '</small>'
            : difference < -0.009
              ? '<small class="chart-extra-difference ok">' + esc(fmtMoney(Math.abs(difference))) + ' por encima de la tarifa</small>'
              : '<small class="chart-extra-difference ok">Coincide con la tarifa</small>';
        const receivedLabel = hasReceived ? fmtMoney(received) : 'Sin registrar';
        const receivedTitle = hasReceived ? fmtMoney(received) + ' recibidos' : 'importe recibido sin registrar';
        const title = fmtMonth(row.month) + ': ' + fmtHours(row.extraHours) + ' confirmadas · ' + fmtMoney(row.extraValue) + ' según tarifa · ' + receivedTitle + ' · ' + fmtHours(row.paidExtraHours) + ' marcadas como pagadas en la app.';
        return '<article class="chart-extra-month" title="' + esc(title) + '"><div class="chart-extra-top"><span class="chart-extra-month-name">' + esc(month) + '</span><strong>' + esc(fmtHours(row.extraHours)) + '</strong></div><small>A tarifa: <b>' + esc(fmtMoney(row.extraValue)) + '</b></small><small>Recibido real: <b>' + esc(receivedLabel) + '</b></small>' + comparison + '<small class="chart-extra-paid">App: ' + esc(fmtHours(row.paidExtraHours)) + ' marcadas pagadas</small><button class="btn ghost sm chart-extra-edit" type="button" data-action="edit-extra-payment" data-month="' + esc(row.month) + '">' + (hasReceived ? 'Editar importe' : 'Anotar pago real') + '</button></article>';
      }).join('');
      overtimeDetails.hidden = !overtimeRows.length;
    }
    if (overtimeNote) overtimeNote.hidden = !overtimeRows.length;
    if (!box) return;
    if (!rows.length) { box.innerHTML = '<div class="empty-chart">Sin pendientes de cobro.<br>Todo al día.</div>'; if (legend) legend.innerHTML = ''; if (caption) { caption.hidden = false; caption.textContent = 'Sin pendientes.'; } return; }
    const max = Math.max.apply(null, rows.map((r) => r.total).concat([1]));
    const scale = niceScale(max); if (!scale.max || !Number.isFinite(scale.max)) scale.max = 1;
    const yLabels = []; for (let v = scale.max; v >= 0; v -= scale.step) yLabels.push(round2(v)); if (!yLabels.length) yLabels.push(scale.max, 0);
    const axisFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
    const COLORS = { payroll: '#60a5fa', extras: '#ef4444', trips: '#fbbf24' };
    if (legend) legend.innerHTML = '<span><i class="legend-dot" style="background:' + COLORS.payroll + '"></i>Nóminas</span><span><i class="legend-dot" style="background:' + COLORS.extras + '"></i>Extras</span><span><i class="legend-dot" style="background:' + COLORS.trips + '"></i>Viajes</span>';
    if (caption) { caption.hidden = true; }
    const bars = rows.map((row) => {
      const height = (row.total / scale.max) * 100; const segP = row.payroll > 0 ? (row.payroll / row.total) * 100 : 0; const segE = row.extras > 0 ? (row.extras / row.total) * 100 : 0; const segT = row.trips > 0 ? (row.trips / row.total) * 100 : 0;
      const title = fmtMonth(row.month) + ': ' + fmtMoney(row.total) + ' pendientes en total. Extras confirmadas: ' + fmtHours(row.extraHours) + ' (' + fmtMoney(row.extraValue) + ' según tarifa; ' + fmtHours(row.paidExtraHours) + ' marcadas pagadas).';
      return '<div class="chart-col" title="' + esc(title) + '"><div class="chart-stack" style="height:' + height.toFixed(1) + '%"><span class="chart-total">' + axisFmt.format(Math.round(row.total)) + ' €</span>' + (segP > 0 ? '<span class="chart-seg" style="height:' + segP.toFixed(1) + '%;background:' + COLORS.payroll + '"></span>' : '') + (segE > 0 ? '<span class="chart-seg" style="height:' + segE.toFixed(1) + '%;background:' + COLORS.extras + '"></span>' : '') + (segT > 0 ? '<span class="chart-seg" style="height:' + segT.toFixed(1) + '%;background:' + COLORS.trips + '"></span>' : '') + '</div></div>';
    }).join('');
    const monthsHtml = rows.map((row) => {
      const monthLabel = parseKey(row.month + '-01').toLocaleDateString('es-ES', { month: 'short' });
      const title = fmtMonth(row.month) + ': ' + fmtHours(row.extraHours) + ' de horas extra confirmadas';
      const accessibleLabel = fmtMonth(row.month) + ', ' + fmtHours(row.extraHours) + ' extra';
      const compactHours = fmtHours(row.extraHours).replace(/\s/g, '');
      return '<span class="chart-month-tick" title="' + esc(title) + '" aria-label="' + esc(accessibleLabel) + '"><span class="chart-month-name">' + esc(monthLabel) + '</span><small class="chart-month-hours">' + esc(compactHours) + '</small></span>';
    }).join('');
    box.innerHTML = '<div class="chart-area"><div class="chart-y">' + yLabels.map((v) => '<span>' + axisFmt.format(v) + ' €</span>').join('') + '</div><div class="chart-plot"><div class="chart-grid">' + yLabels.map(() => '<span></span>').join('') + '</div><div class="chart-bars">' + bars + '</div></div><div class="chart-months">' + monthsHtml + '</div></div>';
  }

  function renderRecentPayrolls() {
    const box = $('#recent-payrolls'); if (!box) return;
    const rows = data.pagos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3);
    if (!rows.length) { box.innerHTML = '<div class="empty" style="padding:22px"><strong>Sin nóminas</strong>Añade jornadas y pulsa «Recalcular» en Pagos.</div>'; return; }
    box.innerHTML = rows.map((p) => {
      const ok = p.confirmado; const meta = [fmtMonth(p.mes_key || p.fecha.slice(0, 7))];
      if (p.horas_normales_mes) meta.push(fmtHours(p.horas_normales_mes)); if (p.dias_laborables) meta.push(p.dias_laborables + ' días');
      return '<div class="row" style="--edge:' + (ok ? 'var(--ok)' : 'var(--warn)') + '"><div class="main"><p class="title">' + esc(p.concepto) + '</p><p class="sub">' + esc(meta.join(' · ')) + '</p></div><div class="row-actions"><span class="amount">' + fmtMoney(p.importe) + '</span><span class="badge ' + (ok ? 'ok' : 'warn') + '">' + (ok ? 'Confirmada' : 'Pendiente') + '</span></div></div>';
    }).join('');
  }

  function renderSetup() {
    const card = $('#setup-card'); if (!card) return;
    if (setting('setup_dismissed') === '1') { card.hidden = true; return; }
    const hasData = data.jornadas.length || data.viajes.length || data.pagos.length || data.ausencias.length;
    const items = [{ done: Boolean(String(setting('user_name') || '').trim()), label: 'Pon tu nombre', action: 'open-profile' },{ done: Boolean(scheduleWindow()), label: 'Configura tu horario', action: 'open-schedule' },{ done: data.jornadas.length > 0, label: 'Registra tu primera jornada', action: 'new-jornada' }];
    if (hasData) items.push({ done: recentBackup(), label: 'Descarga copia de seguridad', action: 'export-json' });
    const done = items.filter((i) => i.done).length;
    const progEl = $('#setup-progress'); if (progEl) progEl.textContent = done + '/' + items.length;
    const barEl = $('#setup-bar'); if (barEl) barEl.style.width = (done / items.length) * 100 + '%';
    const listEl = $('#setup-list'); if (listEl) listEl.innerHTML = items.map((item) => '<button class="setup-item' + (item.done ? ' done' : '') + '" type="button" data-action="' + item.action + '"><span class="setup-check" aria-hidden="true">' + (item.done ? '✓' : '') + '</span><span>' + esc(item.label) + '</span><span class="setup-arrow" aria-hidden="true">›</span></button>').join('');
    card.hidden = done === items.length;
  }

  function recentBackup() { const key = setting('last_backup'); if (!isDateKey(key)) return false; return (Date.now() - parseKey(key).getTime()) <= 30 * 86400000; }
  function renderBackupInfo() { const el = $('#last-backup'); if (!el) return; const key = setting('last_backup'); el.textContent = isDateKey(key) ? fmtDate(key) : 'nunca'; }

  function visibleJornadas() {
    let list = data.jornadas.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (ui.filter === 'confirmado') list = list.filter((j) => j.estado === 'confirmado'); else if (ui.filter === 'provisional') list = list.filter((j) => j.estado === 'provisional'); else if (ui.filter === 'extra') list = list.filter((j) => j.horas_extra > 0); else if (ui.filter === 'pendiente') list = list.filter((j) => j.estado === 'confirmado' && j.horas_extra > 0 && !j.pagado_extras);
    const q = ui.query.trim().toLowerCase(); if (q) list = list.filter((j) => (j.fecha + ' ' + j.notas + ' ' + j.estado).toLowerCase().indexOf(q) !== -1);
    return list;
  }

  function badgeFor(j) { const state = j.estado === 'provisional' ? '<span class="badge warn">Provisional</span>' : '<span class="badge ok">Confirmada</span>'; return state + (j.auto ? '<span class="badge info">Auto</span>' : ''); }

  function renderJornadas() {
    const provisional = data.jornadas.filter((j) => j.estado === 'provisional').length;
    const confirmAll = $('#confirm-all-btn');
    if (confirmAll) { confirmAll.hidden = provisional === 0; const label = $('#confirm-all-label'); if (label) label.textContent = provisional === 1 ? 'Confirmar 1 provisional' : 'Confirmar ' + provisional + ' provisionales'; }
    const all = visibleJornadas(); const shown = all.slice(0, ui.limit);
    const cards = $('#jornadas-cards'); const rows = $('#jornadas-rows'); const empty = $('#jornadas-empty'); const more = $('#load-more');
    const countEl = $('#jornadas-count'); if (countEl) countEl.textContent = all.length + (all.length === 1 ? ' jornada' : ' jornadas') + (shown.length < all.length ? ' (mostrando ' + shown.length + ')' : '') + (ui.query ? ' para «' + ui.query + '»' : '');
    if (!shown.length) { if (cards) cards.innerHTML = ''; if (rows) rows.innerHTML = ''; if (empty) { empty.hidden = false; empty.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-calendar"></use></svg><strong>Sin jornadas</strong>' + (ui.query || ui.filter !== 'all' ? 'Prueba otro filtro.' : 'Crea la primera con «Nueva».'); } if (more) more.hidden = true; return; }
    if (empty) empty.hidden = true;
    if (cards) cards.innerHTML = shown.map((j) => {
      const date = parseKey(j.fecha); const day = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); const weekday = date.toLocaleDateString('es-ES', { weekday: 'long' }); const clock = j.entrada && j.salida ? esc(j.entrada + ' – ' + j.salida) : (j.entrada ? esc(j.entrada + ' – …') : 'Sin fichaje'); const extra = j.horas_extra > 0 ? '<span class="x">+' + fmtHours(j.horas_extra) + '</span>' : '<span class="muted">—</span>';
      return '<article class="card day-card"><div class="top"><div><div class="day-date">' + esc(day) + '</div><div class="day-week">' + esc(weekday) + '</div></div>' + badgeFor(j) + '</div><div class="day-hours"><span class="mono">' + clock + '</span>' + extra + '</div><p class="sub" style="margin:0 0 8px">' + fmtHours(j.horas_normales) + ' normales' + (j.descanso_minutos ? ' · pausa ' + j.descanso_minutos + ' min' : '') + '</p>' + (j.notas ? '<p class="notes">' + esc(j.notas) + '</p>' : '') + '<div class="day-actions" style="margin-top:10px"><button class="btn ghost sm" type="button" data-action="add-extra" data-id="' + esc(j.id) + '"><svg class="i"><use href="#i-plus"></use></svg> Extra</button><button class="btn ghost sm" type="button" data-action="edit-jornada" data-id="' + esc(j.id) + '"><svg class="i"><use href="#i-pen"></use></svg> Editar</button></div></article>';
    }).join('');
    if (rows) rows.innerHTML = shown.map((j) => {
      const date = parseKey(j.fecha); const clock = j.entrada && j.salida ? esc(j.entrada + ' – ' + j.salida) : (j.entrada ? esc(j.entrada + ' – …') : '<span class="muted">Sin fichaje</span>');
      return '<tr><td><div class="t-date">' + esc(date.toLocaleDateString('es-ES')) + '</div><div class="t-week">' + esc(date.toLocaleDateString('es-ES', { weekday: 'short' })) + '</div></td><td class="mono">' + clock + (j.descanso_minutos ? '<div class="t-week">Pausa ' + j.descanso_minutos + ' min</div>' : '') + '</td><td class="t-num">' + hoursFmt.format(j.horas_normales) + '</td><td class="t-num" style="color:' + (j.horas_extra > 0 ? 'var(--brand)' : 'var(--muted)') + '">' + (j.horas_extra > 0 ? '+' + hoursFmt.format(j.horas_extra) : '—') + '</td><td>' + badgeFor(j) + '</td><td><div class="t-actions"><button class="icon-btn" type="button" data-action="add-extra" data-id="' + esc(j.id) + '" aria-label="Añadir extra"><svg class="i"><use href="#i-plus"></use></svg></button><button class="icon-btn" type="button" data-action="edit-jornada" data-id="' + esc(j.id) + '" aria-label="Editar"><svg class="i"><use href="#i-pen"></use></svg></button></div></td></tr>';
    }).join('');
    if (more) more.hidden = all.length <= ui.limit;
  }

  function renderTrips() {
    const list = data.viajes.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)); const box = $('#trips-list'); const empty = $('#trips-empty');
    if (!box) return;
    if (!list.length) { box.innerHTML = ''; if (empty) { empty.hidden = false; empty.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-car"></use></svg><strong>Sin viajes</strong>Añade dietas o kilometraje.'; } return; }
    if (empty) empty.hidden = true;
    box.innerHTML = list.map((v) => {
      const paid = v.pagado === 1;
      return '<div class="row" style="--edge:' + (paid ? 'var(--ok)' : 'var(--bad)') + '"><div class="main"><p class="title">' + esc(v.concepto) + '</p><p class="sub"><span>' + esc(fmtDate(v.fecha)) + '</span>' + (v.notas ? '<span>' + esc(v.notas) + '</span>' : '') + '<span class="badge ' + (paid ? 'ok' : 'bad') + '">' + (paid ? 'Cobrado' : 'Pendiente') + '</span></p></div><div class="row-actions"><span class="amount">' + fmtMoney(v.importe) + '</span>' + (paid ? '<button class="btn ghost sm" type="button" data-action="unmark-trip" data-id="' + esc(v.id) + '">Deshacer</button>' : '<button class="btn primary sm" type="button" data-action="mark-trip" data-id="' + esc(v.id) + '">Cobrado</button>') + '<button class="icon-btn" type="button" data-action="edit-trip" data-id="' + esc(v.id) + '" aria-label="Editar"><svg class="i"><use href="#i-pen"></use></svg></button><button class="icon-btn bad" type="button" data-action="delete-trip" data-id="' + esc(v.id) + '" aria-label="Eliminar"><svg class="i"><use href="#i-trash"></use></svg></button></div></div>';
    }).join('');
  }

  function renderPagos() {
    const t = totals();
    const el1 = $('#sum-pending-payrolls'); if (el1) el1.textContent = fmtMoney(t.payrollPending);
    const el2 = $('#sum-pending-extras'); if (el2) el2.textContent = fmtMoney(t.extraPending);
    const el3 = $('#sum-paid'); if (el3) el3.textContent = fmtMoney(t.collected);
    const products = data.pagos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    const subEl = $('#sum-pending-payrolls-sub'); if (subEl) subEl.textContent = products.filter((p) => !p.confirmado && p.tipo === 'nomina_auto').length + ' sin confirmar';
    const payroll = $('#payroll-list');
    if (payroll) {
      if (!products.length) { payroll.innerHTML = '<div class="empty" style="padding:22px"><strong>Sin nóminas</strong>Se generan al añadir jornadas.</div>'; }
      else {
        payroll.innerHTML = products.map((p) => {
          const ok = p.confirmado; const meta = [fmtMonth(p.mes_key || p.fecha.slice(0, 7))]; if (p.dias_laborables) meta.push(p.dias_laborables + ' días'); if (p.horas_normales_mes) meta.push(fmtHours(p.horas_normales_mes));
          return '<div class="row" style="--edge:' + (ok ? 'var(--ok)' : 'var(--warn)') + '"><div class="main"><p class="title">' + esc(p.concepto) + '</p><p class="sub">' + esc(meta.join(' · ')) + ' <span class="badge ' + (p.tipo === 'nomina_auto' ? 'info' : 'muted') + '">' + (p.tipo === 'nomina_auto' ? 'Auto' : 'Manual') + '</span></p></div><div class="row-actions"><span class="amount">' + fmtMoney(p.importe) + '</span><button class="btn ghost sm" type="button" data-action="' + (ok ? 'unconfirm-payroll' : 'confirm-payroll') + '" data-id="' + esc(p.id) + '">' + (ok ? 'Deshacer' : 'Confirmar') + '</button><button class="icon-btn" type="button" data-action="edit-payroll" data-id="' + esc(p.id) + '" aria-label="Editar"><svg class="i"><use href="#i-pen"></use></svg></button><button class="icon-btn bad" type="button" data-action="delete-payroll" data-id="' + esc(p.id) + '" aria-label="Eliminar"><svg class="i"><use href="#i-trash"></use></svg></button></div></div>';
        }).join('');
      }
    }
    const extras = data.jornadas.filter((j) => j.estado === 'confirmado' && j.horas_extra > 0).sort((a, b) => b.fecha.localeCompare(a.fecha)); const box = $('#extras-list');
    const totalHours = round2(extras.reduce((sum, j) => sum + j.horas_extra, 0)); const totEl = $('#extras-total'); if (totEl) totEl.textContent = fmtHours(totalHours);
    if (!box) return;
    if (!extras.length) { box.innerHTML = '<div class="empty" style="padding:22px"><strong>Sin horas extra</strong>Añádelas desde una jornada.</div>'; return; }
    box.innerHTML = extras.map((j) => {
      const paid = j.pagado_extras; const value = round2(j.horas_extra * rateOn(j.fecha, 'extra'));
      return '<div class="row" style="--edge:' + (paid ? 'var(--ok)' : 'var(--bad)') + '"><div class="main"><p class="title">' + esc(fmtDate(j.fecha)) + ' · +' + fmtHours(j.horas_extra) + '</p><p class="sub">' + fmtMoney(value) + ' · <span class="badge ' + (paid ? 'ok' : 'bad') + '">' + (paid ? 'Pagado' : 'Pendiente') + '</span></p></div><div class="row-actions">' + (paid ? '<button class="btn ghost sm" type="button" data-action="mark-extra-unpaid" data-id="' + esc(j.id) + '">Deshacer</button>' : '<button class="btn primary sm" type="button" data-action="mark-extra-paid" data-id="' + esc(j.id) + '">Pagado</button>') + '</div></div>';
    }).join('');
  }

  function extraPaymentModal(month) {
    if (!/^\d{4}-\d{2}$/.test(String(month)) || !isDateKey(String(month) + '-01')) { toast('No se reconoce el mes.', 'warn'); return; }
    const key = 'overtime_received_' + month;
    const saved = setting(key, '');
    const hasSaved = saved !== '' && Number.isFinite(num(saved, NaN));
    openModal({
      title: 'Pago real de horas extra · ' + fmtMonth(month),
      saveText: 'Guardar importe',
      body: '<label class="field"><span>Total recibido por estas horas</span><input class="input" id="extra-paid-amount" type="text" inputmode="decimal" autocomplete="off" value="' + esc(hasSaved ? fmtInput(num(saved, 0)) : '') + '" placeholder="Ej.: 125,50 €"></label><p class="hint">Introduce el total acumulado recibido por las horas extra de este mes. Si te lo han pagado en varias partes, suma los importes. Se comparará con las horas confirmadas y su tarifa histórica; este dato no cambia las horas marcadas como pagadas en la app.</p>',
      onSave: () => {
        const raw = String($('#extra-paid-amount').value || '').trim();
        if (!raw) { removeSetting(key); return persist('Importe recibido eliminado'); }
        const amount = num(raw, NaN);
        if (!Number.isFinite(amount) || amount < 0) { toast('Escribe un importe válido igual o superior a 0 €.', 'error'); return false; }
        setSetting(key, round2(amount).toFixed(2));
        return persist('Importe recibido guardado');
      },
      onDelete: hasSaved ? () => { removeSetting(key); return persist('Importe recibido eliminado'); } : null
    });
  }

  function renderLogoPreview() {
    const logo = setting('custom_logo') || './assets/ivory37-logo.jpg'; const img = $('#logo-preview'); const placeholder = $('#logo-placeholder'); if (!img || !placeholder) return;
    img.src = logo; img.hidden = false; placeholder.hidden = true;
    const logoBg = setting('logo_bg') === 'light' ? 'light' : 'dark';
    $$('[data-action="logo-bg"]').forEach((btn) => { btn.setAttribute('aria-pressed', String(btn.dataset.bg === logoBg)); });
  }

  function renderAjustes() {
    const setVal = (id, val) => { const el = $(id); if (el) el.value = val; };
    setVal('#cfg-name', 'Control Laboral');
    setVal('#cfg-color', /^#[0-9a-f]{6}$/i.test(setting('app_color')) ? setting('app_color') : '#a6d94a');
    setVal('#cfg-color-hex', $('#cfg-color') ? $('#cfg-color').value : '#a6d94a');
    const today = dateKey(new Date());
    setVal('#cfg-normal', fmtInput(rateOn(today, 'normal')));
    setVal('#cfg-extra', fmtInput(rateOn(today, 'extra')));
    setVal('#cfg-day', fmtInput(rateOn(today, 'jornada')));
    setVal('#cfg-rate-date', today);
    setVal('#cfg-schedule', setting('horario_habitual'));
    setVal('#cfg-break', String(habitualPauseMinutes()));
    setVal('#cfg-user-name', setting('user_name'));
    setVal('#cfg-user-role', setting('user_role') || 'Control laboral');
    ratesDirty = false;
    const est = $('#cfg-estimation'); if (est) est.checked = isEstimation();
    const auto = $('#cfg-auto-fichaje'); if (auto) auto.checked = isAutoFichaje();
    renderLogoPreview(); renderRateHistory(); renderDataTools(); renderNotifState(); renderSyncConflicts();
  }

  function renderRateHistory() {
    const box = $('#rate-history-list'); if (!box) return;
    const rows = rateHistory().slice().reverse();
    if (!rows.length) { box.innerHTML = '<p class="muted small" style="margin:0">Aún no hay cambios históricos. Al guardar, se conservará la tarifa actual como base para las fechas anteriores.</p>'; return; }
    const today = dateKey(new Date());
    const active = rows.filter((item) => item.desde <= today)[0];
    box.innerHTML = '<p class="eyebrow" style="margin:8px 0 0">Histórico de tarifas</p>' + rows.map((item) => {
      const label = item.desde === '1970-01-01' ? 'Tarifa base anterior al histórico' : 'Desde ' + fmtDate(item.desde);
      const state = item.desde > today ? 'Programada' : active && active.desde === item.desde ? 'Vigente' : 'Histórica';
      return '<div class="row"><div class="main"><p class="title">' + esc(label) + ' <span class="badge info">' + state + '</span></p><p class="sub">Normal ' + fmtMoney(item.normal) + '/h · Extra ' + fmtMoney(item.extra) + '/h · Jornada ' + fmtHours(item.jornada) + '</p></div><div class="row-actions"><button class="btn ghost sm" type="button" data-action="load-rate" data-date="' + esc(item.desde) + '">Editar</button>' + (item.desde === '1970-01-01' ? '' : '<button class="icon-btn bad" type="button" data-action="delete-rate" data-date="' + esc(item.desde) + '" aria-label="Eliminar tarifa de ' + esc(fmtDate(item.desde)) + '"><svg class="i"><use href="#i-trash"></use></svg></button>') + '</div></div>';
    }).join('');
  }

  function renderCalendar() {
    const box = $('#calendar-list'); const empty = $('#calendar-empty'); if (!box) return;
    const rows = data.ausencias.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (!rows.length) { box.innerHTML = ''; if (empty) { empty.hidden = false; empty.innerHTML = '<strong>Sin incidencias</strong>Añade descansos, vacaciones, bajas o festivos.'; } return; }
    if (empty) empty.hidden = true;
    const groups = new Map();
    rows.forEach((item) => { const key = String(item.grupo || item.id); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); });
    box.innerHTML = Array.from(groups.values()).map((items) => {
      const ordered = items.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)); const item = ordered[0];
      const range = ordered.length > 1 ? fmtDate(ordered[0].fecha) + ' – ' + fmtDate(ordered[ordered.length - 1].fecha) + ' · ' + ordered.length + ' días' : fmtDate(item.fecha);
      const worked = data.jornadas.some((j) => ordered.some((entry) => entry.fecha === j.fecha));
      return '<div class="row"><div class="main"><p class="title">' + esc(calendarLabel(item.tipo)) + ' · ' + esc(range) + '</p><p class="sub">' + esc(item.concepto || calendarLabel(item.tipo)) + (item.notas ? ' · ' + esc(item.notas) : '') + (worked ? ' · Jornada registrada en el periodo' : '') + '</p></div><div class="row-actions"><button class="icon-btn" type="button" data-action="edit-calendar" data-id="' + esc(item.id) + '" aria-label="Editar incidencia"><svg class="i"><use href="#i-pen"></use></svg></button><button class="icon-btn bad" type="button" data-action="delete-calendar" data-id="' + esc(item.id) + '" aria-label="Eliminar incidencia"><svg class="i"><use href="#i-trash"></use></svg></button></div></div>';
    }).join('');
  }

  function conflictItemLabel(collection, item) {
    if (!item) return 'Registro no disponible';
    if (collection === 'jornadas') return fmtDate(item.fecha) + ' · ' + fmtHours(item.horas_normales) + ' normales + ' + fmtHours(item.horas_extra) + ' extra' + (item.notas ? ' · ' + item.notas : '');
    if (collection === 'viajes') return fmtDate(item.fecha) + ' · ' + (item.concepto || 'Viaje') + ' · ' + fmtMoney(item.importe);
    if (collection === 'pagos') return fmtDate(item.fecha) + ' · ' + (item.concepto || 'Pago') + ' · ' + fmtMoney(item.importe);
    return fmtDate(item.fecha) + ' · ' + calendarLabel(item.tipo) + (item.concepto ? ' · ' + item.concepto : '');
  }

  function conflictDifferences(chosen, alternate) {
    const technicalFields = new Set(['creado', 'created', 'actualizado']);
    const labels = { id: 'Identificador', fecha: 'Fecha', entrada: 'Entrada', salida: 'Salida', horas_normales: 'Horas normales', horas_extra: 'Horas extra', descanso_minutos: 'Pausa', estado: 'Estado', notas: 'Notas', pagado_extras: 'Extras pagadas', fecha_pago_extras: 'Fecha de pago de extras', auto: 'Fichaje automático', backfill: 'Jornada completada', concepto: 'Concepto', importe: 'Importe', pagado: 'Pagado', fecha_pago: 'Fecha de pago', tipo: 'Tipo', mes_key: 'Mes', confirmado: 'Confirmado', horas_normales_mes: 'Horas normales del mes', horas_extra_mes: 'Horas extra del mes', dias_laborables: 'Días laborables', manual_edit: 'Edición manual', grupo: 'Grupo' };
    const stable = (value) => {
      if (Array.isArray(value)) return value.map(stable);
      if (!value || typeof value !== 'object') return value;
      return Object.keys(value).filter((key) => !technicalFields.has(key)).sort().reduce((result, key) => { result[key] = stable(value[key]); return result; }, {});
    };
    const keys = new Set(Object.keys(chosen || {}).concat(Object.keys(alternate || {})));
    return Array.from(keys).filter((key) => !technicalFields.has(key) && JSON.stringify(stable(chosen && chosen[key])) !== JSON.stringify(stable(alternate && alternate[key])))
      .map((key) => labels[key] || key.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase()));
  }

  function renderSyncConflicts() {
    const box = $('#sync-conflicts'); if (!box) return;
    const conflicts = window.IVORY37CloudSync?.getConflicts() || [];
    const pending = conflicts.filter((item) => !item.resolved).slice().reverse();
    if (!pending.length) { box.innerHTML = conflicts.length ? '<p class="muted small" style="margin:0">Conflictos revisados: ' + conflicts.length + '</p>' : ''; return; }
    box.innerHTML = '<p class="eyebrow" style="margin:8px 0 0">Revisar cambios entre dispositivos</p>' + pending.map((item) => '<div class="row" style="--edge:var(--warn)"><div class="main"><p class="title">' + esc(({ jornadas: 'Jornada', viajes: 'Viaje', pagos: 'Pago', ausencias: 'Incidencia' })[item.collection] || 'Registro') + ' · dos versiones</p><p class="sub"><b>Campos distintos:</b> ' + esc(conflictDifferences(item.chosen, item.alternate).join(' · ') || 'Ninguno (solo metadatos)') + '<br><b>Versión aplicada:</b> ' + esc(conflictItemLabel(item.collection, item.chosen)) + '<br><b>Versión alternativa:</b> ' + esc(conflictItemLabel(item.collection, item.alternate)) + '</p></div><div class="row-actions"><button class="btn ghost sm" type="button" data-action="resolve-conflict" data-id="' + esc(item.id) + '" data-choice="keep">Conservar aplicada</button><button class="btn primary sm" type="button" data-action="resolve-conflict" data-id="' + esc(item.id) + '" data-choice="restore">Restaurar alternativa</button></div></div>').join('');
  }

  function applyBrandColor(value) {
    const theme = themeTools.resolveColor(value);
    const root = document.documentElement.style;
    root.setProperty('--brand', theme.color);
    root.setProperty('--brand-rgb', theme.rgb.join(', '));
    root.setProperty('--brand-contrast', theme.contrast);
    return theme;
  }

  function applyBranding() {
    const name = 'Control Laboral';
    const color = applyBrandColor(setting('app_color')).color;
    document.title = name;
    $$('.brand-name').forEach((el) => { el.textContent = name; });
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', color);
    const logo = setting('custom_logo') || './assets/ivory37-logo.jpg'; const favicon = $('#favicon');
    if (favicon) favicon.setAttribute('href', setting('custom_logo') || './brand-icon.svg');
    const darkBg = setting('logo_bg') !== 'light'; const wideLogo = num(setting('logo_ratio'), 1) >= 1.6;
    $$('.brand-mark').forEach((mark) => {
      const img = mark.querySelector('.brand-logo'); const icon = mark.querySelector('.brand-icon');
      mark.classList.toggle('has-logo', Boolean(logo)); mark.classList.toggle('logo-on-dark', darkBg); mark.classList.toggle('logo-wide', Boolean(logo) && wideLogo);
      if (!img) return; if (logo) { img.src = logo; img.hidden = false; if (icon) icon.hidden = true; } else { img.hidden = true; img.removeAttribute('src'); if (icon) icon.hidden = false; }
    });
    applyProfile();
  }

  let logoRatioProbe = false;
  function probeLogoRatio() {
    const logo = setting('custom_logo'); if (!logo || logoRatioProbe) return; logoRatioProbe = true;
    let img; try { img = new Image(); } catch (err) { logoRatioProbe = false; return; }
    const reset = () => { logoRatioProbe = false; };
    const timer = setTimeout(reset, 4000);
    img.onload = () => { clearTimeout(timer); logoRatioProbe = false; if (setting('custom_logo') !== logo) return; setSetting('logo_ratio', String(round2(img.width / Math.max(1, img.height)))); try { localStorage.setItem(KEY, JSON.stringify(data)); window.IVORY37CloudSync?.queue(data); } catch (err) {} applyBranding(); renderLogoPreview(); };
    img.onerror = () => { clearTimeout(timer); logoRatioProbe = false; };
    img.src = logo;
  }

  function applyProfile() {
    const fallback = 'Control Laboral';
    const name = String(setting('user_name') || '').trim() || fallback;
    const role = String(setting('user_role') || '').trim() || 'Control laboral';
    const avatarRaw = setting('user_avatar'); const logo = setting('custom_logo');
    const explicitAvatar = avatarRaw && avatarRaw !== '@logo' && isSafeImage(avatarRaw) ? avatarRaw : '';
    const logoSquare = Boolean(logo) && num(setting('logo_ratio'), 1) <= 1.6;
    const useLogo = !explicitAvatar && logoSquare; const src = explicitAvatar || (useLogo ? logo : '');
    const nameEl = $('#profile-name'); if (nameEl) { nameEl.textContent = name; nameEl.title = name; }
    const roleEl = $('#profile-role'); if (roleEl) { roleEl.textContent = role; roleEl.title = role; }
    const heroName = $('#hero-name'); if (heroName) heroName.textContent = name;
    const wrap = $('#profile-avatar'); const img = $('#profile-img'); const initial = $('#profile-initials');
    if (wrap && img && initial) { wrap.classList.toggle('logo', useLogo); if (src) { img.src = src; img.hidden = false; initial.hidden = true; } else { img.hidden = true; img.removeAttribute('src'); initial.hidden = false; initial.textContent = initials(name); } }
    const mobileWrap = $('#profile-avatar-mobile'); const mobileImg = $('#profile-img-mobile'); const mobileInitial = $('#profile-initials-mobile');
    if (mobileWrap && mobileImg && mobileInitial) { mobileWrap.classList.toggle('logo', useLogo); if (src) { mobileImg.src = src; mobileImg.hidden = false; mobileInitial.hidden = true; } else { mobileImg.hidden = true; mobileImg.removeAttribute('src'); mobileInitial.hidden = false; mobileInitial.textContent = initials(name); } }
    const preview = $('#cfg-avatar'); const previewImg = $('#cfg-avatar-img'); const previewInitial = $('#cfg-avatar-initials');
    if (preview && previewImg && previewInitial) { preview.classList.toggle('logo', useLogo); if (src) { previewImg.src = src; previewImg.hidden = false; previewInitial.hidden = true; } else { previewImg.hidden = true; previewImg.removeAttribute('src'); previewInitial.hidden = false; previewInitial.textContent = initials(name); } }
  }

  function updateStorageUsage() { let kb = 0; try { kb = Math.round(new Blob([JSON.stringify(data)]).size / 1024); } catch (err) { kb = 0; } const text = kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB'; $$('[data-storage]').forEach((el) => { el.textContent = text; }); }

  function showTab(tab) {
    if (!['dashboard', 'jornadas', 'viajes', 'pagos', 'ajustes'].includes(tab)) tab = 'dashboard';
    ui.tab = tab; ui.limit = 30;
    $$('[data-tab-panel]').forEach((section) => { section.hidden = section.dataset.tabPanel !== tab; });
    $$('[data-action="tab"]').forEach((btn) => { const active = btn.dataset.tab === tab; btn.classList.toggle('active', active); if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current'); });
    if (tab === 'ajustes') renderAjustes();
    if (location.hash.slice(1) !== tab) { try { history.replaceState(null, '', '#' + tab); } catch (err) {} }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function toast(message, type) {
    const box = $('#toast'); const text = $('#toast-text'); if (!box || !text) return; const icon = box.querySelector('use');
    text.textContent = message;
    box.className = 'toast show ' + (type === 'warn' ? 'warn' : type === 'error' ? 'error' : type === 'info' ? 'info' : '');
    if (icon) icon.setAttribute('href', type === 'warn' || type === 'error' || type === 'info' ? '#i-alert' : '#i-check');
    clearTimeout(toast._timer); toast._timer = setTimeout(() => { box.classList.remove('show'); }, 3200);
  }

  function openModal(options) {
    lastFocus = document.activeElement; modalSave = options.onSave || null; modalDelete = options.onDelete || null;
    $('#modal-title').textContent = options.title || ''; $('#modal-body').innerHTML = options.body || '';
    const save = $('#modal-save'); save.textContent = options.saveText || 'Guardar'; save.className = 'btn ' + (options.danger ? 'danger' : 'primary'); save.hidden = Boolean(options.hideSave);
    $('#modal-delete').hidden = !modalDelete; $('#modal').hidden = false; document.body.style.overflow = 'hidden';
    setTimeout(() => { const first = $('#modal-body input:not([type="hidden"]), #modal-body select, #modal-body textarea, #modal-save:not([hidden])'); if (first) first.focus(); }, 40);
  }

  function closeModal() { $('#modal').hidden = true; document.body.style.overflow = ''; modalSave = null; modalDelete = null; if (lastFocus && lastFocus.focus) lastFocus.focus(); }

  function confirmAction(title, message, confirmText, onConfirm, danger) {
    openModal({ title, body: '<p class="muted" style="white-space:pre-line">' + esc(message) + '</p>', saveText: confirmText || 'Confirmar', danger: Boolean(danger), onSave: () => onConfirm() });
  }

  function clockIn() {
    const now = new Date(); const today = dateKey(now); const time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    let j = openJornadaForDate(today) || data.jornadas.find((x) => x.fecha === today && !x.entrada && !x.salida);
    if (!j && jornadaForDate(today)?.salida) { toast('La jornada ya está cerrada. Edítala si necesitas corregirla.', 'warn'); return; }
    if (!j) { j = { id: uid(), fecha: today, entrada: time, salida: '', horas_normales: 0, horas_extra: 0, descanso_minutos: habitualPauseMinutes(), estado: 'confirmado', notas: '[Fichado en la app]', pagado_extras: false, fecha_pago_extras: '', auto: false, backfill: false, creado: now.toISOString() }; data.jornadas.push(j); }
    else { if (!j.entrada) j.descanso_minutos = habitualPauseMinutes(); j.entrada = time; j.estado = 'confirmado'; if (!j.notas) j.notas = '[Fichado en la app]'; }
    j.auto = false; j.backfill = false;
    persist('Entrada registrada a las ' + time);
  }

  function clockOut() {
    const now = new Date(); const today = dateKey(now); const yesterday = dateKey(addDays(now, -1)); const time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    let j = openJornadaForDate(today);
    if (!j) j = openJornadaForDate(yesterday);
    if (!j) { toast('Primero registra la entrada.', 'warn'); return; }
    if (j.salida) { toast('Ya has fichado la salida.', 'warn'); return; }
    const elapsed = minutesBetween(j.entrada, time);
    if (elapsed == null) { toast('Revisa la hora de entrada.', 'error'); return; }
    const pauseMinutes = recordPauseMinutes(j);
    if (pauseMinutes > elapsed) { toast('La pausa supera el tiempo fichado. Edita la pausa de la jornada antes de cerrar.', 'error'); return; }
    const worked = round2((elapsed - pauseMinutes) / 60);
    const base = rateOn(j.fecha, 'jornada');
    j.salida = time; j.horas_normales = round2(Math.min(worked, base)); j.horas_extra = round2(Math.max(0, worked - base)); j.estado = 'confirmado';
    if (worked < base) { const short = round2(base - worked); j.notas = (j.notas ? j.notas + ' | ' : '') + 'Salida anticipada: ' + fmtHours(short) + ' menos.'; }
    j.auto = false; j.backfill = false;
    if (!persist('Salida a las ' + time + ' · ' + fmtHours(worked))) return;
    notify('Jornada cerrada', 'Has trabajado ' + fmtHours(worked) + ' hoy.');
  }

  function applyAutoClose(j, win, note) { const base = rateOn(j.fecha, 'jornada'); const gross = hoursBetween(win.start, win.end); const scheduled = round2(Math.max(0, (gross == null ? base : gross) - recordPauseMinutes(j) / 60)); j.salida = win.end; j.horas_normales = round2(Math.min(scheduled, base)); j.horas_extra = round2(Math.max(j.horas_extra, Math.max(0, scheduled - base))); j.estado = 'confirmado'; j.notas = (j.notas ? j.notas + ' | ' : '') + note; }

  function autoFichaje() {
    if (!isAutoFichaje() || loadError) return; const modalEl = $('#modal'); if (!modalEl || !modalEl.hidden) return;
    const win = scheduleWindow(); if (!win || win.overnight) return;
    const now = new Date(); const today = dateKey(now); const nowMin = now.getHours() * 60 + now.getMinutes();
    const weekAgo = dateKey(addDays(now, -7)); const openPrevious = data.jornadas.find((j) => j.auto && j.entrada && !j.salida && j.fecha < today && j.fecha >= weekAgo);
    if (openPrevious) { applyAutoClose(openPrevious, win, '[AUTO] Cierre automático de jornada anterior.'); persist('Jornada anterior cerrada automáticamente'); return; }
    if (now.getDay() === 0 || now.getDay() === 6 || calendarEntryOn(today)) return; if (setting('auto_dismissed') === today) return;
    const j = data.jornadas.find((item) => item.fecha === today && item.auto);
    if (data.jornadas.some((item) => item.fecha === today && !item.auto && item.entrada && item.salida)) return;
    if (j && j.entrada && !j.salida && nowMin >= win.endMin) { applyAutoClose(j, win, '[AUTO] Salida automática.'); persist('Jornada cerrada automáticamente'); return; }
    if (!data.jornadas.some((item) => item.fecha === today) && nowMin >= win.startMin && nowMin <= win.startMin + 30) { data.jornadas.push({ id: uid(), fecha: today, entrada: win.start, salida: '', horas_normales: 0, horas_extra: 0, descanso_minutos: habitualPauseMinutes(), estado: 'confirmado', notas: '[AUTO] Entrada automática (' + win.start + '–' + win.end + ').', pagado_extras: false, fecha_pago_extras: '', auto: true, backfill: false, creado: now.toISOString() }); persist('Entrada fichada automáticamente'); }
  }

  function fillToday() {
    const win = scheduleWindow() || { start: '08:00', end: '16:00', hours: 8 };
    const today = dateKey(new Date());
    if (data.jornadas.some((j) => j.fecha === today)) { toast('Ya hay una jornada registrada hoy.', 'warn'); return; }
    const pauseMinutes = habitualPauseMinutes(); const scheduled = round2(Math.max(0, (win.hours || dayHours()) - pauseMinutes / 60)); const normal = round2(Math.min(scheduled, dayHours())); const extra = round2(Math.max(0, scheduled - dayHours()));
    confirmAction('Completar hoy', 'Se creará la jornada de hoy de ' + win.start + ' a ' + win.end + '.', 'Crear', () => {
      data.jornadas.push({ id: uid(), fecha: today, entrada: win.start, salida: win.end, horas_normales: normal, horas_extra: extra, descanso_minutos: pauseMinutes, estado: 'confirmado', notas: '[AUTO] Jornada según horario.', pagado_extras: false, fecha_pago_extras: '', auto: true, backfill: false, creado: new Date().toISOString() });
      persist('Jornada creada');
    });
  }

  function fillMonth() {
    const missing = missingMonthDays(); if (!missing.length) { toast('No faltan días laborables este mes.', 'info'); return; }
    const month = monthKey(new Date());
    const confirmedPayroll = data.pagos.find((p) => p.tipo === 'nomina_auto' && p.mes_key === month && p.confirmado);
    if (confirmedPayroll) { toast('La nómina ya está confirmada. Deshazla antes.', 'warn'); return; }
    const win = scheduleWindow() || { start: '08:00', end: '16:00', hours: 8 };
    const estimationWasOn = isEstimation();
    const extraMsg = estimationWasOn ? '\n\nLa estimación se desactivará.' : '';
    confirmAction('Completar ' + fmtMonth(month), 'Se crearán ' + missing.length + ' jornadas.' + extraMsg, 'Crear ' + missing.length, () => {
      if (estimationWasOn) setSetting('estimation', '0');
      const stamp = new Date().toISOString();
      missing.forEach((day) => { const fecha = dateKey(day); const base = rateOn(fecha, 'jornada'); const pauseMinutes = habitualPauseMinutes(); const scheduled = round2(Math.max(0, (win.hours || base) - pauseMinutes / 60)); const normal = round2(Math.min(scheduled, base)); const extra = round2(Math.max(0, scheduled - base)); data.jornadas.push({ id: uid(), fecha, entrada: win.start, salida: win.end, horas_normales: normal, horas_extra: extra, descanso_minutos: pauseMinutes, estado: 'confirmado', notas: '[AUTO] Jornada completada.', pagado_extras: false, fecha_pago_extras: '', auto: true, backfill: true, creado: stamp }); });
      persist(missing.length + ' jornadas creadas');
    });
  }

  function jornadaModal(id) {
    if (!id) {
      const existingToday = jornadaForDate(dateKey(new Date()));
      if (existingToday) id = existingToday.id;
    }
    const isNew = !id; let j = isNew ? null : data.jornadas.find((x) => String(x.id) === String(id)); if (!isNew && !j) return;
    const today = dateKey(new Date()); const defaultPause = habitualPauseMinutes(); const base = { fecha: today, entrada: '', salida: '', horas_normales: round2(Math.max(0, rateOn(today, 'jornada') - defaultPause / 60)), horas_extra: 0, descanso_minutos: defaultPause, estado: 'confirmado', notas: '' }; const item = j || base;
    openModal({
      title: isNew ? 'Nueva jornada' : 'Editar jornada',
      body: '<div class="form-grid"><label class="field"><span>Fecha</span><input class="input" id="f-fecha" type="date" value="' + esc(item.fecha) + '"></label><label class="field"><span>Estado</span><select class="input" id="f-estado"><option value="confirmado"' + (item.estado === 'confirmado' ? ' selected' : '') + '>Confirmada</option><option value="provisional"' + (item.estado === 'provisional' ? ' selected' : '') + '>Provisional</option></select></label><label class="field"><span>Entrada</span><input class="input mono" id="f-entrada" type="time" value="' + esc(item.entrada) + '"></label><label class="field"><span>Salida</span><input class="input mono" id="f-salida" type="time" value="' + esc(item.salida) + '"></label><label class="field"><span>Pausa no computable (min)</span><input class="input mono" id="f-pausa" type="number" min="0" max="1440" step="1" value="' + esc(recordPauseMinutes(item)) + '"></label><label class="field"><span>Horas normales</span><input class="input mono" id="f-normales" type="text" inputmode="decimal" value="' + fmtInput(item.horas_normales) + '"></label><label class="field"><span>Horas extra</span><input class="input mono" id="f-extra" type="text" inputmode="decimal" value="' + fmtInput(item.horas_extra) + '"></label></div><div class="hint-row"><button class="btn ghost sm" type="button" id="calc-hours">Calcular desde fichaje</button><span class="muted small" id="calc-hint"></span></div><label class="field"><span>Notas</span><textarea class="input" id="f-notas" rows="3">' + esc(item.notas) + '</textarea></label>',
      onSave: () => {
        const fecha = $('#f-fecha').value; if (!isDateKey(fecha)) { toast('Fecha no válida.', 'error'); return false; }
        const normales = num($('#f-normales').value, -1); const extra = num($('#f-extra').value, -1); const pauseMinutes = num($('#f-pausa').value, -1);
        if (!Number.isInteger(pauseMinutes) || pauseMinutes < 0 || pauseMinutes > 1440) { toast('La pausa debe ser un número entero entre 0 y 1.440 minutos.', 'error'); return false; }
        if (normales < 0 || extra < 0 || normales > 24 || extra > 24) { toast('Horas entre 0 y 24.', 'error'); return false; }
        if (round2(normales + extra) > 24) { toast('No puede superar 24 h en un día.', 'error'); return false; }
        const payload = { fecha, entrada: hhmm($('#f-entrada').value), salida: hhmm($('#f-salida').value), horas_normales: round2(normales), horas_extra: round2(extra), descanso_minutos: pauseMinutes, estado: $('#f-estado').value === 'provisional' ? 'provisional' : 'confirmado', notas: $('#f-notas').value.trim(), auto: false, backfill: false };
        const duplicate = data.jornadas.find((row) => row.fecha === fecha && (!j || String(row.id) !== String(j.id)) && !row.auto);
        if (duplicate && (!j || j.fecha !== fecha)) { toast('Ya existe una jornada para esa fecha. Ábrela desde la lista y edítala para evitar duplicarla.', 'warn'); return false; }
        const elapsed = payload.entrada && payload.salida ? minutesBetween(payload.entrada, payload.salida) : null;
        if (payload.entrada && payload.salida && (!Number.isFinite(elapsed) || elapsed === 0)) { toast('Horario no válido: entrada y salida deben ser distintas.', 'error'); return false; }
        if (elapsed != null && pauseMinutes > elapsed) { toast('La pausa no puede superar el tiempo fichado.', 'error'); return false; }
        const automaticDuplicate = !j && data.jornadas.find((row) => row.fecha === fecha && row.auto);
        if (automaticDuplicate) j = automaticDuplicate;
        if (j) {
          const extrasChanged = round2(j.horas_extra) !== payload.horas_extra;
          Object.assign(j, payload);
          if (extrasChanged) { j.pagado_extras = false; j.fecha_pago_extras = ''; }
          data.jornadas = data.jornadas.filter((row) => row.fecha !== fecha || !row.auto || String(row.id) === String(j.id));
        } else data.jornadas.push(Object.assign({ id: uid(), pagado_extras: false, fecha_pago_extras: '', creado: new Date().toISOString() }, payload));
        return persist(isNew ? 'Jornada creada' : 'Jornada actualizada');
      },
      onDelete: j ? () => { if (j.fecha === dateKey(new Date()) && j.auto) setSetting('auto_dismissed', j.fecha); data.jornadas = data.jornadas.filter((x) => String(x.id) !== String(j.id)); return persist('Jornada eliminada'); } : null
    });
    const calc = $('#calc-hours');
    if (calc) calc.addEventListener('click', () => { const grossMinutes = minutesBetween($('#f-entrada').value, $('#f-salida').value); if (grossMinutes == null) { toast('Indica entrada y salida.', 'warn'); return; } const pauseMinutes = num($('#f-pausa').value, -1); if (!Number.isInteger(pauseMinutes) || pauseMinutes < 0 || pauseMinutes > grossMinutes) { toast('La pausa debe ser un número válido y no superar el tiempo fichado.', 'warn'); return; } const worked = netHoursBetween($('#f-entrada').value, $('#f-salida').value, pauseMinutes); const b = rateOn($('#f-fecha').value, 'jornada'); $('#f-normales').value = round2(Math.min(worked, b)); $('#f-extra').value = round2(Math.max(0, worked - b)); const hintEl = $('#calc-hint'); if (hintEl) hintEl.textContent = hoursFmt.format(grossMinutes / 60) + ' h fichadas − ' + pauseMinutes + ' min = ' + fmtHours(worked); toast('Horas calculadas.', 'info'); });
  }

  function extraModal(id) {
    const j = data.jornadas.find((x) => String(x.id) === String(id)); if (!j) return;
    openModal({
      title: 'Añadir horas extra', saveText: 'Añadir',
      body: '<div class="card" style="padding:12px;margin-bottom:14px;background:rgba(0,0,0,.2)"><p class="small muted" style="margin:0 0 2px">Jornada</p><strong>' + esc(fmtDate(j.fecha)) + '</strong><p class="small muted" style="margin:4px 0 0">Actualmente: <b style="color:var(--brand)">' + fmtHours(j.horas_extra) + '</b> (normales ' + fmtHours(j.horas_normales) + ')</p></div><label class="field"><span>Horas a añadir</span><input class="input mono" id="x-hours" type="text" inputmode="decimal" placeholder="1,5"></label><label class="field"><span>Motivo (opcional)</span><input class="input" id="x-note" maxlength="120"></label>',
      onSave: () => {
        const hours = num($('#x-hours').value, 0); if (hours <= 0 || hours > 12) { toast('Entre 0,25 y 12 horas.', 'error'); return false; }
        const totalDay = round2(j.horas_normales + j.horas_extra + hours);
        if (totalDay > 24) { toast('No puedes superar 24 h en un día (llevas ' + fmtHours(j.horas_normales + j.horas_extra) + ').', 'error'); return false; }
        const note = $('#x-note').value.trim();
        const wasPaid = j.pagado_extras;
        j.horas_extra = round2(j.horas_extra + hours);
        if (wasPaid) { j.pagado_extras = false; j.fecha_pago_extras = ''; }
        if (note) j.notas = (j.notas ? j.notas + ' | ' : '') + '+' + String(hours).replace('.', ',') + ' h: ' + note;
        return persist(wasPaid ? '+' + fmtHours(hours) + ' extra; revisa el nuevo pendiente de pago' : '+' + fmtHours(hours) + ' extra');
      }
    });
  }

  function calendarModal(id) {
    const existing = id ? data.ausencias.find((item) => String(item.id) === String(id)) : null;
    const item = existing || { fecha: dateKey(new Date()), tipo: 'vacaciones', concepto: '', notas: '' };
    const group = existing ? String(existing.grupo || existing.id) : uid();
    openModal({
      title: existing ? 'Editar incidencia' : 'Añadir al calendario',
      body: '<div class="form-grid"><label class="field"><span>Desde</span><input class="input" id="c-desde" type="date" value="' + esc(item.fecha) + '"></label><label class="field"><span>Hasta</span><input class="input" id="c-hasta" type="date" value="' + esc(item.fecha) + '"></label><label class="field"><span>Tipo</span><select class="input" id="c-tipo"><option value="descanso"' + (item.tipo === 'descanso' ? ' selected' : '') + '>Descanso</option><option value="vacaciones"' + (item.tipo === 'vacaciones' ? ' selected' : '') + '>Vacaciones</option><option value="baja"' + (item.tipo === 'baja' ? ' selected' : '') + '>Baja</option><option value="festivo"' + (item.tipo === 'festivo' ? ' selected' : '') + '>Festivo</option><option value="otro"' + (item.tipo === 'otro' ? ' selected' : '') + '>Otra incidencia</option></select></label></div><label class="field"><span>Nombre o motivo</span><input class="input" id="c-concepto" maxlength="80" value="' + esc(item.concepto) + '" placeholder="Opcional"></label><label class="field"><span>Notas</span><textarea class="input" id="c-notas" rows="2" maxlength="240">' + esc(item.notas) + '</textarea></label><p class="hint">La incidencia se guarda como anotación. No altera jornadas ya registradas ni calcula importes de vacaciones o bajas.</p>',
      onSave: () => {
        const from = $('#c-desde').value; const to = $('#c-hasta').value; const tipo = $('#c-tipo').value;
        if (!isDateKey(from) || !isDateKey(to) || from > to) { toast('Elige un periodo válido.', 'error'); return false; }
        const dates = window.IVORY37Calendar.datesInRange(from, to, parseKey, dateKey, addDays, 366);
        if (!dates.length) { toast('El periodo no puede superar un año.', 'error'); return false; }
        const conflicts = data.ausencias.filter((row) => dates.includes(row.fecha) && String(row.grupo || row.id) !== group);
        if (conflicts.length) { toast('Ya hay incidencias en ' + conflicts.length + ' fecha(s) del periodo. Edita o elimina esas fechas primero.', 'warn'); return false; }
        const payload = { tipo, concepto: $('#c-concepto').value.trim(), notas: $('#c-notas').value.trim() };
        if (existing) data.ausencias = data.ausencias.filter((row) => String(row.grupo || row.id) !== group);
        const created = new Date().toISOString();
        dates.forEach((fecha, index) => data.ausencias.push(Object.assign({ id: existing && index === 0 ? existing.id : uid(), grupo, fecha, creado: existing && index === 0 ? existing.creado : created }, payload)));
        return persist(existing ? 'Incidencia actualizada' : dates.length === 1 ? 'Fecha añadida al calendario' : dates.length + ' fechas añadidas al calendario');
      },
      onDelete: existing ? () => { data.ausencias = data.ausencias.filter((row) => String(row.grupo || row.id) !== group); return persist('Incidencia eliminada'); } : null
    });
  }

  function loadRateVersion(date) {
    const item = rateHistory().find((row) => row.desde === date); if (!item) return;
    const dateInput = $('#cfg-rate-date'); const normal = $('#cfg-normal'); const extra = $('#cfg-extra'); const day = $('#cfg-day');
    if (dateInput) dateInput.value = item.desde;
    if (normal) normal.value = fmtInput(item.normal);
    if (extra) extra.value = fmtInput(item.extra);
    if (day) day.value = fmtInput(item.jornada);
    ratesDirty = true;
    const card = $('#rates-card'); if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (normal) normal.focus();
  }

  function deleteRateVersion(date) {
    if (date === '1970-01-01') return;
    confirmAction('Eliminar tarifa histórica', 'Se quitará la tarifa efectiva desde ' + fmtDate(date) + '. Las jornadas se volverán a valorar con la tarifa anterior.', 'Eliminar tarifa', () => {
      const history = rateHistory().filter((item) => item.desde !== date);
      setSetting('tarifa_historial', JSON.stringify(history));
      const today = dateKey(new Date());
      const active = history.filter((item) => item.desde <= today).slice(-1)[0];
      if (active) { setSetting('hora_normal_euros', active.normal.toFixed(2)); setSetting('hora_extra_euros', active.extra.toFixed(2)); setSetting('horas_normales_dia', String(active.jornada)); }
      persist('Tarifa eliminada; se actualizarán los cálculos pendientes');
      renderAjustes();
    }, true);
  }

  function tripModal(id) {
    const isNew = !id; const v = isNew ? null : data.viajes.find((x) => String(x.id) === String(id)); if (!isNew && !v) return;
    const item = v || { fecha: dateKey(new Date()), concepto: '', importe: '', notas: '' };
    openModal({
      title: isNew ? 'Nuevo viaje' : 'Editar viaje',
      body: '<label class="field"><span>Concepto</span><input class="input" id="t-concepto" maxlength="80" value="' + esc(item.concepto) + '"></label><div class="form-grid"><label class="field"><span>Fecha</span><input class="input" id="t-fecha" type="date" value="' + esc(item.fecha) + '"></label><label class="field"><span>Importe (€)</span><input class="input mono" id="t-importe" type="text" inputmode="decimal" value="' + esc(fmtInput(item.importe)) + '"></label></div><label class="field"><span>Notas</span><input class="input" id="t-notas" maxlength="140" value="' + esc(item.notas) + '"></label>',
      onSave: () => {
        const concepto = $('#t-concepto').value.trim(); const fecha = $('#t-fecha').value; const importe = num($('#t-importe').value, -1);
        if (!concepto) { toast('Indica concepto.', 'error'); return false; } if (!isDateKey(fecha)) { toast('Fecha no válida.', 'error'); return false; } if (importe < 0) { toast('Importe no válido.', 'error'); return false; }
        const payload = { concepto, fecha, importe: round2(importe), notas: $('#t-notas').value.trim() };
        if (v) Object.assign(v, payload); else data.viajes.push(Object.assign({ id: uid(), pagado: 0, fecha_pago: '', creado: new Date().toISOString() }, payload));
        return persist(isNew ? 'Viaje añadido' : 'Viaje actualizado');
      },
      onDelete: v ? () => { data.viajes = data.viajes.filter((x) => String(x.id) !== String(v.id)); return persist('Viaje eliminado'); } : null
    });
  }

  function payrollModal(id) {
    const p = data.pagos.find((x) => String(x.id) === String(id)); if (!p) return;
    openModal({
      title: 'Editar nómina',
      body: '<label class="field"><span>Concepto</span><input class="input" id="p-concepto" maxlength="80" value="' + esc(p.concepto) + '"></label><div class="form-grid"><label class="field"><span>Importe (€)</span><input class="input mono" id="p-importe" type="text" inputmode="decimal" value="' + fmtInput(p.importe) + '"></label><label class="field"><span>Fecha</span><input class="input" id="p-fecha" type="date" value="' + esc(p.fecha) + '"></label></div>',
      onSave: () => {
        const concepto = $('#p-concepto').value.trim(); const importe = num($('#p-importe').value, -1); const fecha = $('#p-fecha').value;
        if (!concepto) { toast('Indica concepto.', 'error'); return false; } if (importe < 0) { toast('Importe no válido.', 'error'); return false; } if (!isDateKey(fecha)) { toast('Fecha no válida.', 'error'); return false; }
        if (importe !== p.importe) p.manual_edit = true;
        p.concepto = concepto; p.importe = round2(importe); p.fecha = fecha;
        if (p.tipo === 'nomina_auto') { const newMonth = fecha.slice(0, 7); if (newMonth !== p.mes_key) { p.mes_key = newMonth; p.concepto = 'Nómina ' + fmtMonth(newMonth); } }
        return persist('Nómina actualizada');
      },
      onDelete: () => { data.pagos = data.pagos.filter((x) => String(x.id) !== String(p.id)); return persist('Nómina eliminada'); }
    });
  }

  function pendingModal() {
    const unpaidExtras = data.jornadas.filter((j) => j.estado === 'confirmado' && j.horas_extra > 0 && !j.pagado_extras); const extraHours = round2(unpaidExtras.reduce((sum, j) => sum + j.horas_extra, 0)); const extraTotal = round2(unpaidExtras.reduce((sum, j) => sum + j.horas_extra * rateOn(j.fecha, 'extra'), 0));
    const pendingTrips = data.viajes.filter((v) => !v.pagado); const tripTotal = round2(pendingTrips.reduce((sum, v) => sum + v.importe, 0));
    const pendingPayrolls = data.pagos.filter((p) => p.tipo === 'nomina_auto' && !p.confirmado); const payrollTotal = round2(pendingPayrolls.reduce((sum, p) => sum + p.importe, 0));
    const total = round2(payrollTotal + extraTotal + tripTotal);
    const rows = [
      { label: 'Nóminas sin confirmar', detail: pendingPayrolls.length === 1 ? '1 nómina' : pendingPayrolls.length + ' nóminas', value: payrollTotal },
      { label: 'Horas extra sin pagar', detail: fmtHours(extraHours) + ' · tarifas aplicadas por fecha', value: extraTotal },
      { label: 'Viajes sin cobrar', detail: pendingTrips.length === 1 ? '1 viaje' : pendingTrips.length + ' viajes', value: tripTotal }
    ];
    openModal({ title: 'Composición de lo pendiente', hideSave: true, body: '<div class="detail-list">' + rows.map((r) => '<div class="detail-row"><div><span>' + esc(r.label) + '</span><small>' + esc(r.detail) + '</small></div><b>' + fmtMoney(r.value) + '</b></div>').join('') + '<div class="detail-row total"><div><span>Total a cobrar</span></div><b>' + fmtMoney(total) + '</b></div></div><p class="hint" style="margin:8px 0 0">Para reducirlo: confirma nóminas, marca extras pagadas y viajes cobrados.</p>' });
  }

  let nativeSaveSequence = 0;
  const nativeSaveCallbacks = new Map();
  window.__ivory37NativeSaveResult = function (requestId, saved) {
    const callback = nativeSaveCallbacks.get(String(requestId));
    if (!callback) return;
    nativeSaveCallbacks.delete(String(requestId));
    callback(Boolean(saved));
  };
  function download(blob, filename, onComplete) {
    const androidBridge = window.AndroidBridge;
    const desktopBridge = window.IVORY37DesktopBridge;
    if ((androidBridge && typeof androidBridge.saveFile === 'function') || (desktopBridge && typeof desktopBridge.saveFile === 'function')) {
      const reader = new FileReader();
      reader.onerror = function () { if (onComplete) onComplete(false); };
      reader.onload = function () {
        const dataUrl = String(reader.result || '');
        const separator = dataUrl.indexOf(',');
        if (separator < 0) { if (onComplete) onComplete(false); return; }
        const encoded = dataUrl.slice(separator + 1);
        if (desktopBridge && typeof desktopBridge.saveFile === 'function') {
          Promise.resolve(desktopBridge.saveFile(filename, blob.type || 'application/octet-stream', encoded))
            .then((saved) => { if (onComplete) onComplete(Boolean(saved)); })
            .catch(() => { if (onComplete) onComplete(false); });
          return;
        }
        const requestId = String(++nativeSaveSequence);
        if (onComplete) nativeSaveCallbacks.set(requestId, onComplete);
        try { androidBridge.saveFile(encoded, filename, blob.type || 'application/octet-stream', requestId); }
        catch (err) { nativeSaveCallbacks.delete(requestId); if (onComplete) onComplete(false); }
      };
      reader.readAsDataURL(blob);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (onComplete) setTimeout(() => onComplete(true), 250);
  }
  function markBackupSaved(payload) {
    setSetting('last_backup', dateKey(new Date()));
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      window.IVORY37CloudSync?.queue(data);
      mirrorNativeStorage();
      renderDataTools(); renderSetup();
      toast(window.AndroidBridge ? 'Backup guardado. Elige Descargas para encontrarlo.' : (window.IVORY37DesktopBridge ? 'Backup guardado en la ubicación elegida.' : 'Descarga iniciada. Busca el archivo en Descargas.'));
    } catch (err) {
      renderDataTools(); renderSetup();
      toast('El archivo se guardó, pero no se pudo actualizar la fecha de la copia.', 'warn');
    }
  }
  function exportJSON() {
    const fileDate = dateKey(new Date());
    const fileTime = pad(new Date().getHours()) + pad(new Date().getMinutes());
    const backup = backupTools.create(data, fileDate);
    const payload = JSON.stringify(backup, null, 2);
    download(new Blob([payload], { type: 'application/json' }), 'backup_' + fileDate + '_' + fileTime + '.json', function (saved) {
      if (!saved) { toast('No se guardó el backup. Elige una carpeta y confirma Guardar.', 'warn'); return; }
      markBackupSaved();
    });
  }

  function openReportModal() {
    const today = dateKey(new Date()); const from = today.slice(0, 7) + '-01';
    openModal({ title: 'Informe por periodo', hideSave: true, body: '<div class="form-grid"><label class="field"><span>Desde</span><input class="input" id="report-from" type="date" value="' + esc(from) + '"></label><label class="field"><span>Hasta</span><input class="input" id="report-to" type="date" value="' + esc(today) + '"></label></div><p class="hint">El informe incluye jornadas, tarifas aplicadas, incidencias y viajes del periodo elegido.</p><div class="hint-row"><button class="btn primary" type="button" data-action="report-pdf"><svg class="i" aria-hidden="true"><use href="#i-print"></use></svg> Guardar como PDF</button><button class="btn ghost" type="button" data-action="report-csv"><svg class="i" aria-hidden="true"><use href="#i-download"></use></svg> Exportar CSV</button></div>' });
  }

  function readReportRange() {
    const from = $('#report-from') && $('#report-from').value; const to = $('#report-to') && $('#report-to').value;
    if (!isDateKey(from) || !isDateKey(to) || from > to) { toast('Elige un periodo válido: la fecha inicial debe ser anterior a la final.', 'error'); return null; }
    return { from, to };
  }

  function exportCSV(from, to) {
    const rows = [['Tipo', 'Fecha', 'Entrada', 'Salida', 'Pausa no computable (min)', 'Horas normales', 'Horas extra', 'Tarifa normal €/h', 'Tarifa extra €/h', 'Estado', 'Extras pagadas', 'Concepto', 'Importe €', 'Notas']];
    data.jornadas.filter((j) => j.fecha >= from && j.fecha <= to).slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((j) => {
      const confirmed = j.estado === 'confirmado';
      rows.push(['Jornada', j.fecha, j.entrada, j.salida, String(j.descanso_minutos || 0), String(j.horas_normales).replace('.', ','), String(j.horas_extra).replace('.', ','), confirmed ? String(rateOn(j.fecha, 'normal')).replace('.', ',') : '', confirmed ? String(rateOn(j.fecha, 'extra')).replace('.', ',') : '', j.estado, j.pagado_extras ? 'Sí' : 'No', '', confirmed ? String(round2(j.horas_normales * rateOn(j.fecha, 'normal') + j.horas_extra * rateOn(j.fecha, 'extra'))).replace('.', ',') : '', j.notas]);
    });
    data.ausencias.filter((item) => item.fecha >= from && item.fecha <= to).forEach((item) => rows.push(['Incidencia · ' + calendarLabel(item.tipo), item.fecha, '', '', '', '', '', '', '', '', '', item.concepto, '', item.notas]));
    data.viajes.filter((item) => item.fecha >= from && item.fecha <= to).forEach((item) => rows.push(['Viaje/dieta', item.fecha, '', '', '', '', '', '', '', item.pagado ? 'Cobrado' : 'Pendiente', '', item.concepto, String(item.importe).replace('.', ','), item.notas]));
    data.pagos.filter((item) => item.fecha >= from && item.fecha <= to).forEach((item) => rows.push([item.tipo === 'nomina_auto' ? 'Nómina automática' : 'Pago manual', item.fecha, '', '', '', String(item.horas_normales_mes).replace('.', ','), String(item.horas_extra_mes).replace('.', ','), '', '', item.confirmado ? 'Confirmado' : 'Pendiente', '', item.concepto, String(item.importe).replace('.', ','), '']));
    const orderedRows = [rows[0]].concat(rows.slice(1).sort((a, b) => String(a[1]).localeCompare(String(b[1]))));
    const csv = window.IVORY37Reports.toCsv(orderedRows);
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'informe_' + from + '_' + to + '.csv', function (saved) { toast(saved ? (window.IVORY37DesktopBridge ? 'CSV guardado en la ubicación elegida.' : 'CSV guardado. Elige Descargas para encontrarlo.') : 'No se guardó el CSV.', saved ? 'info' : 'warn'); });
  }

  function importJSON(file) {
    if (!file) return; if (file.size > 5 * 1024 * 1024) { toast('Backup demasiado grande.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = backupTools.parse(reader.result, isDateKey);
        confirmAction('Restaurar copia', 'Se sustituirán los datos actuales.', 'Restaurar', () => {
          const previous = data; const previousLoadError = loadError;
          try { try { localStorage.setItem(KEY + '_backup', JSON.stringify(previous)); } catch (err) {} data = normalize(parsed); syncPayrolls(); localStorage.setItem(KEY, JSON.stringify(data)); window.IVORY37CloudSync?.queue(data); }
          catch (err) { data = previous; loadError = previousLoadError; toast('No se pudo guardar la copia. Tus datos actuales siguen intactos.', 'error'); return; }
          loadError = false; applyBranding(); renderAll(); renderAjustes(); window.IVORY37CloudSync?.init(data); window.IVORY37CloudSync?.queue(data); toast('Datos restaurados.');
        });
      } catch (err) { toast(err && err.message === 'Fecha' ? 'El backup contiene fechas imposibles; no se cambiaron tus datos.' : 'Backup no válido.', 'error'); }
    };
    reader.onerror = () => toast('No se pudo leer el archivo de backup.', 'error');
    reader.readAsText(file);
  }

  function restoreInternalBackup() {
    let raw;
    try { raw = localStorage.getItem(KEY + '_backup'); } catch (err) { toast('No se pudo leer la copia interna.', 'error'); return; }
    if (!raw) { toast('No hay copia interna.', 'warn'); return; }
    confirmAction('Restaurar copia interna', 'Se sustituirán los datos actuales.', 'Restaurar', () => {
      const previous = data; const previousLoadError = loadError;
      try {
        const parsed = JSON.parse(raw);
        if (hasInvalidDates(parsed)) throw new Error('Fecha');
        data = normalize(parsed); syncPayrolls();
        localStorage.setItem(KEY, JSON.stringify(data));
        window.IVORY37CloudSync?.queue(data);
        loadError = false; applyBranding(); renderAll(); renderAjustes(); window.IVORY37CloudSync?.init(data); window.IVORY37CloudSync?.queue(data);
        toast('Copia restaurada.');
      } catch (err) { data = previous; loadError = previousLoadError; toast('No se pudo restaurar; los datos actuales siguen intactos.', 'error'); }
    });
  }

  function printReport(from, to) {
    const records = data.jornadas.filter((j) => j.fecha >= from && j.fecha <= to).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const confirmed = records.filter((j) => j.estado === 'confirmado');
    const exceptions = data.ausencias.filter((item) => item.fecha >= from && item.fecha <= to).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const trips = data.viajes.filter((item) => item.fecha >= from && item.fecha <= to).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const payments = data.pagos.filter((item) => item.fecha >= from && item.fecha <= to).sort((a, b) => a.fecha.localeCompare(b.fecha));
    let normalHours = round2(confirmed.reduce((sum, j) => sum + j.horas_normales, 0));
    const extraHours = round2(confirmed.reduce((sum, j) => sum + j.horas_extra, 0));
    let normalValue = round2(confirmed.reduce((sum, j) => sum + j.horas_normales * rateOn(j.fecha, 'normal'), 0));
    const extraValue = round2(confirmed.reduce((sum, j) => sum + j.horas_extra * rateOn(j.fecha, 'extra'), 0));
    const activeMonths = new Set(data.jornadas.map((j) => j.fecha.slice(0, 7)));
    const existingDates = new Set(data.jornadas.map((j) => j.fecha)); const exceptionDates = new Set(data.ausencias.map((item) => item.fecha));
    if (isEstimation()) {
      const today = dateKey(new Date());
      for (let day = parseKey(from); dateKey(day) <= to && dateKey(day) <= today; day = addDays(day, 1)) {
        const date = dateKey(day); const weekday = day.getDay();
        if (weekday === 0 || weekday === 6 || !activeMonths.has(date.slice(0, 7)) || existingDates.has(date) || exceptionDates.has(date)) continue;
        const hours = rateOn(date, 'jornada'); normalHours += hours; normalValue += hours * rateOn(date, 'normal');
      }
    }
    normalHours = round2(normalHours); normalValue = round2(normalValue);
    const tripTotal = round2(trips.reduce((sum, v) => sum + v.importe, 0));
    const provisionalCount = records.filter((j) => j.estado === 'provisional').length;
    const jornadaRows = records.map((j) => {
      const confirmedRow = j.estado === 'confirmado'; const clock = j.entrada && j.salida ? j.entrada + '–' + j.salida : '—';
      return '<tr><td>' + esc(fmtDate(j.fecha)) + '</td><td>' + esc(clock) + '</td><td class="num">' + (j.descanso_minutos ? j.descanso_minutos + ' min' : '—') + '</td><td class="num">' + hoursFmt.format(j.horas_normales) + '</td><td class="num">' + (j.horas_extra > 0 ? '+' + hoursFmt.format(j.horas_extra) : '—') + '</td><td class="num">' + (confirmedRow ? fmtMoney(rateOn(j.fecha, 'normal')) : '—') + '</td><td class="num">' + (confirmedRow ? fmtMoney(rateOn(j.fecha, 'extra')) : '—') + '</td><td>' + (confirmedRow ? 'Confirmada' : 'Provisional') + '</td></tr>';
    }).join('');
    const exceptionRows = exceptions.map((item) => '<tr><td>' + esc(fmtDate(item.fecha)) + '</td><td>' + esc(calendarLabel(item.tipo)) + '</td><td>' + esc(item.concepto || '—') + '</td><td>' + esc(item.notas || '') + '</td></tr>').join('');
    const tripRows = trips.map((item) => '<tr><td>' + esc(fmtDate(item.fecha)) + '</td><td>' + esc(item.concepto) + '</td><td class="num">' + fmtMoney(item.importe) + '</td><td>' + (item.pagado ? 'Cobrado' : 'Pendiente') + '</td></tr>').join('');
    const paymentRows = payments.map((item) => '<tr><td>' + esc(fmtDate(item.fecha)) + '</td><td>' + esc(item.concepto) + '</td><td>' + (item.tipo === 'nomina_auto' ? 'Automática' : 'Manual') + '</td><td class="num">' + fmtMoney(item.importe) + '</td><td>' + (item.confirmado ? 'Confirmada' : 'Pendiente') + '</td></tr>').join('');
    const name = 'Control Laboral'; const logo = setting('custom_logo') || './assets/ivory37-logo.jpg'; const person = String(setting('user_name') || '').trim();
    const total = round2(normalValue + extraValue + tripTotal);
    $('#print').innerHTML = '<div class="print-head">' + (logo && isSafeImage(logo) ? '<img src="' + esc(logo) + '" alt="">' : '') + '<h1>' + esc(name) + '</h1></div>' + '<p class="sub">' + (person ? esc(person) + ' · ' : '') + 'Informe · ' + esc(fmtDate(from)) + ' – ' + esc(fmtDate(to)) + '</p>' + '<div class="totals"><div>Horas normales<b>' + fmtHours(normalHours) + '</b></div><div>Horas extra<b>' + fmtHours(extraHours) + '</b></div><div>Valor normales<b>' + fmtMoney(normalValue) + '</b></div><div>Valor extras<b>' + fmtMoney(extraValue) + '</b></div><div>Viajes y dietas<b>' + fmtMoney(tripTotal) + '</b></div><div>Total estimado<b>' + fmtMoney(total) + '</b></div></div>' + (isEstimation() ? '<p class="sub">El cálculo incluye estimaciones de días laborables sin jornada ni incidencia registrada.</p>' : '') + (provisionalCount ? '<p class="sub">' + provisionalCount + ' jornada(s) provisional(es) aparecen para revisión y no se incluyen en los importes.</p>' : '') + '<h2>Jornadas</h2>' + (jornadaRows ? '<table><thead><tr><th>Fecha</th><th>Horario</th><th class="num">Pausa</th><th class="num">Norm.</th><th class="num">Extra</th><th class="num">€/h norm.</th><th class="num">€/h extra</th><th>Estado</th></tr></thead><tbody>' + jornadaRows + '</tbody></table>' : '<p>Sin jornadas en el periodo.</p>') + (exceptions.length ? '<h2>Calendario e incidencias</h2><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Notas</th></tr></thead><tbody>' + exceptionRows + '</tbody></table>' : '') + (trips.length ? '<h2>Viajes y dietas</h2><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Importe</th><th>Estado</th></tr></thead><tbody>' + tripRows + '</tbody></table>' : '') + (payments.length ? '<h2>Pagos registrados</h2><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th class="num">Importe</th><th>Estado</th></tr></thead><tbody>' + paymentRows + '</tbody></table>' : '') + '<footer>Las incidencias son anotaciones de calendario. El total estimado no sustituye una nómina oficial. Generado por ' + esc(name) + '</footer>';
    setTimeout(() => window.print(), 60);
  }

  function notify(title, body) { try { if ('Notification' in window && Notification.permission === 'granted') { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, body }); else new Notification(title, { body: body }); } } catch (err) {} }
  function requestNotifications() { if (!('Notification' in window)) { toast('Este navegador no admite notificaciones.', 'error'); return; } Notification.requestPermission().then((p) => { if (p === 'granted') { toast('Recordatorios activados.'); } else { toast('Permiso denegado.', 'warn'); } renderNotifState(); }).catch(() => { toast('No se pudo activar.', 'warn'); }); }

  function reminderTick() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date(); const hour = now.getHours(); const minute = now.getMinutes();
    if (minute !== 0 || (hour !== 8 && hour !== 16)) return;
    const key = dateKey(now) + '-' + hour;
    let seen = null; try { seen = localStorage.getItem(NOTIF_KEY); } catch (err) {}
    if (seen === key) return;
    try { localStorage.setItem(NOTIF_KEY, key); } catch (err) {}
    const today = data.jornadas.find((j) => j.fecha === dateKey(now));
    if (hour === 8 && (!today || !today.entrada)) notify('Recordatorio de entrada', 'Son las 08:00.');
    if (hour === 16 && today && today.entrada && !today.salida) notify('Recordatorio de salida', 'Son las 16:00.');
  }

  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]'); if (!el) return;
    const action = el.dataset.action; const id = el.dataset.id;
    if (action === 'tab') { showTab(el.dataset.tab); return; } if (action === 'close-modal') { closeModal(); return; }
    switch (action) {
      case 'clock-in': clockIn(); break;
      case 'clock-out': clockOut(); break;
      case 'save-profile': { const name = $('#cfg-user-name').value.trim().slice(0, 40); const role = $('#cfg-user-role').value.trim().slice(0, 40); setSetting('user_name', name); setSetting('user_role', role || 'Control laboral'); applyBranding(); persist('Perfil guardado'); break; }
      case 'new-calendar-entry': calendarModal(); break;
      case 'edit-calendar': calendarModal(id); break;
      case 'delete-calendar': { const item = data.ausencias.find((row) => String(row.id) === String(id)); if (item) { const group = String(item.grupo || item.id); confirmAction('Eliminar incidencia', 'Se quitará ' + calendarLabel(item.tipo) + ' del periodo que comienza el ' + fmtDate(item.fecha) + '.', 'Eliminar', () => { data.ausencias = data.ausencias.filter((row) => String(row.grupo || row.id) !== group); persist('Incidencia eliminada'); }, true); } break; }
      case 'load-rate': loadRateVersion(el.dataset.date); break;
      case 'delete-rate': deleteRateVersion(el.dataset.date); break;
      case 'resolve-conflict': { const restore = el.dataset.choice === 'restore'; confirmAction(restore ? 'Restaurar la otra versión' : 'Conservar la versión aplicada', restore ? 'La versión alternativa sustituirá el registro actual en tus dispositivos.' : 'Se mantendrá el registro aplicado y se cerrará esta revisión.', restore ? 'Restaurar versión' : 'Conservar versión', () => { if (window.IVORY37CloudSync?.resolveConflict(id, restore)) toast('Revisión guardada y sincronización programada.'); else toast('No se encontró el conflicto.', 'warn'); }); break; }
      case 'report-pdf': { const range = readReportRange(); if (range) { closeModal(); printReport(range.from, range.to); } break; }
      case 'report-csv': { const range = readReportRange(); if (range) { closeModal(); exportCSV(range.from, range.to); } break; }
      case 'print': openReportModal(); break;
      case 'export-csv': openReportModal(); break;
      case 'export-json': exportJSON(); break;
      case 'new-jornada': jornadaModal(null); break;
      case 'edit-jornada': jornadaModal(id); break;
      case 'add-extra': extraModal(id); break;
      case 'add-extra-quick': { const today = dateKey(new Date()); const j = jornadaForDate(today); if (!j) { toast('Crea primero la jornada de hoy.', 'warn'); return; } extraModal(j.id); break; }
      case 'new-trip': tripModal(null); break;
      case 'edit-trip': tripModal(id); break;
      case 'delete-trip': { const v = data.viajes.find((x) => String(x.id) === String(id)); if (v) confirmAction('Eliminar viaje', '¿Eliminar «' + v.concepto + '»?', 'Eliminar', () => { data.viajes = data.viajes.filter((x) => String(x.id) !== String(id)); persist('Viaje eliminado'); }, true); break; }
      case 'mark-trip': { const v = data.viajes.find((x) => String(x.id) === String(id)); if (v) { v.pagado = 1; v.fecha_pago = dateKey(new Date()); persist('Viaje cobrado'); } break; }
      case 'unmark-trip': { const v = data.viajes.find((x) => String(x.id) === String(id)); if (v) { v.pagado = 0; v.fecha_pago = ''; persist('Viaje devuelto'); } break; }
      case 'filter': { ui.filter = el.dataset.filter || 'all'; ui.limit = 30; $$('[data-action="filter"]').forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.filter === ui.filter))); renderJornadas(); break; }
      case 'load-more': ui.limit += 30; renderJornadas(); break;
      case 'recalc': setSetting('nomina_auto_omitidas', ''); syncPayrolls(); persist('Nóminas recalculadas; se regeneran las nóminas eliminadas'); break;
      case 'confirm-payroll': { const p = data.pagos.find((x) => String(x.id) === String(id)); if (p) { p.confirmado = true; persist('Nómina confirmada'); } break; }
      case 'unconfirm-payroll': { const p = data.pagos.find((x) => String(x.id) === String(id)); if (p) { p.confirmado = false; persist('Nómina a pendiente'); } break; }
      case 'edit-payroll': payrollModal(id); break;
      case 'delete-payroll': { const p = data.pagos.find((x) => String(x.id) === String(id)); if (p) confirmAction('Eliminar nómina', '¿Eliminar «' + p.concepto + '»? Si es automática, solo volverá a generarse al pulsar «Recalcular».', 'Eliminar', () => { if (p.tipo === 'nomina_auto') { const omitted = new Set(String(setting('nomina_auto_omitidas') || '').split(',').filter(Boolean)); omitted.add(p.mes_key); setSetting('nomina_auto_omitidas', Array.from(omitted).sort().join(',')); } data.pagos = data.pagos.filter((x) => String(x.id) !== String(id)); persist('Nómina eliminada'); }, true); break; }
      case 'mark-extra-paid': { const j = data.jornadas.find((x) => String(x.id) === String(id)); if (j) { j.pagado_extras = true; j.fecha_pago_extras = dateKey(new Date()); persist('Extras pagadas'); } break; }
      case 'mark-extra-unpaid': { const j = data.jornadas.find((x) => String(x.id) === String(id)); if (j) { j.pagado_extras = false; j.fecha_pago_extras = ''; persist('Extras a pendiente'); } break; }
      case 'edit-extra-payment': extraPaymentModal(el.dataset.month); break;
      case 'cleanup-auto': { const auto = data.jornadas.filter(isAutoGenerated); if (!auto.length) { toast('No hay jornadas de «Completar mes».', 'info'); break; } confirmAction('Quitar jornadas de «Completar mes»', 'Se eliminarán ' + auto.length + ' registros creados con «Completar mes». No se tocan las jornadas creadas con «Según horario».', 'Eliminar ' + auto.length, () => { data.jornadas = data.jornadas.filter((j) => !isAutoGenerated(j)); persist('Jornadas de «Completar mes» eliminadas'); renderDataTools(); }, true); break; }
      case 'pending-detail': pendingModal(); break;
      case 'request-notif': requestNotifications(); break;
      case 'settings-jump': { const target = el.dataset.target ? document.querySelector(el.dataset.target) : null; if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
      case 'open-profile': { showTab('ajustes'); setTimeout(() => { const field = $('#cfg-user-name'); if (field) { field.focus(); if (field.scrollIntoView) field.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 120); break; }
      case 'open-schedule': { showTab('ajustes'); setTimeout(() => { const field = $('#cfg-schedule'); if (field) { field.focus(); if (field.scrollIntoView) field.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 120); break; }
      case 'setup-dismiss': { setSetting('setup_dismissed', '1'); persist('Ocultos'); break; }
      case 'setup-show': { setSetting('setup_dismissed', ''); persist('Activados'); break; }
      case 'logo-bg': { setSetting('logo_bg', el.dataset.bg === 'dark' ? 'dark' : 'light'); applyBranding(); renderLogoPreview(); persist('Logo actualizado'); break; }
      case 'use-app-logo': { const appLogo = setting('custom_logo'); if (!appLogo) { toast('Sube un logo primero.', 'warn'); break; } setSetting('user_avatar', '@logo'); applyBranding(); persist('Foto actualizada'); break; }
      case 'reset-avatar': { setSetting('user_avatar', ''); applyBranding(); persist('Foto eliminada'); break; }
      case 'fill-today': fillToday(); break;
      case 'fill-month': fillMonth(); break;
      case 'confirm-all': { const provisional = data.jornadas.filter((j) => j.estado === 'provisional'); if (!provisional.length) { toast('No hay provisionales.', 'info'); break; } confirmAction('Confirmar provisionales', 'Se marcarán ' + provisional.length + ' como confirmadas; sus horas pasarán a los cálculos de nómina y cobro.', 'Confirmar ' + provisional.length, () => { provisional.forEach((j) => { j.estado = 'confirmado'; if (!/\[confirmado\]/i.test(j.notas)) j.notas = ('[CONFIRMADO] ' + (j.notas || '')).trim(); }); persist(provisional.length + (provisional.length === 1 ? ' jornada confirmada' : ' jornadas confirmadas')); }); break; }
      case 'reset-logo': { setSetting('custom_logo', ''); setSetting('logo_ratio', ''); applyBranding(); renderLogoPreview(); persist('Logo personalizado eliminado'); break; }
      case 'restore-internal-backup': restoreInternalBackup(); break;
      case 'reset': { confirmAction('Borrar todos los datos', 'Se eliminarán jornadas, calendario, viajes, pagos y ajustes.', 'Borrar todo', () => { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '_backup'); localStorage.removeItem(KEY + '_backup_date'); localStorage.removeItem(NOTIF_KEY); } catch (err) {} loadError = false; data = normalize({}); applyBranding(); renderAjustes(); persist('Datos borrados'); showTab('dashboard'); }, true); break; }
      default: break;
    }
  });

  document.addEventListener('input', (event) => { if (['cfg-normal', 'cfg-extra', 'cfg-day', 'cfg-rate-date'].includes(event.target.id)) ratesDirty = true; if (event.target.id === 'jornadas-search') { ui.query = event.target.value; ui.limit = 30; renderJornadas(); } if (event.target.id === 'cfg-color') { const value = event.target.value; applyBrandColor(value); const hex = $('#cfg-color-hex'); if (hex) hex.value = value; } });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'import-file') { importJSON(event.target.files && event.target.files[0]); event.target.value = ''; }
    if (event.target.id === 'logo-input') { const file = event.target.files && event.target.files[0]; event.target.value = ''; if (file) handleLogo(file); }
    if (event.target.id === 'cfg-estimation') { setSetting('estimation', event.target.checked ? '1' : '0'); persist(event.target.checked ? 'Estimación activada' : 'Desactivada'); }
    if (event.target.id === 'cfg-auto-fichaje') { setSetting('auto_fichaje', event.target.checked ? '1' : '0'); if (event.target.checked) setSetting('auto_dismissed', ''); persist(event.target.checked ? 'Auto activado' : 'Desactivado'); if (event.target.checked) autoFichaje(); }
    if (event.target.id === 'avatar-input') { const file = event.target.files && event.target.files[0]; event.target.value = ''; if (file) handleAvatar(file); }
  });

  const configForm = $('#config-form');
  if (configForm) {
    configForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const normal = num($('#cfg-normal').value, -1); const extra = num($('#cfg-extra').value, -1); const day = num($('#cfg-day').value, -1); const pauseMinutes = num($('#cfg-break').value, -1);
      const effectiveFrom = $('#cfg-rate-date').value;
      const name = $('#cfg-name').value.trim(); const color = $('#cfg-color').value; const schedule = $('#cfg-schedule').value.trim();
      const userName = $('#cfg-user-name').value.trim().slice(0, 40); const userRole = $('#cfg-user-role').value.trim().slice(0, 40);
      const hadRateChanges = ratesDirty;
      if (normal < 0 || extra < 0) { toast('Tarifas no válidas.', 'error'); return; }
      if (day < 1 || day > 16) { toast('Jornada entre 1 y 16 horas.', 'error'); return; }
      if (!Number.isInteger(pauseMinutes) || pauseMinutes < 0 || pauseMinutes > 1440) { toast('La pausa habitual debe ser un número entero entre 0 y 1.440 minutos.', 'error'); return; }
      if (ratesDirty && !isDateKey(effectiveFrom)) { toast('Elige una fecha válida para aplicar las tarifas.', 'error'); return; }
      if (!/^#[0-9a-f]{6}$/i.test(color)) { toast('Color no válido.', 'error'); return; }
      const scheduleMatch = schedule.match(/(\d{1,2}:\d{2})\s*(?:[-–]|\ba\b)\s*(\d{1,2}:\d{2})/i);
      if (schedule && (!scheduleMatch || !hhmm(scheduleMatch[1].padStart(5, '0')) || !hhmm(scheduleMatch[2].padStart(5, '0')))) { toast('Horario no válido (ej: 08:00-16:00).', 'error'); return; }
      if (scheduleMatch) { const shiftMinutes = minutesBetween(scheduleMatch[1].padStart(5, '0'), scheduleMatch[2].padStart(5, '0')); if (shiftMinutes === 0) { toast('La hora de salida debe ser distinta a la de entrada.', 'error'); return; } if (pauseMinutes > 0 && pauseMinutes >= shiftMinutes) { toast('La pausa habitual debe ser menor que el horario habitual.', 'error'); return; } }
      const save = () => {
        if (hadRateChanges) saveRateVersion({ desde: effectiveFrom, normal: round2(normal), extra: round2(extra), jornada: round2(day) });
        setSetting('app_name', 'Control Laboral'); setSetting('app_color', color); setSetting('horario_habitual', schedule); setSetting('pausa_habitual_minutos', String(pauseMinutes));
        setSetting('user_name', userName); setSetting('user_role', userRole || 'Control laboral');
        ratesDirty = false; applyBranding(); persist(hadRateChanges ? 'Ajustes guardados; nóminas pendientes actualizadas' : 'Ajustes guardados'); renderAjustes();
      };
      const today = dateKey(new Date());
      const affected = hadRateChanges && effectiveFrom < today ? data.jornadas.filter((j) => j.estado === 'confirmado' && j.fecha >= effectiveFrom).length : 0;
      if (affected) confirmAction('Aplicar tarifa histórica', 'Se actualizarán los cálculos de ' + affected + ' jornada(s) desde ' + fmtDate(effectiveFrom) + '. Las nóminas confirmadas y las editadas manualmente se conservarán.', 'Aplicar tarifa', save);
      else save();
    });
  }

  const modalSaveBtn = $('#modal-save');
  if (modalSaveBtn) modalSaveBtn.addEventListener('click', () => { if (!modalSave) return; const result = modalSave(); if (result !== false) closeModal(); });
  const modalDelBtn = $('#modal-delete');
  if (modalDelBtn) modalDelBtn.addEventListener('click', () => { if (!modalDelete) return; const result = modalDelete(); if (result !== false) closeModal(); });

  document.addEventListener('keydown', (event) => {
    const modal = $('#modal'); if (!modal || modal.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
    if (event.key !== 'Tab') return;
    const focusable = $$('button, input, select, textarea, [href]', modal).filter((el) => !el.hidden && !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  window.addEventListener('storage', (event) => { if (event.key !== KEY) return; data = loadData(); applyBranding(); probeLogoRatio(); renderAll(); renderAjustes(); toast('Datos sincronizados.', 'info'); });
  window.addEventListener('ivory37:sync-conflicts', renderSyncConflicts);

  function processImage(file, maxSize, callback) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) { toast('Debe ser una imagen.', 'error'); return; }
    if (file.size > 4 * 1024 * 1024) { toast('Máximo 4 MB.', 'error'); return; }
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let dataUrl = canvas.toDataURL('image/png'); if (dataUrl.length > 700000) dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(dataUrl)) { toast('Formato no soportado.', 'error'); return; }
        callback(dataUrl, img.width, img.height);
      } catch (err) { toast('No se pudo procesar la imagen.', 'error'); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('No se pudo leer la imagen.', 'error'); }; img.src = url;
  }

  function handleLogo(file) { processImage(file, 240, (dataUrl, width, height) => { setSetting('custom_logo', dataUrl); setSetting('logo_ratio', String(round2(width / Math.max(1, height)))); applyBranding(); renderLogoPreview(); persist('Logo actualizado'); }); }
  function handleAvatar(file) { processImage(file, 200, (dataUrl) => { setSetting('user_avatar', dataUrl); applyBranding(); persist('Foto actualizada'); }); }

  function tick() {
    const now = new Date(); const clockEl = $('#clock-mobile'); if (clockEl) clockEl.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const today = dateKey(now);
    if (now.getHours() !== ui.hour) { ui.hour = now.getHours(); renderHero(); }
    if (today !== ui.today) {
      const previous = ui.today; ui.today = today;
      const tariffBecameActive = rateHistory().some((item) => item.desde > previous && item.desde <= today);
      if (tariffBecameActive) {
        persist('Tarifa programada aplicada');
        if (ui.tab === 'ajustes' && !ratesDirty) { const normal = $('#cfg-normal'); const extra = $('#cfg-extra'); const day = $('#cfg-day'); if (normal) normal.value = fmtInput(rateOn(today, 'normal')); if (extra) extra.value = fmtInput(rateOn(today, 'extra')); if (day) day.value = fmtInput(rateOn(today, 'jornada')); renderRateHistory(); }
      } else renderDashboard();
    }
    else if (ui.tab === 'dashboard') { renderRadial(); }
    if (now.getTime() - lastAutoCheck >= 60000) { lastAutoCheck = now.getTime(); autoFichaje(); }
  }

  window.addEventListener('ivory37:cloud-data', (event) => {
    if (!event.detail || loadError) return;
    try {
      data = normalize(event.detail);
      syncPayrolls();
      localStorage.setItem(KEY, JSON.stringify(data));
      applyBranding(); renderAll(); renderAjustes(); updateStorageUsage();
      window.IVORY37CloudSync?.queue(data);
      mirrorNativeStorage();
    } catch (err) { console.error('No se pudo aplicar la sincronización en la app:', err); }
  });

  function init() {
    const hash = location.hash.slice(1); if (['dashboard', 'jornadas', 'viajes', 'pagos', 'ajustes'].includes(hash)) ui.tab = hash;
    ui.today = dateKey(new Date());
    restoreNativeStorage();
    ensureInternalBackup();
    data = loadData(); applyBranding(); probeLogoRatio();
    if (!loadError) { try { syncPayrolls(); localStorage.setItem(KEY, JSON.stringify(data)); } catch (err) { console.warn(err); } }
    const verEl = $('#app-version'); if (verEl) verEl.textContent = APP_VERSION;
    ui.hour = new Date().getHours(); showTab(ui.tab); renderAll(); renderAjustes(); updateStorageUsage(); autoFichaje(); tick();
    setInterval(tick, 1000); setInterval(reminderTick, 30000);
    if (loadError) { setTimeout(() => toast('No se pudieron leer los datos o tienen fechas no válidas. No se ha sobrescrito nada: importa un backup correcto.', 'error'), 500); }
    else if (!data.jornadas.length && !data.viajes.length && !data.pagos.length && !data.ausencias.length) { setTimeout(() => toast('Empieza fichando la entrada o crea una jornada.', 'info'), 700); }
    else if (!setting('user_name')) { setTimeout(() => toast('Completa tu perfil en Ajustes → Mi perfil.', 'info'), 900); }
    if (loadError) {
      const cloudStatus = $('#cloud-status');
      if (cloudStatus) { cloudStatus.textContent = 'Sincronización pausada hasta recuperar los datos.'; cloudStatus.dataset.state = 'error'; }
      ['#cloud-signup', '#cloud-login', '#cloud-now'].forEach((selector) => { const button = $(selector); if (button) button.disabled = true; });
    } else window.IVORY37CloudSync?.init(data);
    mirrorNativeStorage();
  }

  init();
})();
