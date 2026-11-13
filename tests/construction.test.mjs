import assert from 'node:assert/strict';
import test from 'node:test';
import { floorRegister, phases, readProgress, summarizePhase } from '../src/construction.ts';
import { createModel } from '../src/model.ts';
import { buildNetwork } from '../src/network.ts';
import { buildMaquette, toMM } from '../src/maquette.ts';
import { stationBatch } from '../src/cut-layout.ts';

const model = createModel('compactA2', 'occupied');
const network = buildNetwork();
const catalog = buildMaquette(model, network);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8);

test('el registro cabe entre las filas sin tocar muebles y conserva la altura útil', () => {
  const hatch = floorRegister(network);
  near(toMM(hatch.w), 26);
  near(toMM(hatch.d), 35.6);
  near(hatch.ductDepthMm, 8);
  near(hatch.minimumGapMm, 3.2);
  assert.ok(network.ducts.some(duct => duct.id === hatch.trunk));
  assert.equal(network.links.length, 26);
  for (const { desk, chair } of [...model.stations, model.admin]) {
    for (const rect of [desk, chair]) assert.ok(
      Math.abs(rect.x - hatch.x) >= (rect.w + hatch.w) / 2 ||
      Math.abs(rect.z - hatch.z) >= (rect.d + hatch.d) / 2);
  }
});

test('la guía de estaciones suma las piezas de ambos lotes de fabricación', () => {
  const phase = phases.find(phase => phase.id === 'stations');
  const totals = summarizePhase(catalog.cuts, phase.kinds);
  assert.equal([...totals.values()].reduce((sum, row) => sum + row.pieces, 0),
    stationBatch(catalog.cuts, false).length + stationBatch(catalog.cuts, true).length);
  assert.equal(totals.get('wood').pieces, 104);
});

test('el progreso comienza vacío y solo recupera las tareas y estados reconocidos', () => {
  assert.deepEqual(readProgress(null, ['board']), { completed: [], materials: {} });
  assert.deepEqual(readProgress('inválido', ['board']), { completed: [], materials: {} });
  assert.deepEqual(readProgress(JSON.stringify({
    completed: ['base:0', 'base:0', 'prototype', 'inexistente'],
    materials: { board: 'Adquirido', foam: 'Desconocido', eva: 'Pendiente de medir' },
  }), ['board', 'foam', 'eva']), { completed: ['base:0', 'prototype'],
    materials: { board: 'Adquirido', eva: 'Pendiente de medir' } });
});
