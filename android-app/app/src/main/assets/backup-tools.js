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
    const collections = ['jornadas', 'viajes', 'pagos', 'ausencias', 'ajustes'];
    let count = 0;
    collections.forEach((key) => {
      if (parsed[key] === undefined) return; // Copias antiguas sin colecciones opcionales.
      if (!Array.isArray(parsed[key])) throw new Error('Formato');
      count += parsed[key].length;
      if (count > 50000) throw new Error('Demasiados');
    });
    collections.forEach((key) => {
      if (!parsed[key]) return;
      if (parsed[key].some((row) => !row || typeof row !== 'object' || Array.isArray(row)
        || (key === 'ajustes' && typeof row.clave !== 'string'))) throw new Error('Formato');
    });
    if (hasInvalidDates(parsed, isDateKey)) throw new Error('Fecha');
    return parsed;
  }

  const iterations = 600000;
  const format = 'control-laboral-encrypted-v1';

  function encode(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  }

  function decode(value) {
    if (typeof value !== 'string') throw new Error('Formato cifrado');
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
  }

  async function derive(password, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function encrypt(raw, password) {
    if (password.length < 12) throw new Error('Usa al menos 12 caracteres.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await derive(password, salt);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(raw));
    return JSON.stringify({ format, salt: encode(salt), iv: encode(iv), data: encode(new Uint8Array(encrypted)) });
  }

  async function decrypt(envelope, password) {
    if (!envelope || envelope.format !== format) throw new Error('Formato cifrado');
    const salt = decode(envelope.salt);
    const iv = decode(envelope.iv);
    const encrypted = decode(envelope.data);
    if (salt.length !== 16 || iv.length !== 12 || encrypted.length < 16) throw new Error('Formato cifrado');
    const key = await derive(password, salt);
    const result = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return new TextDecoder('utf-8', { fatal: true }).decode(result);
  }

  return { create, parse, hasInvalidDates, encrypt, decrypt, encryptedFormat: format };
});
