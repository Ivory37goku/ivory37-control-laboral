'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('encrypted backup opens with the correct password and detects changes', async () => {
  const tools = require('../backup-tools.js');
  const original = JSON.stringify({ jornadas: [{ notas: 'Privado' }] });
  const password = 'una-clave-larga-42';
  const ciphertext = await tools.encrypt(original, password);
  assert.equal(ciphertext.includes('Privado'), false);
  const envelope = JSON.parse(ciphertext);
  assert.equal(await tools.decrypt(envelope, password), original);
  await assert.rejects(tools.decrypt(envelope, 'incorrecta-42'));
  envelope.data = (envelope.data[0] === 'A' ? 'B' : 'A') + envelope.data.slice(1);
  await assert.rejects(tools.decrypt(envelope, password));
});
const backupTools = require('../backup-tools.js');

const isDateKey = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]);
};

test('backup creation clones data and writes the export date without mutating current settings', () => {
  const source = { jornadas: [{ id: 'j-1', fecha: '2026-11-17' }], viajes: [], pagos: [], ausencias: [], ajustes: [{ clave: 'last_backup', valor: '2026-11-16' }] };
  const backup = backupTools.create(source, '2026-11-17');
  assert.equal(backup.ajustes[0].valor, '2026-11-17');
  assert.equal(source.ajustes[0].valor, '2026-11-16');
  assert.notEqual(backup.jornadas, source.jornadas);
});

test('valid legacy backups remain importable and preserve their records', () => {
  const legacy = { jornadas: [{ id: 'j-1', fecha: '2024-02-29', horas_extra: 2 }] };
  assert.deepEqual(backupTools.parse(JSON.stringify(legacy), isDateKey), legacy);
});

test('backup import rejects malformed objects and impossible dates in every dated collection', () => {
  assert.throws(() => backupTools.parse('[]', isDateKey), /Formato/);
  assert.throws(() => backupTools.parse('{"jornadas":{}}', isDateKey), /Formato/);
  for (const collection of ['jornadas', 'viajes', 'pagos', 'ausencias']) {
    const bad = { jornadas: [], [collection]: [{ fecha: '2026-02-30' }] };
    assert.throws(() => backupTools.parse(JSON.stringify(bad), isDateKey), /Fecha/);
  }
});

test('backup import rejects an oversized shift list before any restore can start', () => {
  const oversized = { jornadas: Array.from({ length: 50001 }, () => ({ fecha: '2026-11-17' })) };
  assert.throws(() => backupTools.parse(JSON.stringify(oversized), isDateKey), /Demasiados/);
});


test('backup limits apply to every collection and their combined size', () => {
  for (const collection of ['viajes', 'pagos', 'ausencias', 'ajustes']) {
    assert.throws(() => backupTools.parse(JSON.stringify({ jornadas: [], [collection]: Array(50001).fill({}) }), isDateKey), /Demasiados/);
  }
  assert.throws(() => backupTools.parse(JSON.stringify({ jornadas: Array(25001).fill({ fecha: '2026-11-19' }), viajes: Array(25000).fill({ fecha: '2026-11-19' }) }), isDateKey), /Demasiados/);
});

test('malformed optional collections and records cannot silently erase imported data', () => {
  for (const value of [{ viajes: {} }, { pagos: [null] }, { ausencias: ['text'] }, { ajustes: [{ valor: '1' }] }]) {
    assert.throws(() => backupTools.parse(JSON.stringify({ jornadas: [], ...value }), isDateKey), /Formato/);
  }
});
