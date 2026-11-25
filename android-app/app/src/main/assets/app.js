(function () {
  'use strict';
  const demoMode = new URLSearchParams(location.search).get('demo') === '1';
  const demoValues = new Map();
  const demoStorage = { get length() { return demoValues.size; }, key: index => [...demoValues.keys()][index], getItem: key => demoValues.get(key) ?? null, setItem: (key, value) => demoValues.set(key, String(value)), removeItem: key => demoValues.delete(key), clear: () => demoValues.clear() };
  const localStorage = demoMode ? demoStorage : window.IVORY37Storage || globalThis.localStorage;
  const cloudSync = demoMode ? null : window.IVORY37CloudSync;
  window.IVORY37AppReady = false;

  const KEY = '工V龱尺ㄚ㇌7_data_v1';
  const APP_VERSION = (document.querySelector('meta[name="app-version"]') || {}).content || '3.3.23';
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
  let undoRecords = null;

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
      return fail;
    } else if (dots > 1) {
      if (!/^\d{1,3}(?:\.\d{3})+$/.test(body)) return fail;
      normalized = body.replace(/\./g, '');
    } else if (commas === 1) {
      const parts = body.split(',');
      if (!/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) return fail;
      normalized = parts[0] + '.' + parts[1];
    }
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) return fail;
    const n = Number(sign + normalized);
    return Number.isFinite(n) ? n : fail;
  };

  function uid() {
    if (typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }
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
  const { toMinutes, minutesBetween, hoursBetween, netHoursBetween, interruptionMinutes } = window.IVORY37WorkHours;
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
      return { id: item.id == null ? uid() : item.id, fecha, entrada, salida, horas_normales: clamp(round2(num(item.horas_normales, 0)), 0, 24), horas_extra: clamp(round2(num(item.horas_extra, 0)), 0, 24), descanso_minutos: clamp(Math.round(num(item.descanso_minutos, 0)), 0, 1440), estado, ...(Array.isArray(item.proyectos) ? { proyectos: item.proyectos.slice(0, 20).filter(row => row && typeof row.nombre === 'string' && num(row.horas) > 0).map(row => ({ nombre: row.nombre.slice(0, 80), horas: round2(num(row.horas)) })) } : {}), ...(Array.isArray(item.interrupciones) ? { interrupciones: item.interrupciones.slice(0, 20).filter(row => row && hhmm(row.desde) && hhmm(row.hasta)) } : {}), ...(hhmm(item.pausa_desde) ? { pausa_desde: hhmm(item.pausa_desde) } : {}), notas: String(item.notas || ''), ...(Array.isArray(item.historial) ? { historial: item.historial.slice(-12).filter(entry => entry && typeof entry.fecha === 'string' && entry.campos && typeof entry.campos === 'object') } : {}), ...(isDateKey(item.fecha_compensacion) ? { fecha_compensacion: item.fecha_compensacion, horas_compensadas: Math.max(0, num(item.horas_compensadas, 0)) } : {}), pagado_extras: bool(item.pagado_extras), fecha_pago_extras: String(item.fecha_pago_extras || ''), auto: bool(item.auto), backfill: bool(item.backfill), creado: item.creado || new Date().toISOString() };
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
      return { id: item.id == null ? uid() : item.id, fecha, concepto: String(item.concepto || 'Nómina'), importe: round2(Math.max(0, num(item.importe, 0))), tipo, mes_key: item.mes_key || fecha.slice(0, 7), confirmado: bool(item.confirmado), ...(Array.isArray(item.historial_abonos) ? { historial_abonos: item.historial_abonos.filter(entry => entry && typeof entry.id === 'string' && typeof entry.fecha === 'string' && entry.anterior && isDateKey(entry.anterior.fecha) && num(entry.anterior.importe) > 0).slice(-50) } : {}), ...(isDateKey(item.fecha_cobro) ? { fecha_cobro: item.fecha_cobro } : {}), ...(Array.isArray(item.abonos) ? { abonos: item.abonos.filter(a => a && isDateKey(a.fecha) && num(a.importe) > 0).map(a => ({ id: String(a.id), fecha: a.fecha, importe: round2(num(a.importe)) })) } : {}), horas_normales_mes: round2(num(item.horas_normales_mes, 0)), horas_extra_mes: round2(num(item.horas_extra_mes, 0)), dias_laborables: Math.max(0, Math.round(num(item.dias_laborables, 0))), manual_edit: bool(item.manual_edit), actualizado: item.actualizado || '', created: item.created || new Date().toISOString() };
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
  // Copia solo datos de la app: los tokens de Auth no son una copia de seguridad.
  function isAppStorageKey(key) {
    return [KEY, KEY + '_backup', KEY + '_backup_date', KEY + '_recovery', NOTIF_KEY,
      'ivory37_cloud_sync_meta_v1', 'ivory37_cloud_sync_snapshot_v1',
      'ivory37_cloud_sync_base_v1', 'ivory37_cloud_sync_conflicts_v1',
      'ivory37_cloud_sync_owner_v1'].includes(key);
  }
  function storageSnapshot(includeAll = false) {
    const snapshot = {};
    try { for (let index = 0; index < localStorage.length; index++) { const key = localStorage.key(index); if (key && (includeAll || isAppStorageKey(key))) snapshot[key] = localStorage.getItem(key); } }
    catch (err) { console.warn('No se pudo preparar la copia local del almacenamiento.'); }
    return snapshot;
  }
  function mirrorNativeStorage() {
    if (demoMode) return;
    if (window.AndroidBridge && typeof window.AndroidBridge.configureReminders === 'function' && data) {
      const schedule = scheduleWindow() || { startMin: 480, endMin: 960 }; const today = dateKey(new Date());
      const shift = data.jornadas.find(row => row.fecha === today && !row.salida) || data.jornadas.find(row => row.fecha === today);
      window.AndroidBridge.configureReminders(JSON.stringify({ enabled: setting('reminders_enabled', '0') === '1',
        start: schedule.startMin, end: schedule.endMin, date: today, entered: Boolean(shift && shift.entrada), exited: Boolean(shift && shift.salida) }));
    }
    const bridge = nativeStorageBridge();
    if (!bridge || typeof bridge.saveLocalStorage !== 'function') return;
    try { bridge.saveLocalStorage(JSON.stringify(storageSnapshot())); }
    catch (err) { console.warn('No se pudo actualizar la copia local de la app.'); }
  }
  function restoreNativeStorage() {
    if (demoMode) return true;
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
        if (!savedData || typeof savedData !== 'object' || Array.isArray(savedData) || hasInvalidDates(savedData)) throw new Error('Los datos guardados no son válidos.');
        const previous = storageSnapshot(true);
        try {
          localStorage.clear();
          Object.keys(saved).forEach((key) => {
            if (isAppStorageKey(key) && typeof saved[key] === 'string' && key.length < 512) localStorage.setItem(key, saved[key]);
          });
        } catch (restoreError) {
          try {
            localStorage.clear();
            Object.keys(previous).forEach((key) => localStorage.setItem(key, previous[key]));
          } catch (rollbackError) { console.error('No se pudo revertir la restauración local:', rollbackError); }
          throw restoreError;
        }
        if (bridge.completeLocalStorageMigration() === false) throw new Error('No se pudo finalizar la recuperación de datos.');
        if (location.protocol !== 'file:') window.history.replaceState(null, '', location.pathname + location.hash);
        return true;
      }
      Object.keys(saved).forEach((key) => {
        if (isAppStorageKey(key) && typeof saved[key] === 'string' && key.length < 512 && localStorage.getItem(key) === null) localStorage.setItem(key, saved[key]);
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
  let cachedRateSource;
  let cachedRateHistory = [];
  const cachedRateDates = new Map();
  function rateHistory() {
    const source = setting('tarifa_historial', '[]');
    if (source !== cachedRateSource) {
      cachedRateSource = source;
      cachedRateHistory = window.IVORY37Rates.normalize(source, isDateKey);
      cachedRateDates.clear();
    }
    return cachedRateHistory.slice();
  }
  function rateOn(date, kind) {
    const key = kind === 'extra' ? 'extra' : kind === 'jornada' ? 'jornada' : 'normal';
    rateHistory();
    if (!cachedRateDates.has(date)) {
      let selected = null;
      for (const version of cachedRateHistory) { if (version.desde > date) break; selected = version; }
      cachedRateDates.set(date, selected);
    }
    const selected = cachedRateDates.get(date);
    return selected ? selected[key] : key === 'normal' ? rateNormal() : key === 'extra' ? rateExtra() : legacyDayHours();
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
    try {
      if (previous) localStorage.setItem(KEY + '_recovery', previous);
      localStorage.setItem(KEY, JSON.stringify(data));
    }
    catch (err) { console.error(err); restorePrevious(); toast('No se pudo guardar. Libera espacio o exporta un backup.', 'error'); return false; }
    const finish = () => {
      cloudSync?.queue(data);
      mirrorNativeStorage();
      renderAll(); updateStorageUsage(); if (message) toast(message);
      return true;
    };
    if (localStorage.flush) return localStorage.flush().then(finish).catch((err) => {
      localStorage.rollback(); restorePrevious();
      toast('No se ha guardado: ' + err.message + ' Conserva una copia antes de cerrar.', 'error');
      return false;
    });
    return finish();
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
    const extraValue = round2(records.reduce((sum, j) => sum + hoursToBill(j) * rateOn(j.fecha, 'extra'), 0));
    return { days: records.length, normal, extra, estimated: estimated.length, normalTotal: round2(normal + estimatedHours), normalValue, extraValue };
  }

  function paidPayroll(p) {
    return p.confirmado ? p.importe : round2((p.abonos || []).reduce((sum, payment) => sum + payment.importe, 0));
  }

  function hoursToBill(row) { return window.IVORY37Overtime.billableHours(row); }

  function totals() {
    let extraH = 0; let extraPending = 0; let extraPaid = 0; let extraEarned = 0; let trips = 0; let tripsPaid = 0; let autoPaid = 0; let payrollPending = 0; let manualPaid = 0;
    data.jornadas.forEach((j) => { if (j.estado !== 'confirmado') return; const value = hoursToBill(j) * rateOn(j.fecha, 'extra'); extraH += j.horas_extra; extraEarned += value; if (j.pagado_extras) extraPaid += value; else extraPending += value; });
    data.viajes.forEach((v) => { trips += v.importe; if (v.pagado) tripsPaid += v.importe; });
    effectivePayments().forEach((p) => { if (p.tipo === 'nomina_auto') { const paid = paidPayroll(p); autoPaid += paid; payrollPending += p.importe - paid; } else if (p.confirmado) manualPaid += p.importe; });
    const payrollPaid = autoPaid + manualPaid; const payrollEarned = payrollPaid + payrollPending; const earned = round2(payrollEarned + extraEarned + trips); const collected = round2(payrollPaid + extraPaid + tripsPaid);
    return { extraH: round2(extraH), extraPending: round2(extraPending), extraPaid: round2(extraPaid), extraValue: round2(extraEarned), trips: round2(trips), tripsPaid: round2(tripsPaid), payrollPaid: round2(payrollPaid), payrollPending: round2(payrollPending), earned, collected, pending: round2(earned - collected), rn: rateNormal(), re: rateExtra() };
  }

  function generatedPayrollsByMonth(payments) {
    // Preserve proposals in storage so a confirmation from an offline device can still sync.
    const generated = new Map();
    const protectedMonths = new Set();
    for (const payment of payments) {
      if (payment.tipo !== 'nomina_auto') continue;
      if (payment.confirmado || payment.manual_edit) {
        protectedMonths.add(payment.mes_key);
      } else {
        const current = generated.get(payment.mes_key);
        if (!current || String(payment.id) < String(current.id)) generated.set(payment.mes_key, payment);
      }
    }
    protectedMonths.forEach((month) => generated.delete(month));
    return generated;
  }

  function effectivePayments() {
    const generated = generatedPayrollsByMonth(data.pagos);
    return data.pagos.filter((payment) => payment.tipo !== 'nomina_auto' || payment.confirmado
      || payment.manual_edit || generated.get(payment.mes_key) === payment);
  }

  function syncPayrolls() {
    const manuallyCompletedDates = new Set(data.jornadas.filter((item) => !item.auto && item.entrada && item.salida).map((item) => item.fecha));
    // Retain overlapping automatic records for review, without counting their hours twice.
    data.jornadas.forEach((item) => {
      if (item.auto && manuallyCompletedDates.has(item.fecha)) item.estado = 'provisional';
    });
    const months = new Set(data.jornadas.filter((j) => j.estado === 'confirmado').map((j) => j.fecha.slice(0, 7)));
    const omitted = new Set(String(setting('nomina_auto_omitidas') || '').split(',').filter(Boolean));
    const generated = generatedPayrollsByMonth(data.pagos);
    const protectedMonths = new Set(data.pagos.filter((p) => p.tipo === 'nomina_auto' && (p.confirmado || p.manual_edit)).map((p) => p.mes_key));
    Array.from(months).sort().forEach((month) => {
      if (omitted.has(month)) return;
      const stats = monthStats(month);
      const existing = generated.get(month);
      if (existing) {
        if (existing.importe !== stats.normalValue) {
          existing.importe = stats.normalValue;
          existing.actualizado = new Date().toISOString();
        }
        existing.horas_normales_mes = stats.normalTotal;
        existing.horas_extra_mes = stats.extra;
        existing.dias_laborables = stats.days;
      } else if (!protectedMonths.has(month)) {
        data.pagos.push({ id: uid(), fecha: month + '-28', concepto: 'Nómina ' + fmtMonth(month), importe: stats.normalValue, tipo: 'nomina_auto', mes_key: month, confirmado: false, horas_normales_mes: stats.normalTotal, horas_extra_mes: stats.extra, dias_laborables: stats.days, manual_edit: false, created: new Date().toISOString() });
      }
    });
    data.pagos = data.pagos.filter((p) => p.tipo !== 'nomina_auto' || p.confirmado || p.manual_edit
      || (!omitted.has(p.mes_key) && months.has(p.mes_key)));
  }

  function monthBreakdown(month) {
    let payroll = 0; let extras = 0; let trips = 0;
    effectivePayments().forEach((p) => { if (p.tipo === 'nomina_auto' && p.mes_key === month && !p.confirmado) payroll += p.importe - paidPayroll(p); });
    data.jornadas.forEach((j) => { if (j.estado === 'confirmado' && j.fecha.slice(0, 7) === month && !j.pagado_extras) extras += hoursToBill(j) * rateOn(j.fecha, 'extra'); });
    data.viajes.forEach((v) => { if (v.fecha.slice(0, 7) === month && !v.pagado) trips += v.importe; });
    payroll = round2(payroll); extras = round2(extras); trips = round2(trips);
    return { payroll, extras, trips, total: round2(payroll + extras + trips) };
  }

  function overtimeMonthBreakdown(month) {
    return window.IVORY37Overtime.summarize(data.jornadas, month, (j) => rateOn(j.fecha, 'extra'));
  }

  function renderDataTools() {
    const auto = data.jornadas.filter(isAutoGenerated); const cleanup = $('#cleanup-auto-btn');
    if (cleanup) { cleanup.hidden = auto.length === 0; cleanup.textContent = auto.length === 1 ? 'Quitar 1 autogenerada' : 'Quitar ' + auto.length + ' autogeneradas'; }
    updateFillLabel(); renderBackupInfo();
    const setupBtn = $('#setup-show-btn'); if (setupBtn) setupBtn.hidden = setting('setup_dismissed') !== '1';
  }

  function notificationState() {
    if (window.AndroidBridge && typeof window.AndroidBridge.getNotificationState === 'function') return window.AndroidBridge.getNotificationState();
    if (!('Notification' in window)) return 'No compatible';
    return Notification.permission === 'granted' ? 'Activados' : Notification.permission === 'denied' ? 'Bloqueados' : 'Sin activar';
  }
  function reminderTimingState() {
    if (window.AndroidBridge && typeof window.AndroidBridge.getReminderTimingState === 'function') return window.AndroidBridge.getReminderTimingState();
    return 'Con la app abierta';
  }
  function renderNotifState() {
    const el = $('#notif-state'); if (el) el.textContent = notificationState();
    const timing = $('#reminder-timing-state'); if (timing) timing.textContent = reminderTimingState();
    const exactButton = $('#request-exact-reminders'); if (exactButton) exactButton.hidden = !window.AndroidBridge || reminderTimingState() === 'Puntuales';
  }
  window.__ivoryAndroidRefreshNotifications = renderNotifState;
  function renderAll() {
    if (ui.tab === 'dashboard') { renderDashboard(); renderSetup(); }
    else if (ui.tab === 'jornadas') { renderJornadas(); renderCalendar(); }
    else if (ui.tab === 'viajes') renderTrips();
    else if (ui.tab === 'pagos') renderPagos();
    else if (ui.tab === 'ajustes') renderAjustes();
    renderDataTools(); updateStorageUsage();
  }
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
    if (metaEl) {
      const usualHours = win ? win.start + '–' + win.end : '';
      metaEl.textContent = metaText + (usualHours && usualHours !== metaText ? ' · Habitual ' + usualHours : '');
    }
    const badges = $('#hero-badges');
    if (badges) {
      const list = [];
      if (isEstimation()) list.push('<span class="badge warn">Estimación activa</span>');
      badges.innerHTML = list.join('');
    }
  }

  function renderTodayClock() {
    const now = new Date();
    const today = dateKey(now);
    const yesterday = dateKey(addDays(now, -1));
    const j = openJornadaForDate(today) || openJornadaForDate(yesterday) || jornadaForDate(today);
    let worked = 0; let label = 'Sin fichar'; let subLabel = 'Hoy';
    if (!j) { worked = 0; }
    else if (j.entrada && j.salida) { worked = round2(j.horas_normales + j.horas_extra); label = 'Jornada cerrada'; subLabel = j.entrada + ' – ' + j.salida; }
    else if (j.entrada) { const mins = toMinutes(j.entrada); const nowMins = now.getHours() * 60 + now.getMinutes(); const dayOffset = j.fecha === yesterday ? 1440 : 0; worked = round2((((nowMins - mins + dayOffset) % 1440) + 1440) % 1440 / 60); label = 'Trabajando'; subLabel = 'Desde ' + (j.fecha === yesterday ? 'ayer a las ' : '') + j.entrada; }
    else { worked = round2(j.horas_normales + j.horas_extra); label = 'Registro manual'; subLabel = 'Horas registradas sin horario'; }
    const pause = $('#hero-pause');
    if (j?.entrada && !j.salida) {
      const time = pad(now.getHours()) + ':' + pad(now.getMinutes());
      const intervals = intervalsThrough(j, time);
      worked = round2(Math.max(0, worked - (interruptionMinutes(j.entrada, time, intervals) || 0) / 60));
      if (j.pausa_desde) label = 'En pausa';
    }
    if (pause) {
      pause.hidden = !j?.entrada || Boolean(j.salida);
      pause.textContent = j?.pausa_desde ? 'Volver al trabajo' : 'Iniciar pausa';
    }
    const manual = $('#hero-manual-action');
    if (manual) {
      manual.dataset.action = j ? 'edit-jornada' : 'new-jornada';
      if (j) manual.dataset.id = String(j.id); else delete manual.dataset.id;
      manual.querySelector('span').textContent = j ? 'Revisar jornada' : 'Registrar jornada';
    }
    const state = $('#hero-clock-state');
    if (state) {
      if (state.textContent !== label) state.textContent = label;
      state.dataset.state = j && j.entrada && !j.salida ? 'working' : (j && j.salida ? 'closed' : 'idle');
    }
    const action = $('#hero-clock-action');
    if (action) {
      const open = Boolean(j && j.entrada && !j.salida);
      const nextAction = open ? 'clock-out' : 'clock-in';
      action.hidden = Boolean(j && j.salida);
      if (action.dataset.action !== nextAction) {
        action.dataset.action = nextAction;
        action.querySelector('span').textContent = open ? 'Fichar salida' : 'Fichar entrada';
        action.querySelector('use').setAttribute('href', open ? '#i-logout' : '#i-login');
      }
      const heroHours = $('#hero-today-hours');
      const heroMeta = $('#hero-today-meta');
      if (heroHours) heroHours.textContent = fmtHours(worked);
      if (heroMeta) heroMeta.textContent = subLabel;
    }
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
      data.jornadas.forEach((j) => { if (j.fecha.slice(0, 7) === m && j.pagado_extras) paid += hoursToBill(j) * rateOn(j.fecha, 'extra'); });
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

  $('#dashboard-period')?.addEventListener('change', renderDashboardPeriod);
  function renderDashboardPeriod() {
    const host = $('#dashboard-period-summary');
    if (!host) return;
    const now = new Date();
    const today = dateKey(now);
    const period = $('#dashboard-period').value;
    const from = period === 'week' ? dateKey(addDays(now, -((now.getDay() + 6) % 7))) : period === 'month' ? today.slice(0, 7) + '-01' : today;
    const rows = data.jornadas.filter(row => row.fecha >= from && row.fecha <= today && row.estado === 'confirmado');
    const normal = rows.reduce((sum, row) => sum + row.horas_normales, 0);
    const extra = rows.reduce((sum, row) => sum + row.horas_extra, 0);
    const value = rows.reduce((sum, row) => sum + hoursToBill(row) * rateOn(row.fecha, 'extra'), 0);
    const goal = clamp(num(setting('weekly_goal', 40), 40), 1, 168);
    host.textContent = fmtHours(round2(normal + extra)) + ' registradas · ' + fmtHours(round2(extra)) + ' extra · ' + fmtMoney(value) + ' en extras' + (period === 'week' ? ' · Objetivo: ' + fmtHours(goal) : '');
    const chart = $('#dashboard-period-chart');
    if (chart) {
      const byDay = new Map();
      for (const row of rows) byDay.set(row.fecha, (byDay.get(row.fecha) || 0) + row.horas_normales + row.horas_extra);
      const scale = Math.max(1, ...byDay.values());
      chart.innerHTML = [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, hours]) =>
        '<div class="period-bar"><span>' + esc(fmtDate(date)) + '</span><meter min="0" max="' + scale + '" value="' + hours + '">' + esc(fmtHours(hours)) + '</meter><strong>' + esc(fmtHours(hours)) + '</strong></div>').join('');
      chart.hidden = !byDay.size;
    }
  }

  function renderReviewQueue() {
    const host = $('#review-queue');
    if (!host) return;
    const counts = new Map();
    for (const row of data.jornadas) counts.set(row.fecha, (counts.get(row.fecha) || 0) + 1);
    const rows = data.jornadas.filter(row => row.estado === 'provisional' || (row.entrada && !row.salida) || counts.get(row.fecha) > 1).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const unpaidTrips = data.viajes.filter(row => !row.pagado).length;
    host.hidden = !rows.length && !unpaidTrips;
    host.innerHTML = '<h2>Pendientes</h2>'
      + rows.slice(0, 8).map(row => '<p><button class="btn ghost sm" type="button" data-action="edit-jornada" data-id="' + esc(row.id) + '">' + esc(fmtDate(row.fecha)) + ' · ' + (row.entrada && !row.salida ? 'Sin salida' : counts.get(row.fecha) > 1 ? 'Varios registros' : 'Provisional') + '</button></p>').join('')
      + (unpaidTrips ? '<button class="btn ghost sm" type="button" data-action="tab" data-tab="viajes">' + unpaidTrips + ' viajes pendientes de cobro</button>' : '');
  }

  function renderDashboard() {
    renderDashboardPeriod();
    renderReviewQueue();
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
    if (status) {
      const hasIncome = t.earned > 0;
      status.textContent = !hasIncome ? 'Sin movimientos' : pct >= 1 ? 'Al día' : pct >= 0.9 ? 'Casi al día' : pct >= 0.5 ? 'Parcial' : 'Pendiente';
      status.className = 'badge ' + (!hasIncome ? 'muted' : pct >= 1 ? 'ok' : pct >= 0.5 ? 'warn' : 'bad');
    }
    renderBars(); renderRecentPayrolls(); renderHero(); renderTodayClock(); renderSparklines(); renderWeek(); renderNextPayroll(); renderHeatmap();
  }

  function renderBars() {
    const box = $('#bars');
    const legend = $('#bars-legend');
    const months = new Set();
    data.jornadas.forEach((j) => months.add(j.fecha.slice(0, 7)));
    data.pagos.forEach((p) => months.add(p.mes_key));
    data.viajes.forEach((v) => months.add(v.fecha.slice(0, 7)));
    const rows = Array.from(months).filter(Boolean).sort().slice(-8).reverse().map((month) => ({
      month, ...monthBreakdown(month), ...overtimeMonthBreakdown(month)
    }));

    const pendingTotal = round2(rows.reduce((sum, row) => sum + row.total, 0));
    $('#bars-total').textContent = fmtMoney(pendingTotal);
    $('#bars-range').textContent = rows.length === 1 ? fmtMonth(rows[0].month)
      : rows.length ? fmtMonth(rows.at(-1).month) + ' – ' + fmtMonth(rows[0].month)
      : 'Por mes';

    const series = [
      { key: 'payroll', label: 'Nóminas' },
      { key: 'extras', label: 'Extras' },
      { key: 'trips', label: 'Viajes' }
    ];
    const max = Math.max(...rows.map((row) => row.total), 1);
    legend.hidden = pendingTotal === 0;
    legend.innerHTML = series.map(({ key, label }) => '<span><i class="legend-dot cash-' + key + '"></i>' + label + '</span>').join('');
    box.innerHTML = !rows.length ? '<p class="empty-chart">Aquí verás las horas y el dinero pendiente cuando registres actividad.</p>'
      : '<ul class="cash-chart">' + rows.map((row) => {
        const month = fmtMonth(row.month);
        const detail = series.map(({ key, label }) => label + ': ' + fmtMoney(row[key])).join(' · ');
        const segments = series.filter(({ key }) => row[key] > 0).map(({ key }) =>
          '<span class="cash-' + key + '" style="width:' + (100 * row[key] / max).toFixed(3) + '%"></span>').join('');
        return `<li class="cash-row" title="${esc(detail)}">
          <span class="chart-month-name">${esc(month)}</span>
          <strong class="cash-amount">${esc(fmtMoney(row.total))}</strong>
          <span class="chart-month-hours">${esc(fmtHours(row.extraHours))} extra</span>
          <div class="cash-track" role="img" aria-label="${esc(detail)}">${segments}</div>
        </li>`;
      }).join('') + '</ul>';

    const overtimeRows = rows.filter((row) => row.extraHours > 0);
    const overtimeDetails = $('#bars-extra-details');
    const overtimeSummary = $('#bars-extra-summary');
    const overtimeHours = round2(overtimeRows.reduce((sum, row) => sum + row.extraHours, 0));
    overtimeSummary.textContent = overtimeRows.length
      ? fmtHours(overtimeHours) + ' confirmadas en el período' : 'Sin extras confirmadas';
    $('#bars-extra-note').hidden = !overtimeRows.length;
    overtimeDetails.innerHTML = overtimeRows.length ? overtimeRows.map(renderOvertimeMonth).join('')
      : '<p class="empty-chart">Las horas extra confirmadas aparecerán aquí, también cuando ya estén pagadas.</p>';
  }

  function renderOvertimeMonth(row) {
    const month = fmtMonth(row.month);
    const stored = setting('overtime_received_' + row.month, '');
    const received = stored === '' ? NaN : num(stored, NaN);
    const hasReceived = Number.isFinite(received) && received >= 0;
    const difference = hasReceived ? round2(row.extraValue - received) : null;
    let comparison = 'Anota el pago para ver la diferencia';
    let comparisonTone = 'muted';
    if (hasReceived) {
      comparisonTone = difference > 0 ? 'bad' : 'ok';
      if (difference > 0) comparison = 'Faltan ' + fmtMoney(difference);
      else if (difference < 0) comparison = fmtMoney(-difference) + ' por encima';
      else comparison = 'Coincide con la tarifa';
    }
    const rate = (amount) => fmtMoney(amount / row.extraHours) + '/h';
    return `<article class="chart-extra-month">
      <header class="chart-extra-top"><h3>${esc(month)}</h3><strong>${esc(fmtHours(row.extraHours))}</strong></header>
      <dl class="chart-extra-values">
        <div><dt>Según tarifa</dt><dd>${esc(fmtMoney(row.extraValue))}<small>${esc(rate(row.extraValue))} de media</small></dd></div>
        <div><dt>Recibido</dt><dd>${hasReceived ? esc(fmtMoney(received)) + '<small>' + esc(rate(received)) + ' de media</small>' : 'Sin registrar'}</dd></div>
      </dl>
      <p class="chart-extra-difference ${comparisonTone}">${esc(comparison)}</p>
      <small class="chart-extra-paid">${esc(fmtHours(row.paidExtraHours))} marcadas como pagadas</small>
      <button class="btn ghost sm chart-extra-edit" type="button" data-action="edit-extra-payment" data-month="${esc(row.month)}"
        aria-label="${esc((hasReceived ? 'Editar pago de ' : 'Anotar pago de ') + month)}">${hasReceived ? 'Editar pago' : 'Anotar pago real'}</button>
    </article>`;
  }

  function renderRecentPayrolls() {
    const box = $('#recent-payrolls'); if (!box) return;
    const rows = effectivePayments().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3);
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
    if (ui.filter === 'confirmado') list = list.filter((j) => j.estado === 'confirmado'); else if (ui.filter === 'provisional') list = list.filter((j) => j.estado === 'provisional'); else if (ui.filter === 'extra') list = list.filter((j) => j.horas_extra > 0); else if (ui.filter === 'pendiente') list = list.filter((j) => j.estado === 'confirmado' && hoursToBill(j) > 0 && !j.pagado_extras);
    const month = $('#jornadas-month')?.value;
    if (month) list = list.filter(j => j.fecha.startsWith(month));
    const project = $('#jornadas-project')?.value.trim().toLocaleLowerCase('es');
    if (project) list = list.filter(j => j.proyectos?.some(row => row.nombre.toLocaleLowerCase('es').includes(project)));
    const q = ui.query.trim().toLowerCase(); if (q) list = list.filter((j) => (j.fecha + ' ' + j.notas + ' ' + j.estado).toLowerCase().indexOf(q) !== -1);
    return list;
  }

  function badgeFor(j) { const state = j.estado === 'provisional' ? '<span class="badge warn">Provisional</span>' : '<span class="badge ok">Confirmada</span>'; return state + (j.auto ? '<span class="badge info">Auto</span>' : '') + '<span class="badge muted">' + esc(cloudSync?.jornadaSyncStatus?.(j) || 'Guardada en este dispositivo') + '</span>'; }

  document.querySelector('#jornadas-month')?.addEventListener('change', () => { ui.limit = 30; renderJornadas(); });

  $('#jornadas-project')?.addEventListener('input', () => { ui.limit = 30; renderJornadas(); });

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

  let closingMonth = '';
  let comparisonMonth = '';
  const payConcepts = { night: 'Nocturnidad', holiday: 'Festivo', standby: 'Guardia', mileage: 'Kilometraje', advance: 'Anticipo', withholding: 'Retención', other: 'Ajuste manual' };
  function payEntries(prefix) {
    return data.ajustes.filter(row => row.clave.startsWith(prefix)).flatMap(row => {
      try {
        const entry = JSON.parse(row.valor);
        return Object.hasOwn(payConcepts, entry.concept) && isDateKey(entry.date) && Number.isFinite(entry.rate) ? [{ ...entry, key: row.clave }] : [];
      } catch (_) { return []; }
    });
  }

  function configuredPayRate(concept, date) {
    const rate = payEntries('pay_rate_').filter(row => row.concept === concept && row.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
    return rate?.rate;
  }

  function payConceptModal(kind, key, correction = false) {
    const isRate = kind === 'rate';
    const prefix = isRate ? 'pay_rate_' : 'pay_entry_';
    const original = key ? payEntries(prefix).find(row => row.key === key) : null;
    const initialDate = original?.date || (closingMonth || monthKey(new Date())) + '-01';
    openModal({
      title: isRate ? 'Tarifa por concepto' : correction ? 'Corregir un mes sin cambiar los cobros' : 'Concepto o ajuste del mes',
      body: '<label class="field"><span>Concepto</span><select class="input" id="pay-concept">' + Object.entries(payConcepts).map(([id, label]) =>
        '<option value="' + id + '"' + ((original?.concept || (correction ? 'other' : '')) === id ? ' selected' : '') + '>' + label + '</option>').join('') + '</select></label>'
        + '<label class="field"><span>' + (isRate ? 'En vigor desde' : 'Fecha del trabajo o ajuste') + '</span><input type="date" class="input" id="pay-concept-date" value="' + esc(initialDate) + '"></label>'
        + (isRate ? '' : '<label class="field"><span>Unidades (horas, kilómetros o 1 para importe fijo)</span><input class="input" inputmode="decimal" id="pay-concept-units" value="' + esc(original?.units ?? 1) + '"></label>')
        + '<label class="field"><span>' + (isRate ? 'Euros por unidad' : 'Euros por unidad. Vacío para aplicar tarifa histórica') + '</span><input class="input" inputmode="decimal" id="pay-concept-rate" value="' + esc(original?.rate == null ? '' : fmtInput(original.rate)) + '"></label>'
        + (isRate ? '' : '<p class="hint">Registra los anticipos como cobros. Usa un importe negativo para una retención.</p><label class="field"><span>Motivo</span><input class="input" maxlength="120" id="pay-concept-note" value="' + esc(original?.note || '') + '"></label><label class="field"><span>Fecha real de ingreso (opcional)</span><input type="date" class="input" id="pay-concept-paid" value="' + esc(original?.paid || '') + '"></label>'),
      onSave() {
        const concept = $('#pay-concept').value;
        const date = $('#pay-concept-date').value;
        const enteredRate = $('#pay-concept-rate').value.trim();
        const rate = enteredRate ? num(enteredRate, NaN) : isRate ? NaN : configuredPayRate(concept, date);
        const units = isRate ? 1 : num($('#pay-concept-units').value, NaN);
        const paid = isRate ? '' : $('#pay-concept-paid').value;
        if (!Object.hasOwn(payConcepts, concept) || !isDateKey(date) || !Number.isFinite(rate) || !Number.isFinite(units) || units <= 0 || !Number.isFinite(rate * units)
          || (paid && !isDateKey(paid)) || (concept === 'advance' && !isRate && (!paid || rate <= 0)) || (concept === 'withholding' && (rate > 0 || paid))) {
          toast('Comprueba la fecha, las unidades, el importe y la fecha de ingreso.', 'error'); return false;
        }
        if (original && setting(key) !== JSON.stringify({ concept: original.concept, date: original.date, rate: original.rate, units: original.units, paid: original.paid, note: original.note })) {
          toast('El registro cambió. Cierra el formulario y vuelve a abrirlo.', 'warn'); return false;
        }
        const target = isRate ? prefix + concept + '_' + date : key || prefix + uid();
        if (key && key !== target) removeSetting(key);
        setSetting(target, JSON.stringify({ concept, date, rate, units, paid, note: isRate ? '' : $('#pay-concept-note').value.trim() }));
        return persist('Concepto guardado');
      },
      onDelete: original ? () => { removeSetting(key); return persist('Concepto eliminado'); } : null
    });
  }

  function payConceptRows(month) {
    const entries = payEntries('pay_entry_').filter(row => row.date.startsWith(month));
    const rates = payEntries('pay_rate_').sort((a, b) => b.date.localeCompare(a.date));
    const list = (rows, action, describe) => rows.map(row => '<p><button class="btn ghost sm" type="button" data-action="' + action + '" data-id="' + esc(row.key) + '">' + esc(payConcepts[row.concept] + ' · ' + fmtDate(row.date)) + '</button> ' + esc(describe(row)) + '</p>').join('');
    return '<details><summary>Complementos, anticipos y retenciones</summary><button class="btn ghost sm" type="button" data-action="pay-concept">Añadir concepto</button> <button class="btn ghost sm" type="button" data-action="pay-rate">Configurar tarifa por fecha</button>'
      + list(entries, 'pay-concept', row => fmtInput(row.units) + ' × ' + fmtMoney(row.rate) + ' = ' + fmtMoney(round2(row.units * row.rate)) + (row.note ? ' · ' + row.note : ''))
      + list(rates, 'pay-rate', row => fmtMoney(row.rate) + ' por unidad') + '</details>';
  }

  function shiftCrossesClockChange(row) {
    if (!row.entrada || !row.salida || row.salida >= row.entrada) return false;
    const start = new Date(row.fecha + 'T' + row.entrada + ':00');
    const endDate = dateKey(addDays(parseKey(row.fecha), 1));
    const end = new Date(endDate + 'T' + row.salida + ':00');
    return end.getTimezoneOffset() !== start.getTimezoneOffset();
  }

  function monthlyFigures(month) {
    const stats = monthStats(month);
    const rows = data.jornadas.filter(row => row.fecha.startsWith(month));
    const trips = data.viajes.filter(row => row.fecha.startsWith(month));
    const payrolls = effectivePayments().filter(row => row.mes_key === month);
    const payroll = payrolls.filter(row => row.tipo === 'nomina_auto');
    const expected = (payroll.length ? payroll.reduce((sum, row) => sum + row.importe, 0) : (payrolls.length ? payrolls.reduce((sum, row) => sum + row.importe, 0) : stats.normalValue))
      + stats.extraValue + trips.reduce((sum, row) => sum + row.importe, 0);
    const received = payrolls.reduce((sum, row) => sum + paidPayroll(row), 0) + trips.reduce((sum, row) => sum + (row.pagado ? row.importe : 0), 0)
      + rows.reduce((sum, row) => sum + (row.pagado_extras && row.estado === 'confirmado' ? hoursToBill(row) * rateOn(row.fecha, 'extra') : 0), 0);
    const cash = effectivePayments().reduce((sum, row) => {
      if (row.abonos?.length) return sum + row.abonos.filter(payment => payment.fecha.startsWith(month)).reduce((total, payment) => total + payment.importe, 0);
      return sum + (row.confirmado && (row.fecha_cobro || row.fecha).startsWith(month) ? row.importe : 0);
    }, 0) + data.viajes.reduce((sum, row) => sum + (row.pagado && (row.fecha_pago || row.fecha).startsWith(month) ? row.importe : 0), 0)
      + data.jornadas.reduce((sum, row) => sum + (row.pagado_extras && row.estado === 'confirmado' && (row.fecha_pago_extras || row.fecha).startsWith(month) ? hoursToBill(row) * rateOn(row.fecha, 'extra') : 0), 0);
    const entries = payEntries('pay_entry_');
    const amount = entry => round2(entry.units * entry.rate);
    const adjustments = entries.filter(entry => entry.date.startsWith(month) && entry.concept !== 'advance').reduce((sum, entry) => sum + amount(entry), 0);
    const receivedAdjustments = entries.filter(entry => entry.date.startsWith(month) && entry.paid).reduce((sum, entry) => sum + amount(entry), 0);
    const cashAdjustments = entries.filter(entry => entry.paid && entry.paid.startsWith(month)).reduce((sum, entry) => sum + amount(entry), 0);
    return { stats, rows, trips, expected: round2(expected + adjustments), received: round2(received + receivedAdjustments), cash: round2(cash + cashAdjustments) };
  }

  function renderMonthlyClosing() {
    const host = $('#monthly-closing');
    if (!host) return;
    const month = closingMonth || monthKey(new Date());
    const summary = monthlyFigures(month);
    const { stats, rows, trips, expected, received, cash } = summary;
    const comparison = comparisonMonth ? monthlyFigures(comparisonMonth) : null;
    const review = rows.map(row => {
      const reasons = [];
      if (row.estado === 'provisional') reasons.push('provisional');
      if (row.entrada && !row.salida) reasons.push('sin salida');
      if (rows.some(other => other !== row && other.fecha === row.fecha)) reasons.push('varios registros en el día');
      if (shiftCrossesClockChange(row)) reasons.push('cruza un cambio de hora local');
      return { row, reasons };
    }).filter(item => item.reasons.length);
    host.innerHTML = '<div class="page-head"><div><h2>Cierre mensual</h2><p class="muted">Importes por mes trabajado</p></div><label class="field"><span>Mes</span><input class="input" type="month" id="closing-month" value="' + esc(month) + '"></label></div>'
      + '<div class="form-grid">' + [['Días registrados', stats.days], ['Horas normales', fmtHours(stats.normal)], ['Horas extra', fmtHours(stats.extra)], ['Viajes y dietas', fmtMoney(trips.reduce((sum, row) => sum + row.importe, 0))], ['Previsto', fmtMoney(expected)], ['Cobrado por este trabajo', fmtMoney(received)], ['Ingresado en este mes', fmtMoney(cash)], ['Diferencia', fmtMoney(round2(expected - received))]].map(([label, value]) => '<div class="row"><span>' + label + '</span><strong>' + esc(value) + '</strong></div>').join('') + '</div>'
      + '<h3>Jornadas por revisar</h3>' + (review.length ? review.map(({ row, reasons }) => '<button type="button" class="btn ghost sm" data-action="edit-jornada" data-id="' + esc(row.id) + '">' + esc(fmtDate(row.fecha) + ' · ' + reasons.join(', ')) + '</button>').join(' ') : '<p class="muted">Sin jornadas abiertas, provisionales o repetidas.</p>')
      + '<details><summary>Desglose de jornadas y tarifas</summary>' + rows.map(row => '<p><button type="button" class="btn ghost sm" data-action="edit-jornada" data-id="' + esc(row.id) + '">' + esc(fmtDate(row.fecha)) + '</button> ' + esc(fmtHours(row.horas_normales) + ' × ' + fmtMoney(rateOn(row.fecha, 'normal')) + ' · ' + fmtHours(row.horas_extra) + ' extra × ' + fmtMoney(rateOn(row.fecha, 'extra'))) + '</p>').join('') + '</details>';
    host.insertAdjacentHTML('beforeend', '<label class="field"><span>Comparar con otro mes</span><input class="input" type="month" id="closing-compare" value="' + esc(comparisonMonth) + '"></label>'
      + (comparison ? '<p><strong>' + esc(fmtMonth(comparisonMonth)) + '</strong> · ' + esc(fmtHours(comparison.stats.normal + comparison.stats.extra) + ' trabajadas · ' + fmtMoney(comparison.received) + ' cobrados · ' + fmtMoney(round2(comparison.expected - comparison.received)) + ' de diferencia') + '</p>' : '')
      + '<button class="btn ghost sm" type="button" data-action="export-closing">Guardar paquete del mes</button> <button class="btn ghost sm" type="button" data-action="month-correction">Añadir corrección al mes</button>');
    host.insertAdjacentHTML('beforeend', payConceptRows(month));
    $('#closing-compare').addEventListener('change', event => {
      comparisonMonth = isDateKey(event.target.value + '-01') ? event.target.value : '';
      renderMonthlyClosing();
    });
    $('#closing-month').addEventListener('change', (event) => {
      if (!isDateKey(event.target.value + '-01')) return;
      closingMonth = event.target.value;
      renderMonthlyClosing();
    });
  }

  async function receiptStore(id, action, value) {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('control-laboral-receipts', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Cierra las otras ventanas.'));
    });
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction('files', action === 'get' ? 'readonly' : 'readwrite');
        const store = transaction.objectStore('files');
        const request = action === 'get' ? store.get(id) : action === 'put' ? store.put(value, id) : store.delete(id);
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = transaction.onerror = () => reject(transaction.error);
      });
    } finally { database.close(); }
  }

  function receiptModal(id) {
    if (demoMode) { toast('Los justificantes se guardan desde tus datos reales.', 'info'); return; }
    if (!editableRecord('pagos', id)) return;
    openModal({
      title: 'Justificante de pago', saveText: 'Adjuntar o sustituir',
      body: '<p class="hint">PDF, JPEG o PNG de hasta 4 MB. El justificante queda en este dispositivo y no viaja en las copias JSON ni en la nube.</p><label class="field"><span>Archivo</span><input class="input" id="receipt-file" type="file" accept="application/pdf,image/jpeg,image/png"></label><button class="btn ghost sm" id="receipt-get" type="button">Guardar una copia del justificante</button>',
      async onSave() {
        const file = $('#receipt-file').files[0];
        const types = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
        if (!file || !Object.hasOwn(types, file.type) || !file.size || file.size > 4 * 1024 * 1024 || !editableRecord('pagos', id)) {
          toast('Elige un PDF, JPEG o PNG de hasta 4 MB.', 'error'); return false;
        }
        try {
          await receiptStore(String(id), 'put', { file: new Blob([file], { type: file.type }), extension: types[file.type] });
          toast('Justificante guardado en este dispositivo.');
          return true;
        } catch (_) { toast('No se pudo guardar el justificante.', 'error'); return false; }
      },
      async onDelete() {
        try { await receiptStore(String(id), 'delete'); toast('Justificante eliminado.'); return true; }
        catch (_) { toast('No se pudo eliminar el justificante.', 'error'); return false; }
      }
    });
    $('#receipt-get').addEventListener('click', async () => {
      try {
        const attachment = await receiptStore(String(id), 'get');
        if (!attachment) { toast('No hay justificante en este dispositivo.', 'info'); return; }
        download(attachment.file, 'justificante.' + attachment.extension);
      } catch (_) { toast('No se pudo abrir el justificante.', 'error'); }
    });
  }

  function rememberInstallment(payment, anterior, next) {
    if (next && anterior.fecha === next.fecha && anterior.importe === next.importe) return;
    const entry = { id: uid(), fecha: new Date().toISOString(), anterior, siguiente: next };
    payment.historial_abonos = [...(payment.historial_abonos || []), entry].slice(-50);
  }

  async function restoreInstallment(payrollId, entryId) {
    const payment = data.pagos.find(row => String(row.id) === String(payrollId));
    const entry = payment?.historial_abonos?.find(row => row.id === entryId);
    if (!entry || payment.confirmado) return;
    const current = (payment.abonos || []).find(row => row.id === entry.anterior.id);
    if (entry.siguiente ? (!current || current.fecha !== entry.siguiente.fecha || current.importe !== entry.siguiente.importe) : current) {
      toast('El abono cambió después de esta corrección. Revisa su valor actual.', 'warn'); return;
    }
    if (round2(paidPayroll(payment) - (current?.importe || 0) + entry.anterior.importe) > payment.importe) {
      toast('El importe restaurado superaría la nómina.', 'error'); return;
    }
    payment.abonos = [...(payment.abonos || []).filter(row => row.id !== entry.anterior.id), { ...entry.anterior }];
    if (current) rememberInstallment(payment, current, entry.anterior);
    if (await persist('Abono restaurado')) partialPayrollModal(payrollId);
  }

  function partialPayrollModal(id, installmentId) {
    const payment = data.pagos.find(row => String(row.id) === String(id));
    if (!payment || payment.confirmado || payment.tipo !== 'nomina_auto') return;
    const installments = payment.abonos || [];
    const original = installmentId == null ? null : installments.find(row => String(row.id) === installmentId);
    if (installmentId != null && !original) return;
    const paid = paidPayroll(payment);
    const sameInstallment = row => row && row.fecha === original.fecha && row.importe === original.importe;
    const unchangedIndex = entries => entries.findIndex(row => String(row.id) === installmentId && sameInstallment(row));
    openModal({
      title: original ? 'Editar abono' : 'Abonos de nómina', saveText: 'Guardar abono',
      body: '<p>Previsto: <strong>' + esc(fmtMoney(payment.importe)) + '</strong> · Cobrado: <strong>' + esc(fmtMoney(paid)) + '</strong> · Pendiente: <strong>' + esc(fmtMoney(round2(payment.importe - paid))) + '</strong></p>'
        + installments.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map(row =>
          '<p>' + esc(fmtDate(row.fecha) + ' · ' + fmtMoney(row.importe)) + ' <button class="btn ghost sm" type="button" data-action="edit-installment" data-id="' + esc(id) + '" data-installment="' + esc(row.id) + '">Editar abono</button></p>').join('')
        + (payment.historial_abonos?.length ? '<details><summary>Correcciones anteriores</summary>' + payment.historial_abonos.slice().reverse().map(entry => '<p>' + esc(fmtDate(entry.anterior.fecha) + ' · ' + fmtMoney(entry.anterior.importe) + (entry.siguiente ? ' → ' + fmtDate(entry.siguiente.fecha) + ' · ' + fmtMoney(entry.siguiente.importe) : ' → Eliminado')) + ' <button type="button" class="btn ghost sm" data-action="restore-installment" data-id="' + esc(id) + '" data-history="' + esc(entry.id) + '">Recuperar valor anterior</button></p>').join('') + '</details>' : '')
        + (original ? '<button class="btn ghost sm" type="button" data-action="partial-payroll" data-id="' + esc(id) + '">Volver al historial</button>' : '')
        + '<label class="field"><span>Fecha de cobro</span><input class="input" type="date" id="partial-date" value="' + esc(original?.fecha || dateKey(new Date())) + '"></label><label class="field"><span>Importe recibido</span><input class="input" inputmode="decimal" id="partial-amount" value="' + esc(original ? fmtInput(original.importe) : '') + '"></label>',
      onSave() {
        const current = data.pagos.find(row => String(row.id) === String(id));
        const amount = round2(num($('#partial-amount').value, 0));
        const date = $('#partial-date').value;
        if (!current || current.confirmado || current.tipo !== 'nomina_auto') {
          toast('La nómina cambió. Vuelve a abrir el historial.', 'warn'); return false;
        }
        const entries = [...(current.abonos || [])];
        const existing = original ? unchangedIndex(entries) : -1;
        if (original && existing < 0) { toast('El abono cambió. Vuelve a abrir el historial.', 'warn'); return false; }
        const available = round2(current.importe - paidPayroll(current) + (original?.importe || 0));
        if (!isDateKey(date) || amount <= 0 || amount > available) {
          toast('Comprueba la fecha y el importe pendiente de la nómina.', 'error');
          return false;
        }
        const record = { id: original?.id || uid(), fecha: date, importe: amount };
        if (original) { rememberInstallment(current, entries[existing], record); entries[existing] = record; } else entries.push(record);
        current.abonos = entries;
        current.manual_edit = true;
        return persist(original ? 'Abono actualizado' : 'Abono guardado');
      },
      onDelete: original ? () => {
        confirmAction('Eliminar abono', 'Se descontarán ' + fmtMoney(original.importe) + ' del importe cobrado.', 'Eliminar abono', () => {
          const current = data.pagos.find(row => String(row.id) === String(id));
          const entries = current?.abonos || [];
          const existing = unchangedIndex(entries);
          if (!current || current.confirmado || existing < 0) { toast('El abono cambió. Revisa el historial.', 'warn'); return false; }
          rememberInstallment(current, entries[existing], null);
          current.abonos = entries.filter((_, index) => index !== existing);
          return persist('Abono eliminado');
        });
        return false;
      } : null
    });
  }

  function renderPagos() {
    renderMonthlyClosing();
    const t = totals();
    const el1 = $('#sum-pending-payrolls'); if (el1) el1.textContent = fmtMoney(t.payrollPending);
    const el2 = $('#sum-pending-extras'); if (el2) el2.textContent = fmtMoney(t.extraPending);
    const el3 = $('#sum-paid'); if (el3) el3.textContent = fmtMoney(t.collected);
    const products = effectivePayments().sort((a, b) => b.fecha.localeCompare(a.fecha));
    const subEl = $('#sum-pending-payrolls-sub'); if (subEl) subEl.textContent = products.filter((p) => !p.confirmado && p.tipo === 'nomina_auto').length + ' sin confirmar';
    const payroll = $('#payroll-list');
    if (payroll) {
      if (!products.length) { payroll.innerHTML = '<div class="empty" style="padding:22px"><strong>Sin nóminas</strong>Se generan al añadir jornadas.</div>'; }
      else {
        payroll.innerHTML = products.map((p) => {
          const ok = p.confirmado; const meta = [fmtMonth(p.mes_key || p.fecha.slice(0, 7))]; if (p.dias_laborables) meta.push(p.dias_laborables + ' días'); if (p.horas_normales_mes) meta.push(fmtHours(p.horas_normales_mes));
          return '<div class="row" style="--edge:' + (ok ? 'var(--ok)' : 'var(--warn)') + '"><div class="main"><p class="title">' + esc(p.concepto) + '</p><p class="sub">' + esc(meta.join(' · ') + (p.abonos?.length ? ' · Cobrado: ' + fmtMoney(paidPayroll(p)) + ' · Pendiente: ' + fmtMoney(p.importe - paidPayroll(p)) : '')) + ' <span class="badge ' + (p.tipo === 'nomina_auto' ? 'info' : 'muted') + '">' + (p.tipo === 'nomina_auto' ? 'Auto' : 'Manual') + '</span></p></div><div class="row-actions"><span class="amount">' + fmtMoney(p.importe) + '</span><button class="btn ghost sm" type="button" data-action="' + (ok ? 'unconfirm-payroll' : 'confirm-payroll') + '" data-id="' + esc(p.id) + '">' + (ok ? 'Deshacer' : p.abonos?.length ? 'Ver abonos' : 'Confirmar') + '</button>' + (!ok && p.tipo === 'nomina_auto' && !p.abonos?.length ? '<button class="btn ghost sm" type="button" data-action="partial-payroll" data-id="' + esc(p.id) + '">Abono</button>' : '') + '<button class="btn ghost sm" type="button" data-action="receipt-payroll" data-id="' + esc(p.id) + '">Justificante</button><button class="icon-btn" type="button" data-action="edit-payroll" data-id="' + esc(p.id) + '" aria-label="Editar"><svg class="i"><use href="#i-pen"></use></svg></button><button class="icon-btn bad" type="button" data-action="delete-payroll" data-id="' + esc(p.id) + '" aria-label="Eliminar"><svg class="i"><use href="#i-trash"></use></svg></button></div></div>';
        }).join('');
      }
    }
    const extras = data.jornadas.filter((j) => j.estado === 'confirmado' && j.horas_extra > 0).sort((a, b) => b.fecha.localeCompare(a.fecha)); const box = $('#extras-list');
    const totalHours = round2(extras.reduce((sum, j) => sum + j.horas_extra, 0)); const totEl = $('#extras-total'); if (totEl) totEl.textContent = fmtHours(totalHours);
    if (!box) return;
    if (!extras.length) { box.innerHTML = '<div class="empty" style="padding:22px"><strong>Sin horas extra</strong>Añádelas desde una jornada.</div>'; return; }
    box.innerHTML = extras.map((j) => {
      const paid = j.pagado_extras; const compensated = j.fecha_compensacion; const value = round2(hoursToBill(j) * rateOn(j.fecha, 'extra'));
      return '<div class="row" style="--edge:' + (paid ? 'var(--ok)' : 'var(--bad)') + '"><div class="main"><p class="title">' + esc(fmtDate(j.fecha)) + ' · +' + fmtHours(j.horas_extra) + '</p><p class="sub">' + fmtMoney(value) + ' · <span class="badge ' + (paid ? 'ok' : 'bad') + '">' + (paid ? 'Pagado' : compensated && !hoursToBill(j) ? 'Compensado con descanso' : 'Pendiente') + '</span></p></div><div class="row-actions">' + (paid ? '<button class="btn ghost sm" type="button" data-action="mark-extra-unpaid" data-id="' + esc(j.id) + '">Deshacer</button>' : '<button class="btn primary sm" type="button" data-action="mark-extra-paid" data-id="' + esc(j.id) + '">Pagado</button>') + (!paid ? '<button class="btn ghost sm" type="button" data-action="compensate-extra" data-id="' + esc(j.id) + '">' + (compensated ? 'Editar descanso' : 'Compensar con descanso') + '</button>' : '') + '</div></div>';
    }).join('');
  }

  function compensateExtra(id) {
    const row = editableRecord('jornadas', id);
    if (!row || row.pagado_extras) return;
    openModal({
      title: 'Compensar horas extra con descanso',
      body: '<label class="field"><span>Día de descanso</span><input id="rest-date" class="input" type="date" value="' + esc(row.fecha_compensacion || dateKey(new Date())) + '"></label><label class="field"><span>Horas compensadas (0 para quitar)</span><input id="rest-hours" class="input" inputmode="decimal" value="' + esc(fmtInput(row.horas_compensadas ?? row.horas_extra)) + '"></label>',
      onSave() {
        const current = editableRecord('jornadas', id);
        const date = $('#rest-date').value;
        const hours = round2(num($('#rest-hours').value, -1));
        if (!current || current.pagado_extras || hours < 0 || hours > current.horas_extra || (hours && !isDateKey(date))) {
          toast('Comprueba la fecha y las horas de descanso.', 'error'); return false;
        }
        if (hours) { current.fecha_compensacion = date; current.horas_compensadas = hours; }
        else { delete current.fecha_compensacion; delete current.horas_compensadas; }
        return persist('Compensación guardada');
      }
    });
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

  $('#calendar-inspect')?.addEventListener('change', renderCalendarDay);
  function renderCalendarDay() {
    const host = $('#calendar-day-detail');
    const date = $('#calendar-inspect')?.value;
    if (!host || !isDateKey(date)) return;
    const shifts = data.jornadas.filter(row => row.fecha === date);
    const incident = calendarEntryOn(date);
    const plan = scheduleWindow();
    const weekday = parseKey(date).getDay();
    const planned = plan && weekday !== 0 && weekday !== 6 && !incident ? Math.max(0, plan.hours - habitualPauseMinutes() / 60) : 0;
    const worked = shifts.filter(row => row.estado === 'confirmado' && row.salida).reduce((sum, row) => sum + row.horas_normales + row.horas_extra, 0);
    host.innerHTML = '<p>Previsto según horario habitual: <strong>' + esc(fmtHours(planned)) + '</strong> · Registrado: <strong>' + esc(fmtHours(worked)) + '</strong></p>'
      + shifts.map(row => '<p><button type="button" class="btn ghost sm" data-action="edit-jornada" data-id="' + esc(row.id) + '">Editar jornada</button> ' + esc((row.entrada || '—') + '–' + (row.salida || '—') + ' · Pausa ' + row.descanso_minutos + ' min · ' + fmtHours(row.horas_extra) + ' extra') + '</p>').join('')
      + '<button type="button" class="btn ghost sm" data-action="' + (incident ? 'edit-calendar' : 'calendar-inspect-add') + '" data-id="' + esc(incident?.id || '') + '">' + (incident ? 'Editar incidencia' : 'Añadir incidencia este día') + '</button>';
  }

  function renderCalendar() {
    const dateField = $('#calendar-inspect');
    if (dateField && !dateField.value) dateField.value = dateKey(new Date());
    renderCalendarDay();
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
            .map(key => {
        const label = labels[key] || key.replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase());
        const display = value => value == null || value === '' ? '—' : value === true ? 'Sí' : value === false ? 'No' : typeof value === 'object' ? JSON.stringify(value) : String(value);
        return label + ': ' + display(chosen?.[key]) + ' → ' + display(alternate?.[key]);
      });
  }

  function mergeShiftConflict(id) {
    const conflict = cloudSync?.getConflicts().find(item => item.id === id && !item.resolved && item.collection === 'jornadas');
    if (!conflict) return;
    const labels = { entrada: 'Entrada', salida: 'Salida', descanso_minutos: 'Pausa (minutos)', interrupciones: 'Intervalos', horas_normales: 'Horas normales', horas_extra: 'Horas extra', notas: 'Notas', estado: 'Estado', fecha: 'Fecha' };
    const fields = Object.keys(labels).filter(key => JSON.stringify(conflict.chosen[key] ?? null) !== JSON.stringify(conflict.alternate[key] ?? null));
    if (!fields.length) { toast('Utiliza una de las dos versiones para resolver este conflicto.', 'info'); return; }
    const display = value => value == null || value === '' ? '—' : Array.isArray(value) ? value.map(row => row.desde + '–' + row.hasta).join(', ') : String(value);
    const combined = () => {
      const result = { ...conflict.chosen };
      for (const key of fields) {
        const source = $('#merge-' + key).value === 'alternate' ? conflict.alternate : conflict.chosen;
        if (Object.hasOwn(source, key)) result[key] = source[key]; else delete result[key];
      }
      const net = result.entrada && result.salida ? minutesBetween(result.entrada, result.salida) : null;
      const gaps = net == null ? 0 : interruptionMinutes(result.entrada, result.salida, result.interrupciones || []);
      const pause = recordPauseMinutes(result);
      const tracked = round2(num(result.horas_normales, 0) + num(result.horas_extra, 0));
      const total = net == null || gaps == null ? null : round2((net - gaps - pause) / 60);
      const valid = isDateKey(result.fecha) && tracked >= 0 && tracked <= 24
        && (!result.entrada || !result.salida || (total != null && total >= 0 && net > 0))
        && (!result.interrupciones?.length || total != null)
        && (!conflict.chosen.pagado_extras || (result.horas_extra === conflict.chosen.horas_extra && result.fecha === conflict.chosen.fecha));
      return { result, tracked, total, valid };
    };
    openModal({
      title: 'Combinar versiones de la jornada',
      body: fields.map(key => '<label class="field"><span>' + labels[key] + '</span><select class="input merge-shift-field" id="merge-' + key + '"><option value="chosen">Aplicada · ' + esc(display(conflict.chosen[key])) + '</option><option value="alternate">Alternativa · ' + esc(display(conflict.alternate[key])) + '</option></select></label>').join('')
        + '<p class="hint" id="merge-shift-preview" role="status"></p>',
      onSave() {
        const { result, valid } = combined();
        if (!valid) { toast('Revisa el horario, las pausas y las horas. Si hay extras cobradas, conserva su fecha e importe.', 'error'); return false; }
        if (!cloudSync.resolveConflict(id, result)) { toast('La jornada cambió. Vuelve a abrir la revisión.', 'warn'); return false; }
        toast('Jornada combinada. Cambios pendientes de sincronizar.');
        return true;
      }
    });
    const preview = () => {
      const { tracked, total } = combined();
      $('#merge-shift-preview').textContent = 'Horas que se guardarán: ' + fmtHours(tracked) + (total == null ? '' : ' · Tiempo según horario y pausas: ' + fmtHours(total));
    };
    $$('.merge-shift-field').forEach(field => field.addEventListener('change', preview));
    preview();
  }

  function renderSyncConflicts() {
    const box = $('#sync-conflicts'); if (!box) return;
    const conflicts = cloudSync?.getConflicts() || [];
    const pending = conflicts.filter((item) => !item.resolved).slice().reverse();
    if (!pending.length) { box.innerHTML = conflicts.length ? '<p class="muted small" style="margin:0">Conflictos revisados: ' + conflicts.length + '</p>' : ''; return; }
    box.innerHTML = '<p class="eyebrow" style="margin:8px 0 0">Revisar cambios entre dispositivos</p>' + pending.map((item) => '<div class="row" style="--edge:var(--warn)"><div class="main"><p class="title">' + esc(({ jornadas: 'Jornada', viajes: 'Viaje', pagos: 'Pago', ausencias: 'Incidencia' })[item.collection] || 'Registro') + ' · dos versiones</p><p class="sub"><b>Campos distintos:</b> ' + esc(conflictDifferences(item.chosen, item.alternate).join(' · ') || 'Ninguno (solo metadatos)') + '<br><b>Versión aplicada:</b> ' + esc(conflictItemLabel(item.collection, item.chosen)) + '<br><b>Versión alternativa:</b> ' + esc(conflictItemLabel(item.collection, item.alternate)) + '</p></div><div class="row-actions"><button class="btn ghost sm" type="button" data-action="resolve-conflict" data-id="' + esc(item.id) + '" data-choice="keep">Conservar aplicada</button><button class="btn primary sm" type="button" data-action="resolve-conflict" data-id="' + esc(item.id) + '" data-choice="restore">Restaurar alternativa</button>' + (item.collection === 'jornadas' ? '<button class="btn ghost sm" type="button" data-action="merge-shift-conflict" data-id="' + esc(item.id) + '">Combinar campos</button>' : '') + '</div></div>').join('');
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
    const extrasFirst = setting('extras_first', '0') === '1';
    const finance = $('.dash-finance');
    const overtime = $('.dash-overtime');
    const cash = $('.dash-cash');
    if (finance && overtime && cash) {
      const anchor = extrasFirst ? finance : cash.nextElementSibling;
      const parent = extrasFirst ? finance.parentElement : finance;
      if (overtime.parentElement !== parent) parent.insertBefore(overtime, anchor);
    }
    const extrasToggle = $('#extras-first'); if (extrasToggle) extrasToggle.checked = extrasFirst;
    const reminder = $('#review-month-end'); if (reminder) reminder.checked = setting('review_month_end', '0') === '1';
    document.body?.classList.toggle('outdoor-mode', setting('outdoor_mode', '0') === '1');
    const outdoor = $('#outdoor-toggle'); if (outdoor) outdoor.checked = setting('outdoor_mode', '0') === '1';
    const goal = $('#weekly-goal'); if (goal) goal.value = setting('weekly_goal', '40');
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
    img.onload = () => { clearTimeout(timer); logoRatioProbe = false; if (setting('custom_logo') !== logo) return; setSetting('logo_ratio', String(round2(img.width / Math.max(1, img.height)))); try { localStorage.setItem(KEY, JSON.stringify(data)); cloudSync?.queue(data); } catch (err) {} applyBranding(); renderLogoPreview(); };
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
    renderAll();
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
    openModal({ title, body: '<p class="muted" style="white-space:pre-line">' + esc(message) + '</p>', saveText: confirmText || 'Confirmar', danger: Boolean(danger), onSave: async () => {
      const previous = JSON.parse(JSON.stringify(data));
      const result = await onConfirm();
      if (result === false) return false;
      if (localStorage.flush) await localStorage.flush();
      if (danger && title !== 'Borrar todos los datos') rememberDeleted(previous);
      return true;
    } });
  }
  function rememberDeleted(previous) {
    const removed = {};
    for (const collection of ['jornadas', 'viajes', 'pagos', 'ausencias']) {
      removed[collection] = previous[collection].filter(row => !data[collection].some(current => (current.id || current.fecha) === (row.id || row.fecha)));
    }
    if (!Object.values(removed).some(rows => rows.length)) return;
    undoRecords = removed;
    const button = $('#undo-delete'); if (button) button.hidden = false;
  }

  function editableRecord(collection, id) {
    const current = data[collection].find((row) => String(row.id) === String(id));
    if (!current) toast('El registro se eliminó en otro dispositivo. Cierra el formulario para actualizar la lista.', 'warn');
    return current;
  }

  function changesFromForm(original, current, payload) {
    const changes = {};
    for (const [key, value] of Object.entries(payload)) {
      const before = typeof original[key] === 'string' ? original[key].trim() : original[key];
      const latest = typeof current[key] === 'string' ? current[key].trim() : current[key];
      if (value === before || value === latest) continue;
      if (before !== latest) {
        toast('Este registro cambió en otro dispositivo. Vuelve a abrirlo para revisar la última versión.', 'warn');
        return null;
      }
      changes[key] = value;
    }
    return changes;
  }

  function clockIn() {
    const now = new Date(); const today = dateKey(now); const time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    let j = openJornadaForDate(today) || data.jornadas.find((x) => x.fecha === today && !x.entrada && !x.salida);
    if (!j && jornadaForDate(today)?.salida) { toast('La jornada ya está cerrada. Edítala si necesitas corregirla.', 'warn'); return; }
    if (!j) { j = { id: uid(), fecha: today, entrada: time, salida: '', horas_normales: 0, horas_extra: 0, descanso_minutos: habitualPauseMinutes(), estado: 'confirmado', notas: '[Fichado en la app]', pagado_extras: false, fecha_pago_extras: '', auto: false, backfill: false, creado: now.toISOString() }; data.jornadas.push(j); }
    else { if (!j.entrada) j.descanso_minutos = habitualPauseMinutes(); j.entrada = time; j.estado = 'confirmado'; if (!j.notas) j.notas = '[Fichado en la app]'; }
    j.auto = false; j.backfill = false;
    persist('Entrada guardada en este dispositivo · ' + time);
  }

  function intervalsThrough(shift, time) {
    const intervals = [...(shift.interrupciones || [])];
    if (shift.pausa_desde && shift.pausa_desde !== time) intervals.push({ desde: shift.pausa_desde, hasta: time });
    return intervals;
  }

  function toggleLivePause() {
    const now = new Date();
    const shift = openJornadaForDate(dateKey(now)) || openJornadaForDate(dateKey(addDays(now, -1)));
    if (!shift) return;
    const time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    if (shift.pausa_desde) {
      const intervals = intervalsThrough(shift, time);
      if (interruptionMinutes(shift.entrada, time, intervals) == null) {
        toast('Revisa el horario antes de cerrar la pausa.', 'error');
        return;
      }
      shift.interrupciones = intervals;
      delete shift.pausa_desde;
      return persist('Pausa guardada · ' + time);
    }
    if ((shift.interrupciones || []).length >= 20) { toast('Ya hay 20 pausas en esta jornada.', 'warn'); return; }
    shift.pausa_desde = time;
    shift.descanso_minutos = 0;
    shift.auto = false;
    return persist('Pausa iniciada · ' + time);
  }

  async function clockOut() {
    const now = new Date(); const today = dateKey(now); const yesterday = dateKey(addDays(now, -1)); const time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    let j = openJornadaForDate(today);
    if (!j) j = openJornadaForDate(yesterday);
    if (!j) { toast('Primero registra la entrada.', 'warn'); return; }
    if (j.salida) { toast('Ya has fichado la salida.', 'warn'); return; }
    const elapsed = minutesBetween(j.entrada, time);
    if (elapsed == null) { toast('Revisa la hora de entrada.', 'error'); return; }
    const intervals = intervalsThrough(j, time);
    const gaps = interruptionMinutes(j.entrada, time, intervals);
    if (gaps == null) { toast('Revisa los intervalos de pausa de la jornada.', 'error'); return; }
    const pauseMinutes = recordPauseMinutes(j) + gaps;
    if (pauseMinutes > elapsed) { toast('La pausa supera el tiempo fichado. Edita la pausa de la jornada antes de cerrar.', 'error'); return; }
    const worked = round2((elapsed - pauseMinutes) / 60);
    const base = rateOn(j.fecha, 'jornada');
    if (intervals.length) j.interrupciones = intervals;
    delete j.pausa_desde;
    j.salida = time; j.horas_normales = round2(Math.min(worked, base)); j.horas_extra = round2(Math.max(0, worked - base)); j.estado = 'confirmado';
    if (worked < base) { const short = round2(base - worked); j.notas = (j.notas ? j.notas + ' | ' : '') + 'Salida anticipada: ' + fmtHours(short) + ' menos.'; }
    j.auto = false; j.backfill = false;
    if (!await persist('Salida guardada en este dispositivo · ' + time + ' · ' + fmtHours(worked))) return;
    if (!demoMode) notify('Jornada cerrada', 'Has trabajado ' + fmtHours(worked) + ' hoy.');
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

  function shiftTemplates() {
    return data.ajustes.filter(row => row.clave.startsWith('turno_')).flatMap(row => {
      try {
        const template = JSON.parse(row.valor);
        return typeof template.name === 'string' && hhmm(template.start) && hhmm(template.end) ? [template] : [];
      } catch (_) { return []; }
    });
  }

  function saveShiftTemplate() {
    openModal({
      title: 'Guardar plantilla de jornada',
      body: '<label class="field"><span>Nombre</span><input class="input" id="template-name" maxlength="60"></label><div class="form-grid"><label class="field"><span>Entrada</span><input class="input" id="template-in" type="time"></label><label class="field"><span>Salida</span><input class="input" id="template-out" type="time"></label><label class="field"><span>Pausa (min)</span><input class="input" id="template-pause" type="number" min="0" value="0"></label></div>',
      onSave() {
        const name = $('#template-name').value.trim();
        const start = hhmm($('#template-in').value);
        const end = hhmm($('#template-out').value);
        const pause = num($('#template-pause').value, -1);
        const duration = minutesBetween(start, end);
        if (!name || !duration || !Number.isInteger(pause) || pause < 0 || pause > duration) {
          toast('Comprueba el nombre, el horario y la pausa.', 'error'); return false;
        }
        setSetting('turno_' + name.toLocaleLowerCase('es'), JSON.stringify({ name, start, end, pause }));
        return persist('Plantilla guardada');
      }
    });
  }

  function jornadaModal(id) {
    if (id == null || id === '') {
      const existingToday = jornadaForDate(dateKey(new Date()));
      id = existingToday ? existingToday.id : null;
    }
    const isNew = id == null;
    const record = isNew ? null : editableRecord('jornadas', id);
    if (!isNew && !record) return;
    const today = dateKey(new Date()); const defaultPause = habitualPauseMinutes(); const base = { fecha: today, entrada: '', salida: '', horas_normales: round2(Math.max(0, rateOn(today, 'jornada') - defaultPause / 60)), horas_extra: 0, descanso_minutos: defaultPause, estado: 'confirmado', notas: '' };
    const item = record ? { ...record } : base;
    let verifiedDuration = '';
    const template = scheduleWindow();
    const templates = shiftTemplates();
    openModal({
      title: isNew ? 'Nueva jornada' : 'Editar jornada',
      body: '<div class="form-grid"><label class="field"><span>Fecha</span><input class="input" id="f-fecha" type="date" value="' + esc(item.fecha) + '"></label><label class="field"><span>Estado</span><select class="input" id="f-estado"><option value="confirmado"' + (item.estado === 'confirmado' ? ' selected' : '') + '>Confirmada</option><option value="provisional"' + (item.estado === 'provisional' ? ' selected' : '') + '>Provisional</option></select></label><label class="field"><span>Entrada</span><input class="input mono" id="f-entrada" type="time" value="' + esc(item.entrada) + '"></label><label class="field"><span>Salida</span><input class="input mono" id="f-salida" type="time" value="' + esc(item.salida) + '"></label><label class="field"><span>Pausa no computable (min)</span><input class="input mono" id="f-pausa" type="number" min="0" max="1440" step="1" value="' + esc(recordPauseMinutes(item)) + '"></label><label class="field"><span>Horas normales</span><input class="input mono" id="f-normales" type="text" inputmode="decimal" value="' + fmtInput(item.horas_normales) + '"></label><label class="field"><span>Horas extra</span><input class="input mono" id="f-extra" type="text" inputmode="decimal" value="' + fmtInput(item.horas_extra) + '"></label></div><div class="hint-row"><button class="btn ghost sm" type="button" id="calc-hours">Calcular desde fichaje</button><span class="muted small" id="calc-hint"></span></div><label class="field"><span>Notas</span><textarea class="input" id="f-notas" rows="3">' + esc(item.notas) + '</textarea></label>'
        + '<label class="field"><span>Intervalos sin trabajar, uno por línea (HH:MM-HH:MM)</span><textarea class="input" id="shift-gaps" rows="2" placeholder="12:00-16:00">' + esc((item.interrupciones || []).map(row => row.desde + '-' + row.hasta).join('\n')) + '</textarea></label>'
        + '<label class="field"><span>Horas por empresa, obra o proyecto (nombre | horas, uno por línea)</span><textarea class="input" id="shift-projects" rows="2" placeholder="Obra A | 5&#10;Obra B | 3">' + esc((item.proyectos || []).map(row => row.nombre + ' | ' + fmtInput(row.horas)).join('\n')) + '</textarea></label>'
        + (templates.length ? '<label class="field"><span>Aplicar plantilla</span><select class="input" id="choose-template"><option value="">Seleccionar</option>' + templates.map((row, index) => '<option value="' + index + '">' + esc(row.name) + '</option>').join('') + '</select></label>' : '')
        + (template ? '<button type="button" class="btn ghost sm" id="apply-shift-template">Usar horario habitual</button>' : '')
        + (item.historial?.length ? '<details><summary>Historial de esta jornada</summary>' + item.historial.slice().reverse().map((entry, index) => '<p>' + esc(entry.fecha.replace('T', ' ').slice(0, 16)) + ' UTC · <button class="btn ghost sm" type="button" data-history-index="' + index + '">Cargar valores anteriores</button></p>').join('') + '</details>' : ''),
      onSave: () => {
        let j = isNew ? null : editableRecord('jornadas', id);
        if (!isNew && !j) return false;
        const fecha = $('#f-fecha').value; if (!isDateKey(fecha)) { toast('Fecha no válida.', 'error'); return false; }
        const normales = num($('#f-normales').value, -1); const extra = num($('#f-extra').value, -1); const pauseMinutes = num($('#f-pausa').value, -1);
        if (!Number.isInteger(pauseMinutes) || pauseMinutes < 0 || pauseMinutes > 1440) { toast('La pausa debe ser un número entero entre 0 y 1.440 minutos.', 'error'); return false; }
        if (normales < 0 || extra < 0 || normales > 24 || extra > 24) { toast('Horas entre 0 y 24.', 'error'); return false; }
        if (round2(normales + extra) > 24) { toast('No puede superar 24 h en un día.', 'error'); return false; }
        const payload = { fecha, entrada: hhmm($('#f-entrada').value), salida: hhmm($('#f-salida').value), horas_normales: round2(normales), horas_extra: round2(extra), descanso_minutos: pauseMinutes, estado: $('#f-estado').value === 'provisional' ? 'provisional' : 'confirmado', notas: $('#f-notas').value.trim() };
        const rawIntervals = ($('#shift-gaps')?.value || '').trim();
        if (rawIntervals || item.interrupciones?.length) {
          const lines = rawIntervals ? rawIntervals.split(/\r?\n/) : [];
          const intervals = lines.map(line => {
            const match = /^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/.exec(line.trim());
            return { desde: match?.[1], hasta: match?.[2] };
          });
          const gaps = interruptionMinutes(payload.entrada, payload.salida, intervals);
          const duration = minutesBetween(payload.entrada, payload.salida);
          if (intervals.length > 20 || gaps == null || gaps + pauseMinutes > duration) {
            toast('Ordena los intervalos sin solaparlos y mantenlos dentro del horario.', 'error');
            return false;
          }
          if (JSON.stringify(intervals) !== JSON.stringify(item.interrupciones || []) || payload.entrada !== item.entrada || payload.salida !== item.salida || pauseMinutes !== item.descanso_minutos) {
            payload.interrupciones = intervals;
            const worked = round2((duration - gaps - pauseMinutes) / 60);
            const baseHours = rateOn(fecha, 'jornada');
            payload.horas_normales = round2(Math.min(worked, baseHours));
            payload.horas_extra = round2(Math.max(0, worked - baseHours));
          }
        }
        const rawProjects = ($('#shift-projects')?.value || '').trim();
        if (rawProjects || item.proyectos?.length) {
          const projects = rawProjects ? rawProjects.split(/\r?\n/).map(line => {
            const separator = line.lastIndexOf('|');
            if (separator < 0) return null;
            return { nombre: line.slice(0, separator).trim(), horas: round2(num(line.slice(separator + 1), -1)) };
          }) : [];
          if (projects.length > 20 || projects.some(row => !row || !row.nombre || row.nombre.length > 80 || row.horas <= 0)
            || round2(projects.reduce((sum, row) => sum + row.horas, 0)) > round2(payload.horas_normales + payload.horas_extra)) {
            toast('Revisa los nombres y las horas de proyecto. Su suma no puede superar las horas de la jornada.', 'error');
            return false;
          }
          if (JSON.stringify(projects) !== JSON.stringify(item.proyectos || [])) payload.proyectos = projects;
        }
        const changes = j ? changesFromForm(item, j, payload) : payload;
        if (!changes) return false;
        const result = { ...j, ...changes };
        const duplicate = data.jornadas.find((row) => row.fecha === result.fecha && (!j || String(row.id) !== String(j.id)) && !row.auto);
        if (duplicate && (!j || j.fecha !== result.fecha)) { toast('Ya existe una jornada para esa fecha. Ábrela desde la lista y edítala para evitar duplicarla.', 'warn'); return false; }
        const elapsed = result.entrada && result.salida ? minutesBetween(result.entrada, result.salida) : null;
        if (result.entrada && result.salida && (!Number.isFinite(elapsed) || elapsed === 0)) { toast('Horario no válido: entrada y salida deben ser distintas.', 'error'); return false; }
        const durationKey = [result.fecha, result.entrada, result.salida, result.descanso_minutos].join('|');
        if (elapsed > 16 * 60 && durationKey !== verifiedDuration && (!j || j.entrada !== result.entrada || j.salida !== result.salida)) {
          verifiedDuration = durationKey;
          toast('Este turno duraría ' + fmtHours(elapsed / 60) + '. Revisa las horas o pulsa Guardar otra vez para confirmar.', 'warn');
          return false;
        }
        if (elapsed != null && result.descanso_minutos > elapsed) { toast('La pausa no puede superar el tiempo fichado.', 'error'); return false; }
        if (round2(result.horas_normales + result.horas_extra) > 24) { toast('No puede superar 24 h en un día.', 'error'); return false; }
        const automaticDuplicate = !j && data.jornadas.find((row) => row.fecha === result.fecha && row.auto);
        if (automaticDuplicate) j = automaticDuplicate;
        if (j) {
          const extrasChanged = round2(j.horas_extra) !== result.horas_extra;
          const before = {};
          for (const field of ['entrada', 'salida', 'descanso_minutos', 'horas_normales', 'horas_extra', 'notas', 'estado']) {
            if (Object.prototype.hasOwnProperty.call(changes, field) && changes[field] !== j[field]) before[field] = j[field];
          }
          if (Object.keys(before).length) j.historial = [...(j.historial || []), { fecha: new Date().toISOString(), campos: before }].slice(-12);
          Object.assign(j, changes, { auto: false, backfill: false });
          if (j.salida) delete j.pausa_desde;
          if (extrasChanged) { j.pagado_extras = false; j.fecha_pago_extras = ''; }
        } else data.jornadas.push({ id: uid(), pagado_extras: false, fecha_pago_extras: '', creado: new Date().toISOString(), ...payload, auto: false, backfill: false });
        return persist(isNew ? 'Jornada creada' : 'Jornada actualizada');
      },
      onDelete: record ? () => {
        const current = editableRecord('jornadas', id);
        if (!current) return false;
        if (current.fecha === dateKey(new Date()) && current.auto) setSetting('auto_dismissed', current.fecha);
        data.jornadas = data.jornadas.filter((row) => row !== current);
        return persist('Jornada eliminada');
      } : null
    });
    $('#choose-template')?.addEventListener('change', event => {
      const chosen = event.target.value === '' ? null : templates[Number(event.target.value)];
      if (!chosen) return;
      $('#f-entrada').value = chosen.start;
      $('#f-salida').value = chosen.end;
      $('#f-pausa').value = chosen.pause;
      $('#shift-gaps').value = '';
      $('#calc-hours').click();
    });
    $('#apply-shift-template')?.addEventListener('click', () => {
      $('#f-entrada').value = template.start;
      $('#f-salida').value = template.end;
      $('#f-pausa').value = habitualPauseMinutes();
      $('#calc-hours').click();
    });
    const fields = { entrada: 'f-entrada', salida: 'f-salida', descanso_minutos: 'f-pausa', horas_normales: 'f-normales', horas_extra: 'f-extra', notas: 'f-notas', estado: 'f-estado' };
    if (item.historial?.length) $('[data-history-index]').forEach(button => button.addEventListener('click', () => {
      const entry = item.historial[item.historial.length - 1 - Number(button.dataset.historyIndex)];
      if (!entry) return;
      for (const [field, id] of Object.entries(fields)) if (Object.prototype.hasOwnProperty.call(entry.campos, field)) $('#' + id).value = entry.campos[field];
      toast('Valores cargados. Pulsa Guardar para aplicar.', 'info');
    }));
    const calc = $('#calc-hours');
    if (calc) calc.addEventListener('click', () => { const grossMinutes = minutesBetween($('#f-entrada').value, $('#f-salida').value); if (grossMinutes == null) { toast('Indica entrada y salida.', 'warn'); return; } const pauseMinutes = num($('#f-pausa').value, -1); if (!Number.isInteger(pauseMinutes) || pauseMinutes < 0 || pauseMinutes > grossMinutes) { toast('La pausa debe ser un número válido y no superar el tiempo fichado.', 'warn'); return; } const worked = netHoursBetween($('#f-entrada').value, $('#f-salida').value, pauseMinutes); const b = rateOn($('#f-fecha').value, 'jornada'); $('#f-normales').value = round2(Math.min(worked, b)); $('#f-extra').value = round2(Math.max(0, worked - b)); const hintEl = $('#calc-hint'); if (hintEl) hintEl.textContent = hoursFmt.format(grossMinutes / 60) + ' h fichadas − ' + pauseMinutes + ' min = ' + fmtHours(worked); toast('Horas calculadas.', 'info'); });
  }

  function extraModal(id) {
    const j = data.jornadas.find((x) => String(x.id) === String(id)); if (!j) return;
    openModal({
      title: 'Añadir horas extra', saveText: 'Añadir',
      body: '<div class="card" style="padding:12px;margin-bottom:14px;background:rgba(0,0,0,.2)"><p class="small muted" style="margin:0 0 2px">Jornada</p><strong>' + esc(fmtDate(j.fecha)) + '</strong><p class="small muted" style="margin:4px 0 0">Actualmente: <b style="color:var(--brand)">' + fmtHours(j.horas_extra) + '</b> (normales ' + fmtHours(j.horas_normales) + ')</p></div><label class="field"><span>Horas a añadir</span><input class="input mono" id="x-hours" type="text" inputmode="decimal" placeholder="1,5"></label><label class="field"><span>Motivo (opcional)</span><input class="input" id="x-note" maxlength="120"></label>',
      onSave: () => {
        const j = editableRecord('jornadas', id);
        if (!j) return false;
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

  function calendarModal(id, selectedDate) {
    const existing = id ? data.ausencias.find((item) => String(item.id) === String(id)) : null;
    if (id && !existing) return;
    const item = existing || { fecha: selectedDate || dateKey(new Date()), tipo: 'vacaciones', concepto: '', notas: '' };
    const group = existing ? String(existing.grupo || existing.id) : uid();
    openModal({
      title: existing ? 'Editar incidencia' : 'Añadir al calendario',
      body: '<div class="form-grid"><label class="field"><span>Desde</span><input class="input" id="c-desde" type="date" value="' + esc(item.fecha) + '"></label><label class="field"><span>Hasta</span><input class="input" id="c-hasta" type="date" value="' + esc(item.fecha) + '"></label><label class="field"><span>Tipo</span><select class="input" id="c-tipo"><option value="descanso"' + (item.tipo === 'descanso' ? ' selected' : '') + '>Descanso</option><option value="vacaciones"' + (item.tipo === 'vacaciones' ? ' selected' : '') + '>Vacaciones</option><option value="baja"' + (item.tipo === 'baja' ? ' selected' : '') + '>Baja</option><option value="festivo"' + (item.tipo === 'festivo' ? ' selected' : '') + '>Festivo</option><option value="otro"' + (item.tipo === 'otro' ? ' selected' : '') + '>Otra incidencia</option></select></label></div><label class="field"><span>Nombre o motivo</span><input class="input" id="c-concepto" maxlength="80" value="' + esc(item.concepto) + '" placeholder="Opcional"></label><label class="field"><span>Notas</span><textarea class="input" id="c-notas" rows="2" maxlength="240">' + esc(item.notas) + '</textarea></label><p class="hint">La incidencia se guarda como anotación. No altera jornadas ya registradas ni calcula importes de vacaciones o bajas.</p>',
      onSave: () => {
        const from = $('#c-desde').value; const to = $('#c-hasta').value; const tipo = $('#c-tipo').value;
        const current = existing ? editableRecord('ausencias', id) : null;
        if (existing && !current) return false;
        if (current && ['fecha', 'grupo', 'tipo', 'concepto', 'notas'].some((key) => current[key] !== existing[key])) {
          toast('La incidencia cambió en otro dispositivo. Vuelve a abrirla para revisar la última versión.', 'warn');
          return false;
        }
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
      onDelete: existing ? () => {
        const current = editableRecord('ausencias', id);
        if (!current) return false;
        const currentGroup = String(current.grupo || current.id);
        data.ausencias = data.ausencias.filter((row) => String(row.grupo || row.id) !== currentGroup);
        return persist('Incidencia eliminada');
      } : null
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
    const item = v ? { ...v } : { fecha: dateKey(new Date()), concepto: '', importe: '', notas: '' };
    openModal({
      title: isNew ? 'Nuevo viaje' : 'Editar viaje',
      body: '<label class="field"><span>Concepto</span><input class="input" id="t-concepto" maxlength="80" value="' + esc(item.concepto) + '"></label><div class="form-grid"><label class="field"><span>Fecha</span><input class="input" id="t-fecha" type="date" value="' + esc(item.fecha) + '"></label><label class="field"><span>Importe (€)</span><input class="input mono" id="t-importe" type="text" inputmode="decimal" value="' + esc(fmtInput(item.importe)) + '"></label></div><label class="field"><span>Notas</span><input class="input" id="t-notas" maxlength="140" value="' + esc(item.notas) + '"></label>',
      onSave: () => {
        const concepto = $('#t-concepto').value.trim(); const fecha = $('#t-fecha').value; const importe = num($('#t-importe').value, -1);
        if (!concepto) { toast('Indica concepto.', 'error'); return false; } if (!isDateKey(fecha)) { toast('Fecha no válida.', 'error'); return false; } if (importe < 0) { toast('Importe no válido.', 'error'); return false; }
        const payload = { concepto, fecha, importe: round2(importe), notas: $('#t-notas').value.trim() };
        if (v) {
          const current = editableRecord('viajes', id);
          if (!current) return false;
          const changes = changesFromForm(item, current, payload);
          if (!changes) return false;
          Object.assign(current, changes);
        } else data.viajes.push(Object.assign({ id: uid(), pagado: 0, fecha_pago: '', creado: new Date().toISOString() }, payload));
        return persist(isNew ? 'Viaje añadido' : 'Viaje actualizado');
      },
      onDelete: v ? () => {
        const current = editableRecord('viajes', id);
        if (!current) return false;
        data.viajes = data.viajes.filter((row) => row !== current);
        return persist('Viaje eliminado');
      } : null
    });
  }

  function payrollModal(id) {
    const p = data.pagos.find((x) => String(x.id) === String(id)); if (!p) return;
    const original = { ...p };
    openModal({
      title: 'Editar nómina',
      body: '<label class="field"><span>Concepto</span><input class="input" id="p-concepto" maxlength="80" value="' + esc(p.concepto) + '"></label><div class="form-grid"><label class="field"><span>Importe (€)</span><input class="input mono" id="p-importe" type="text" inputmode="decimal" value="' + fmtInput(p.importe) + '"></label><label class="field"><span>Fecha</span><input class="input" id="p-fecha" type="date" value="' + esc(p.fecha) + '"></label></div>',
      onSave: () => {
        const concepto = $('#p-concepto').value.trim(); const importe = num($('#p-importe').value, -1); const fecha = $('#p-fecha').value;
        if (!concepto) { toast('Indica concepto.', 'error'); return false; } if (importe < 0) { toast('Importe no válido.', 'error'); return false; } if (!isDateKey(fecha)) { toast('Fecha no válida.', 'error'); return false; }
        const current = editableRecord('pagos', id);
        if (!current) return false;
        if (current.abonos?.length && round2(importe) < paidPayroll(current)) { toast('El importe no puede ser inferior a los abonos guardados.', 'error'); return false; }
        const changes = changesFromForm(original, current, { concepto, importe: round2(importe), fecha });
        if (!changes) return false;
        if (Object.keys(changes).length) current.manual_edit = true;
        Object.assign(current, changes);
        if (current.tipo === 'nomina_auto' && changes.fecha) current.mes_key = current.fecha.slice(0, 7);
        return persist('Nómina actualizada');
      },
      onDelete: () => deletePayroll(id)
    });
  }

  function deletePayroll(id) {
    const payment = editableRecord('pagos', id);
    if (!payment) return false;
    if (payment.tipo === 'nomina_auto') {
      const omitted = new Set(String(setting('nomina_auto_omitidas') || '').split(',').filter(Boolean));
      omitted.add(payment.mes_key);
      setSetting('nomina_auto_omitidas', [...omitted].sort().join(','));
    }
    data.pagos = data.pagos.filter((row) => row !== payment);
    return persist('Nómina eliminada');
  }

  function pendingModal() {
    const unpaidExtras = data.jornadas.filter((j) => j.estado === 'confirmado' && hoursToBill(j) > 0 && !j.pagado_extras); const extraHours = round2(unpaidExtras.reduce((sum, j) => sum + hoursToBill(j), 0)); const extraTotal = round2(unpaidExtras.reduce((sum, j) => sum + hoursToBill(j) * rateOn(j.fecha, 'extra'), 0));
    const pendingTrips = data.viajes.filter((v) => !v.pagado); const tripTotal = round2(pendingTrips.reduce((sum, v) => sum + v.importe, 0));
    const pendingPayrolls = effectivePayments().filter((p) => p.tipo === 'nomina_auto' && !p.confirmado); const payrollTotal = round2(pendingPayrolls.reduce((sum, p) => sum + p.importe, 0));
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
      cloudSync?.queue(data);
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
    openModal({ title: 'Informe por periodo', hideSave: true, body: '<div class="form-grid"><label class="field"><span>Desde</span><input class="input" id="report-from" type="date" value="' + esc(from) + '"></label><label class="field"><span>Hasta</span><input class="input" id="report-to" type="date" value="' + esc(today) + '"></label></div><label class="switch"><input type="checkbox" id="report-summary"><span><b>Solo resumen</b><small>Sin filas de jornadas, incidencias ni viajes en el PDF.</small></span></label><label class="switch"><input type="checkbox" id="report-private" checked><span><b>Ocultar notas privadas</b></span></label><div class="hint-row"><button class="btn primary" type="button" data-action="report-pdf"><svg class="i" aria-hidden="true"><use href="#i-print"></use></svg> Guardar como PDF</button><button class="btn ghost" type="button" data-action="report-csv"><svg class="i" aria-hidden="true"><use href="#i-download"></use></svg> Exportar CSV</button></div>' });
  }

  function readReportRange() {
    const from = $('#report-from') && $('#report-from').value; const to = $('#report-to') && $('#report-to').value;
    if (!isDateKey(from) || !isDateKey(to) || from > to) { toast('Elige un periodo válido: la fecha inicial debe ser anterior a la final.', 'error'); return null; }
    return { from, to, summary: Boolean($('#report-summary')?.checked), privateNotes: Boolean($('#report-private')?.checked) };
  }

  function exportCSV(from, to) {
    const rows = [['Tipo', 'Fecha', 'Entrada', 'Salida', 'Pausa no computable (min)', 'Horas normales', 'Horas extra', 'Tarifa normal €/h', 'Tarifa extra €/h', 'Estado', 'Extras pagadas', 'Concepto', 'Importe €', 'Notas']];
    data.jornadas.filter((j) => j.fecha >= from && j.fecha <= to).slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((j) => {
      const confirmed = j.estado === 'confirmado';
      rows.push(['Jornada', j.fecha, j.entrada, j.salida, String(j.descanso_minutos || 0), String(j.horas_normales).replace('.', ','), String(j.horas_extra).replace('.', ','), confirmed ? String(rateOn(j.fecha, 'normal')).replace('.', ',') : '', confirmed ? String(rateOn(j.fecha, 'extra')).replace('.', ',') : '', j.estado, j.pagado_extras ? 'Sí' : 'No', '', confirmed ? String(round2(j.horas_normales * rateOn(j.fecha, 'normal') + hoursToBill(j) * rateOn(j.fecha, 'extra'))).replace('.', ',') : '', j.notas]);
    });
    data.ausencias.filter((item) => item.fecha >= from && item.fecha <= to).forEach((item) => rows.push(['Incidencia · ' + calendarLabel(item.tipo), item.fecha, '', '', '', '', '', '', '', '', '', item.concepto, '', item.notas]));
    data.viajes.filter((item) => item.fecha >= from && item.fecha <= to).forEach((item) => rows.push(['Viaje/dieta', item.fecha, '', '', '', '', '', '', '', item.pagado ? 'Cobrado' : 'Pendiente', '', item.concepto, String(item.importe).replace('.', ','), item.notas]));
    effectivePayments().filter((item) => item.fecha >= from && item.fecha <= to).forEach((item) => rows.push([item.tipo === 'nomina_auto' ? 'Nómina automática' : 'Pago manual', item.fecha, '', '', '', String(item.horas_normales_mes).replace('.', ','), String(item.horas_extra_mes).replace('.', ','), '', '', item.confirmado ? 'Confirmado' : 'Pendiente', '', item.concepto, String(item.importe).replace('.', ','), '']));
    const orderedRows = [rows[0]].concat(rows.slice(1).sort((a, b) => String(a[1]).localeCompare(String(b[1]))));
    const csv = window.IVORY37Reports.toCsv(orderedRows);
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'informe_' + from + '_' + to + '.csv', function (saved) { toast(saved ? (window.IVORY37DesktopBridge ? 'CSV guardado en la ubicación elegida.' : 'CSV guardado. Elige Descargas para encontrarlo.') : 'No se guardó el CSV.', saved ? 'info' : 'warn'); });
  }

  function exportEncryptedBackup() {
    openModal({
      title: 'Copia cifrada', saveText: 'Cifrar y guardar',
      body: '<p>Guarda la contraseña en un lugar seguro. La necesitarás para abrir la copia.</p><label class="field"><span>Contraseña de la copia (mínimo 12 caracteres)</span><input class="input" type="password" id="backup-password" autocomplete="new-password"></label><label class="field"><span>Repite la contraseña</span><input class="input" type="password" id="backup-password-repeat" autocomplete="new-password"></label>',
      async onSave() {
        const input = $('#backup-password');
        const repeat = $('#backup-password-repeat');
        const password = input.value;
        if (password.length < 12 || password !== repeat.value) { toast('Las contraseñas deben coincidir y tener al menos 12 caracteres.', 'error'); return false; }
        input.value = repeat.value = '';
        try {
          const date = dateKey(new Date());
          const original = JSON.stringify(backupTools.create(data, date));
          const encrypted = await backupTools.encrypt(original, password);
          if (await backupTools.decrypt(JSON.parse(encrypted), password) !== original) throw Error('Verificación');
          const blob = new Blob([encrypted], { type: 'application/json' });
          if (blob.size > 12 * 1024 * 1024) { toast('La copia cifrada supera el tamaño admitido.', 'error'); return false; }
          download(blob, 'control-laboral-cifrado-' + date + '.json', saved => { if (saved) markBackupSaved(); });
          return true;
        } catch (_) { toast('No se pudo cifrar y verificar la copia.', 'error'); return false; }
      }
    });
  }

  function importJSON(file) {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { toast('Backup demasiado grande.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const envelope = JSON.parse(reader.result);
        if (envelope?.format === backupTools.encryptedFormat) {
          openModal({
            title: 'Abrir copia cifrada', saveText: 'Abrir y revisar',
            body: '<label class="field"><span>Contraseña de la copia</span><input class="input" type="password" id="decrypt-password" autocomplete="off"></label>',
            async onSave() {
              const field = $('#decrypt-password'); const password = field.value; field.value = '';
              try {
                const decrypted = await backupTools.decrypt(envelope, password);
                previewImport(backupTools.parse(decrypted, isDateKey));
                return false;
              } catch (_) { toast('Contraseña incorrecta o copia dañada.', 'error'); return false; }
            }
          });
          return;
        }
        previewImport(backupTools.parse(reader.result, isDateKey));
      } catch (error) { toast(error.message === 'Fecha' ? 'El backup contiene fechas imposibles.' : 'Backup no válido.', 'error'); }
    };
    reader.onerror = () => toast('No se pudo leer el archivo de backup.', 'error');
    reader.readAsText(file);
  }

  function previewImport(parsed) {
    const incoming = normalize(parsed);
    const collections = ['jornadas', 'viajes', 'pagos', 'ausencias'];
    const recordKey = (collection, row) => String(collection === 'ausencias' ? row.fecha : row.id);
    const fingerprint = row => JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))));
    const compare = () => {
      const additions = {};
      const differences = [];
      let repeated = 0;
      for (const collection of collections) {
        const current = new Map(data[collection].map(row => [recordKey(collection, row), row]));
        additions[collection] = [];
        for (const row of incoming[collection]) {
          const key = recordKey(collection, row);
          const existing = current.get(key);
          if (!existing) { additions[collection].push(row); current.set(key, row); }
          else if (fingerprint(existing) === fingerprint(row)) repeated++;
          else differences.push([collection, row.fecha]);
        }
      }
      return { additions, differences, repeated };
    };
    const preview = compare();
    const newCount = Object.values(preview.additions).reduce((sum, rows) => sum + rows.length, 0);
    openModal({
      title: 'Revisar copia antes de importar', saveText: 'Aplicar copia',
      body: '<p>' + newCount + ' nuevos · ' + preview.repeated + ' repetidos · ' + preview.differences.length + ' distintos según identificador o fecha de incidencia.</p>'
        + (preview.differences.length ? '<details><summary>Ver diferencias detectadas</summary><ul>' + preview.differences.slice(0, 50).map(([collection, date]) => '<li>' + esc(collection + ' · ' + fmtDate(date)) + '</li>').join('') + '</ul></details>' : '')
        + '<label class="field"><span>Operación</span><select class="input" id="import-mode"><option value="replace">Restaurar copia completa</option><option value="add">Añadir solo registros nuevos</option></select></label><p class="muted">Restaurar sustituye los datos y ajustes actuales. Añadir conserva los registros existentes.</p>',
      async onSave() {
        const previous = data;
        const previousLoadError = loadError;
        try {
          const mode = $('#import-mode').value;
          if (mode === 'add' && loadError) { toast('Para recuperar datos dañados utiliza una copia completa.', 'error'); return false; }
          if (mode === 'add') {
            const { additions } = compare();
            data = { ...data };
            for (const collection of collections) data[collection] = data[collection].concat(additions[collection]);
          } else data = incoming;
          const rawPrevious = localStorage.getItem(KEY);
          if (rawPrevious) localStorage.setItem(KEY + '_recovery', rawPrevious);
          syncPayrolls();
          localStorage.setItem(KEY, JSON.stringify(data));
          if (localStorage.flush) await localStorage.flush();
        } catch (error) {
          localStorage.rollback?.(); data = previous; loadError = previousLoadError;
          toast('No se pudo guardar la copia. Tus datos siguen intactos.', 'error'); return false;
        }
        loadError = false;
        mirrorNativeStorage(); applyBranding(); renderAll(); renderAjustes();
        cloudSync?.init(data); cloudSync?.queue(data);
        toast('Copia aplicada.');
        return true;
      }
    });
  }

  function restoreInternalBackup(sourceKey = KEY + '_backup') {
    let raw;
    try { raw = localStorage.getItem(sourceKey); } catch (err) { toast('No se pudo leer la copia interna.', 'error'); return; }
    if (!raw) { toast('No hay copia interna.', 'warn'); return; }
    confirmAction('Restaurar copia interna', 'Se sustituirán los datos actuales y se conservará una copia previa.', 'Restaurar', async () => {
      const previous = data; const previousLoadError = loadError;
      try {
        const parsed = backupTools.parse(raw, isDateKey);
        if (hasInvalidDates(parsed)) throw new Error('Fecha');
        data = normalize(parsed); syncPayrolls();
        localStorage.setItem(KEY + '_recovery', JSON.stringify(previous));
        localStorage.setItem(KEY, JSON.stringify(data));
        if (localStorage.flush) await localStorage.flush();
        mirrorNativeStorage();
        cloudSync?.queue(data);
        loadError = false; applyBranding(); renderAll(); renderAjustes(); cloudSync?.init(data); cloudSync?.queue(data);
        toast('Copia restaurada.');
      } catch (err) { if (localStorage.rollback) localStorage.rollback(); data = previous; loadError = previousLoadError; toast('No se pudo restaurar; los datos actuales siguen intactos.', 'error'); return false; }
    });
  }

  function printReport(from, to, options = {}) {
    const records = data.jornadas.filter((j) => j.fecha >= from && j.fecha <= to).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const confirmed = records.filter((j) => j.estado === 'confirmado');
    const exceptions = data.ausencias.filter((item) => item.fecha >= from && item.fecha <= to).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const trips = data.viajes.filter((item) => item.fecha >= from && item.fecha <= to).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const payments = effectivePayments().filter((item) => item.fecha >= from && item.fecha <= to).sort((a, b) => a.fecha.localeCompare(b.fecha));
    let normalHours = round2(confirmed.reduce((sum, j) => sum + j.horas_normales, 0));
    const extraHours = round2(confirmed.reduce((sum, j) => sum + j.horas_extra, 0));
    let normalValue = round2(confirmed.reduce((sum, j) => sum + j.horas_normales * rateOn(j.fecha, 'normal'), 0));
    const extraValue = round2(confirmed.reduce((sum, j) => sum + hoursToBill(j) * rateOn(j.fecha, 'extra'), 0));
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
    $('#print').innerHTML = '<div class="print-head">' + (logo && isSafeImage(logo) ? '<img src="' + esc(logo) + '" alt="">' : '') + '<h1>' + esc(name) + '</h1></div>' + '<p class="sub">' + (person ? esc(person) + ' · ' : '') + 'Informe · ' + esc(fmtDate(from)) + ' – ' + esc(fmtDate(to)) + '</p>' + '<div class="totals"><div>Horas normales<b>' + fmtHours(normalHours) + '</b></div><div>Horas extra<b>' + fmtHours(extraHours) + '</b></div><div>Valor normales<b>' + fmtMoney(normalValue) + '</b></div><div>Valor extras<b>' + fmtMoney(extraValue) + '</b></div><div>Viajes y dietas<b>' + fmtMoney(tripTotal) + '</b></div><div>Total estimado<b>' + fmtMoney(total) + '</b></div></div>' + (isEstimation() ? '<p class="sub">El cálculo incluye estimaciones de días laborables sin jornada ni incidencia registrada.</p>' : '') + (provisionalCount ? '<p class="sub">' + provisionalCount + ' jornada(s) provisional(es) aparecen para revisión y no se incluyen en los importes.</p>' : '') + (options.summary ? '' : '<h2>Jornadas</h2>' + (jornadaRows ? '<table><thead><tr><th>Fecha</th><th>Horario</th><th class="num">Pausa</th><th class="num">Norm.</th><th class="num">Extra</th><th class="num">€/h norm.</th><th class="num">€/h extra</th><th>Estado</th></tr></thead><tbody>' + jornadaRows + '</tbody></table>' : '<p>Sin jornadas en el periodo.</p>') + (exceptions.length ? '<h2>Calendario e incidencias</h2><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Notas</th></tr></thead><tbody>' + exceptionRows + '</tbody></table>' : '') + (trips.length ? '<h2>Viajes y dietas</h2><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Importe</th><th>Estado</th></tr></thead><tbody>' + tripRows + '</tbody></table>' : '') + (payments.length ? '<h2>Pagos registrados</h2><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th class="num">Importe</th><th>Estado</th></tr></thead><tbody>' + paymentRows + '</tbody></table>' : '') ) + '<footer>Las incidencias son anotaciones de calendario. El total estimado no sustituye una nómina oficial. Generado por ' + esc(name) + '</footer>';
    setTimeout(printPreparedReport, 60);
  }

  function printPreparedReport() {
    try {
      if (window.AndroidBridge && typeof window.AndroidBridge.printReport === 'function') window.AndroidBridge.printReport();
      else window.print();
    } catch (err) { toast('No se pudo abrir la impresión. Vuelve a intentarlo.', 'error'); }
  }
  function notify(title, body) { try {
    if (window.AndroidBridge && typeof window.AndroidBridge.showNotification === 'function') {
      if (notificationState() === 'Activados') window.AndroidBridge.showNotification(title, body);
      return;
    }
    if ('Notification' in window && Notification.permission === 'granted') { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, body }); else new Notification(title, { body: body }); }
  } catch (err) {} }
  function requestNotifications() {
    if (window.AndroidBridge && typeof window.AndroidBridge.requestNotifications === 'function') { window.AndroidBridge.requestNotifications(); renderNotifState(); return; }
    if (!('Notification' in window)) { toast('Este navegador no admite notificaciones.', 'error'); return; } Notification.requestPermission().then((p) => { if (p === 'granted') { toast('Recordatorios activados.'); } else { toast('Permiso denegado.', 'warn'); } renderNotifState(); }).catch(() => { toast('No se pudo activar.', 'warn'); }); }

  function requestExactReminders() {
    if (!window.AndroidBridge || typeof window.AndroidBridge.requestExactReminderAccess !== 'function') return;
    window.AndroidBridge.requestExactReminderAccess();
  }

  function reminderTick() {
    if (demoMode) return;
    if (window.AndroidBridge && typeof window.AndroidBridge.configureReminders === 'function') return;
    if (setting('reminders_enabled', '0') !== '1') return;
    if (notificationState() !== 'Activados') return;
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
      case 'live-pause': toggleLivePause(); break;
      case 'clock-out': clockOut(); break;
      case 'save-profile': { const name = $('#cfg-user-name').value.trim().slice(0, 40); const role = $('#cfg-user-role').value.trim().slice(0, 40); setSetting('user_name', name); setSetting('user_role', role || 'Control laboral'); applyBranding(); persist('Perfil guardado'); break; }
      case 'calendar-inspect-add': {
        const chosen = $('#calendar-inspect')?.value;
        if (isDateKey(chosen)) calendarModal(null, chosen);
        break;
      }
      case 'new-calendar-entry': calendarModal(); break;
      case 'edit-calendar': calendarModal(id); break;
      case 'delete-calendar': { const item = data.ausencias.find((row) => String(row.id) === String(id)); if (item) { const group = String(item.grupo || item.id); confirmAction('Eliminar incidencia', 'Se quitará ' + calendarLabel(item.tipo) + ' del periodo que comienza el ' + fmtDate(item.fecha) + '.', 'Eliminar', () => { data.ausencias = data.ausencias.filter((row) => String(row.grupo || row.id) !== group); persist('Incidencia eliminada'); }, true); } break; }
      case 'load-rate': loadRateVersion(el.dataset.date); break;
      case 'delete-rate': deleteRateVersion(el.dataset.date); break;
      case 'merge-shift-conflict': mergeShiftConflict(id); break;
      case 'resolve-conflict': { const restore = el.dataset.choice === 'restore'; confirmAction(restore ? 'Restaurar la otra versión' : 'Conservar la versión aplicada', restore ? 'La versión alternativa sustituirá el registro actual en tus dispositivos.' : 'Se mantendrá el registro aplicado y se cerrará esta revisión.', restore ? 'Restaurar versión' : 'Conservar versión', () => { if (cloudSync?.resolveConflict(id, restore)) toast('Revisión guardada y sincronización programada.'); else toast('No se encontró el conflicto.', 'warn'); }); break; }
      case 'report-pdf': { const range = readReportRange(); if (range) { closeModal(); printReport(range.from, range.to, range); } break; }
      case 'report-csv': { const range = readReportRange(); if (range) { closeModal(); exportCSV(range.from, range.to); } break; }
      case 'print': openReportModal(); break;
      case 'export-csv': openReportModal(); break;
      case 'enter-demo':
      case 'exit-demo': {
        const target = new URL(location.href);
        if (action === 'enter-demo') target.searchParams.set('demo', '1');
        else target.searchParams.delete('demo');
        target.hash = 'dashboard';
        location.href = target.href;
        break;
      }
      case 'export-json': exportJSON(); break;
      case 'export-encrypted': exportEncryptedBackup(); break;
      case 'new-jornada': jornadaModal(null); break;
      case 'edit-jornada': jornadaModal(id); break;
      case 'add-extra': extraModal(id); break;
      case 'add-extra-quick': { const today = dateKey(new Date()); const j = jornadaForDate(today); if (!j) { toast('Crea primero la jornada de hoy.', 'warn'); return; } extraModal(j.id); break; }
      case 'save-shift-template': saveShiftTemplate(); break;
      case 'new-trip': tripModal(null); break;
      case 'edit-trip': tripModal(id); break;
      case 'delete-trip': { const v = data.viajes.find((x) => String(x.id) === String(id)); if (v) confirmAction('Eliminar viaje', '¿Eliminar «' + v.concepto + '»?', 'Eliminar', () => { data.viajes = data.viajes.filter((x) => String(x.id) !== String(id)); persist('Viaje eliminado'); }, true); break; }
      case 'mark-trip': { const v = data.viajes.find((x) => String(x.id) === String(id)); if (v) { v.pagado = 1; v.fecha_pago = dateKey(new Date()); persist('Viaje cobrado'); } break; }
      case 'unmark-trip': { const v = data.viajes.find((x) => String(x.id) === String(id)); if (v) { v.pagado = 0; v.fecha_pago = ''; persist('Viaje devuelto'); } break; }
      case 'filter': { ui.filter = el.dataset.filter || 'all'; ui.limit = 30; $$('[data-action="filter"]').forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.filter === ui.filter))); renderJornadas(); break; }
      case 'load-more': ui.limit += 30; renderJornadas(); break;
      case 'recalc': setSetting('nomina_auto_omitidas', ''); syncPayrolls(); persist('Nóminas recalculadas; se regeneran las nóminas eliminadas'); break;
      case 'month-correction': payConceptModal('entry', null, true); break;
      case 'pay-rate': payConceptModal('rate', id); break;
      case 'pay-concept': payConceptModal('entry', id); break;
      case 'export-project-hours': {
        const project = $('#jornadas-project').value.trim().toLocaleLowerCase('es');
        const rows = [['Fecha', 'Empresa, obra o proyecto', 'Horas']];
        for (const shift of visibleJornadas()) {
          for (const allocation of shift.proyectos || []) {
            if (!project || allocation.nombre.toLocaleLowerCase('es').includes(project)) rows.push([shift.fecha, allocation.nombre, fmtInput(allocation.horas)]);
          }
        }
        if (rows.length === 1) { toast('No hay horas de proyecto para este filtro.', 'info'); break; }
        download(new Blob([window.IVORY37Reports.toCsv(rows)], { type: 'text/csv;charset=utf-8' }), 'horas-por-proyecto.csv');
        break;
      }
      case 'export-closing': {
        const month = closingMonth || monthKey(new Date());
        const figures = monthlyFigures(month);
        const backup = {
          jornadas: figures.rows, viajes: figures.trips,
          pagos: effectivePayments().filter(row => row.mes_key === month),
          ausencias: data.ausencias.filter(row => row.fecha.startsWith(month)),
          ajustes: data.ajustes.filter(row => ['tarifa_historial', 'hora_extra_euros', 'hora_normal_euros', 'horas_normales_dia'].includes(row.clave) || row.clave.startsWith('pay_rate_') || payEntries('pay_entry_').some(entry => entry.key === row.clave && entry.date.startsWith(month)))
        };
        const packet = { ...backup, cierre: { mes: month, ...figures.stats, previsto: figures.expected, cobrado: figures.received, diferencia: round2(figures.expected - figures.received) } };
        download(new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' }), 'cierre-' + month + '.json');
        break;
      }
      case 'partial-payroll': partialPayrollModal(id); break;
      case 'restore-installment': restoreInstallment(id, el.dataset.history); break;
      case 'edit-installment': partialPayrollModal(id, el.dataset.installment); break;
      case 'confirm-payroll': { const p = data.pagos.find((x) => String(x.id) === String(id)); if (p) { if (p.abonos?.length) { partialPayrollModal(id); break; } p.confirmado = true; p.fecha_cobro = dateKey(new Date()); persist('Nómina confirmada'); } break; }
      case 'unconfirm-payroll': { const p = data.pagos.find((x) => String(x.id) === String(id)); if (p) { p.confirmado = false; delete p.fecha_cobro; persist('Nómina a pendiente'); } break; }
      case 'receipt-payroll': receiptModal(id); break;
      case 'edit-payroll': payrollModal(id); break;
      case 'delete-payroll': {
        const p = data.pagos.find((row) => String(row.id) === String(id));
        if (p) confirmAction('Eliminar nómina', '¿Eliminar «' + p.concepto + '»? Si es automática, solo volverá a generarse al pulsar «Recalcular».', 'Eliminar', () => deletePayroll(id), true);
        break;
      }
      case 'compensate-extra': compensateExtra(id); break;
      case 'mark-extra-paid': { const j = data.jornadas.find((x) => String(x.id) === String(id)); if (j && hoursToBill(j) > 0) { j.pagado_extras = true; j.fecha_pago_extras = dateKey(new Date()); persist('Extras pagadas'); } break; }
      case 'mark-extra-unpaid': { const j = data.jornadas.find((x) => String(x.id) === String(id)); if (j) { j.pagado_extras = false; j.fecha_pago_extras = ''; persist('Extras a pendiente'); } break; }
      case 'edit-extra-payment': extraPaymentModal(el.dataset.month); break;
      case 'cleanup-auto': { const auto = data.jornadas.filter(isAutoGenerated); if (!auto.length) { toast('No hay jornadas de «Completar mes».', 'info'); break; } confirmAction('Quitar jornadas de «Completar mes»', 'Se eliminarán ' + auto.length + ' registros creados con «Completar mes». No se tocan las jornadas creadas con «Según horario».', 'Eliminar ' + auto.length, () => { data.jornadas = data.jornadas.filter((j) => !isAutoGenerated(j)); persist('Jornadas de «Completar mes» eliminadas'); renderDataTools(); }, true); break; }
      case 'pending-detail': pendingModal(); break;
      case 'safe-diagnostics': {
        const status = $('#local-save-state')?.dataset.state;
        const cloud = $('#cloud-status')?.dataset.state;
        const diagnostic = { version: APP_VERSION, platform: window.AndroidBridge ? 'Android' : window.IVORY37DesktopBridge ? 'Windows' : 'Web', online: navigator.onLine, storageReady: Boolean(window.IVORY37Storage?.isReady), storageState: status || 'unknown', cloudState: cloud || 'unknown' };
        download(new Blob([JSON.stringify(diagnostic, null, 2)], { type: 'application/json' }), 'control-laboral-diagnostico.json');
        break;
      }
      case 'restore-previous': restoreInternalBackup(KEY + '_recovery'); break;
      case 'request-notif': if (demoMode) break; setSetting('reminders_enabled', '1'); Promise.resolve(persist()).then(saved => { if (saved) { requestNotifications(); mirrorNativeStorage(); } }); break;
      case 'request-exact-reminders': requestExactReminders(); break;
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
  if (modalSaveBtn) modalSaveBtn.addEventListener('click', async () => {
    if (!modalSave || modalSaveBtn.disabled) return;
    const save = modalSave; modalSaveBtn.disabled = true;
    try { const result = await save(); if (result !== false && modalSave === save) closeModal(); }
    catch (error) { toast('No se pudo guardar: ' + error.message, 'error'); }
    finally { modalSaveBtn.disabled = false; }
  });
  for (const [id, settingKey] of [['extras-first', 'extras_first'], ['review-month-end', 'review_month_end']]) {
    $('#' + id)?.addEventListener('change', async event => {
      setSetting(settingKey, event.target.checked ? '1' : '0');
      if (await persist()) applyBranding();
    });
  }
  $('#outdoor-toggle')?.addEventListener('change', async (event) => {
    setSetting('outdoor_mode', event.target.checked ? '1' : '0');
    await persist();
    applyBranding();
  });
  $('#weekly-goal')?.addEventListener('change', async (event) => {
    const value = num(event.target.value, 0);
    if (value < 1 || value > 168) { event.target.value = setting('weekly_goal', '40'); toast('Introduce entre 1 y 168 horas.', 'error'); return; }
    setSetting('weekly_goal', value);
    await persist('Objetivo semanal guardado');
  });
  const modalDelBtn = $('#modal-delete');
  if (modalDelBtn) modalDelBtn.addEventListener('click', async () => {
    if (!modalDelete || modalDelBtn.disabled) return;
    const previous = JSON.parse(JSON.stringify(data)); modalDelBtn.disabled = true;
    try {
      const result = await modalDelete();
      if (result !== false) {
        undoRecords = {};
        for (const collection of ['jornadas', 'viajes', 'pagos', 'ausencias']) {
          undoRecords[collection] = previous[collection].filter(row => !data[collection].some(current => (current.id || current.fecha) === (row.id || row.fecha)));
        }
        const button = $('#undo-delete'); if (button) button.hidden = false;
        closeModal();
      }
    } finally { modalDelBtn.disabled = false; }
  });
  $('#undo-delete')?.addEventListener('click', async () => {
    if (!undoRecords) return;
    for (const collection of Object.keys(undoRecords)) {
      for (const row of undoRecords[collection]) if (!data[collection].some(current => (current.id || current.fecha) === (row.id || row.fecha))) data[collection].push(row);
    }
    if (await persist('Borrado deshecho.')) { undoRecords = null; $('#undo-delete').hidden = true; }
  });
  window.addEventListener('ivory37:storage-state', event => {
    const element = $('#local-save-state'); if (!element) return;
    element.textContent = event.detail.state === 'saved' ? 'Guardado en este dispositivo' : event.detail.state === 'pending' ? 'Guardando en este dispositivo…' : 'Error de guardado · ' + event.detail.error;
    element.dataset.state = event.detail.state === 'saved' ? 'ok' : event.detail.state === 'pending' ? 'busy' : 'error';
  });
  $('#disable-reminders')?.addEventListener('click', () => { setSetting('reminders_enabled', '0'); persist('Recordatorios desactivados.'); });

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
  window.addEventListener('ivory37:sync-acknowledged', () => { if (!demoMode && data && ui.tab === 'jornadas') renderJornadas(); });

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
    else if (ui.tab === 'dashboard') { renderTodayClock(); }
    if (now.getTime() - lastAutoCheck >= 60000) { lastAutoCheck = now.getTime(); autoFichaje(); }
  }

  window.addEventListener('ivory37:cloud-data', (event) => {
    if (demoMode || !event.detail || loadError) return;
    try {
      data = normalize(event.detail);
      syncPayrolls();
      localStorage.setItem(KEY, JSON.stringify(data));
      applyBranding(); renderAll(); renderAjustes(); updateStorageUsage();
      cloudSync?.queue(data);
      mirrorNativeStorage();
    } catch (err) { console.error('No se pudo aplicar la sincronización en la app:', err); }
  });

  function init() {
    if (!demoMode && window.IVORY37Storage && !window.IVORY37Storage.isReady) {
      window.IVORY37Storage.ready.then(init).catch(error => {
        loadError = true;
        const state = $('#local-save-state'); if (state) { state.textContent = 'No se pudo abrir el almacenamiento: ' + error.message; state.dataset.state = 'error'; }
        toast('No se pudieron abrir los datos. No borres la aplicación ni sus datos.', 'error');
        $$('button').forEach(button => { button.disabled = true; });
      });
      return;
    }
    const hash = location.hash.slice(1); if (['dashboard', 'jornadas', 'viajes', 'pagos', 'ajustes'].includes(hash)) ui.tab = hash;
    ui.today = dateKey(new Date());
    restoreNativeStorage();
    ensureInternalBackup();
    data = loadData();
    if (demoMode) {
      const now = new Date();
      const today = dateKey(now);
      const yesterday = dateKey(addDays(now, -1));
      data = normalize({
        ajustes: [{ clave: 'user_name', valor: 'Marina · Demostración' }, { clave: 'auto_fichaje', valor: '0' }],
        jornadas: [{ id: 'example-shift', fecha: yesterday, entrada: '08:00', salida: '18:00', horas_normales: 8, horas_extra: 2, estado: 'confirmado', notas: 'Jornada ficticia' }],
        viajes: [{ id: 'example-trip', fecha: today, concepto: 'Visita ficticia', importe: 25 }]
      });
      $('#demo-banner').hidden = false;
      $('#sync-card').hidden = true;
    }
    applyBranding(); probeLogoRatio();
    if (!loadError) { try { syncPayrolls(); localStorage.setItem(KEY, JSON.stringify(data)); } catch (err) { console.warn(err); } }
    const verEl = $('#app-version'); if (verEl) verEl.textContent = APP_VERSION;
    ui.hour = new Date().getHours(); showTab(ui.tab); renderAll(); renderAjustes(); updateStorageUsage(); autoFichaje(); tick();
    const shortcut = new URLSearchParams(location.search).get('shortcut');
    if (shortcut === 'extras' || shortcut === 'clock') {
      const target = shortcut === 'extras' ? $('[data-action="add-extra-quick"]') : $('#hero-clock-action');
      if (target && !target.hidden) { target.focus(); target.scrollIntoView({ block: 'center' }); }
    }
    setInterval(tick, 1000); setInterval(reminderTick, 30000);
    if (loadError) { setTimeout(() => toast('No se pudieron leer los datos o tienen fechas no válidas. No se ha sobrescrito nada: importa un backup correcto.', 'error'), 500); }
    else if (!data.jornadas.length && !data.viajes.length && !data.pagos.length && !data.ausencias.length) { setTimeout(() => toast('Empieza fichando la entrada o crea una jornada.', 'info'), 700); }
    else if (!setting('user_name')) { setTimeout(() => toast('Completa tu perfil en Ajustes → Mi perfil.', 'info'), 900); }
    if (loadError) {
      const cloudStatus = $('#cloud-status');
      if (cloudStatus) { cloudStatus.textContent = 'Sincronización pausada hasta recuperar los datos.'; cloudStatus.dataset.state = 'error'; }
      ['#cloud-signup', '#cloud-login', '#cloud-now'].forEach((selector) => { const button = $(selector); if (button) button.disabled = true; });
    } else cloudSync?.init(data);
    if (!loadError) mirrorNativeStorage();
    if (!loadError && !demoMode && setting('review_month_end', '0') === '1') {
      const now = new Date();
      const month = monthKey(now);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      if (lastDay - now.getDate() <= 2) {
        const open = data.jornadas.filter(row => row.fecha.startsWith(month) && row.entrada && !row.salida).length;
        const pendingTrips = data.viajes.filter(row => row.fecha.startsWith(month) && !row.pagado).length;
        if (open || pendingTrips) setTimeout(() => toast('Fin de mes · ' + open + ' jornadas sin salida y ' + pendingTrips + ' viajes pendientes. Revisa Pagos.', 'info'), 1200);
      }
    }
    window.IVORY37AppReady = !loadError;
  }

  init();
})();
