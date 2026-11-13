import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMaquette, displayBase, toMM } from '../src/maquette.ts';
import { createModel, room } from '../src/model.ts';
import { buildNetwork } from '../src/network.ts';

const a2 = createModel('compactA2', 'occupied');
const network = buildNetwork();
const catalog = buildMaquette(a2, network);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('el catálogo conserva A2 y convierte metros a milímetros a escala 1:25', () => {
  assert.equal(toMM(room.w), 400);
  assert.equal(displayBase.width, 0.50);
  for (const kind of ['computer', 'chair', 'tower', 'keyboard', 'mouse', 'monitor']) {
    assert.equal(catalog.counts[kind], 26);
    assert.ok(catalog.items.some(item => item.kind === kind && item.id === 'ADM-01'));
  }
  assert.equal(catalog.counts.desk, 25);
  assert.equal(catalog.counts.counter, 1);
  assert.equal(catalog.items.find(item => item.kind === 'counter').id, 'ADM-01');
  assert.equal(catalog.counts.window, 8);
  assert.equal(catalog.counts.door, 3);
  assert.equal(catalog.counts.minisplit, 3);
  assert.equal(catalog.counts.condenser, 3);
  assert.equal(catalog.counts.rack, 1);
  assert.equal(catalog.counts.server, 1);
  assert.deepEqual(catalog.items.find(item => item.kind === 'desk' && item.id === 'PC-01').dims.map(toMM), [40, 30, 20]);
});

test('los hilos se calculan por enlace sin reserva de obra y las tiras se cuentan por tramo único', () => {
  const items = kind => catalog.items.filter(item => item.kind === kind);
  assert.equal(items('cable').length, network.links.length);
  assert.equal(items('duct').length, new Set(network.ducts.map(duct => duct.id)).size);
  const materials = Object.fromEntries(catalog.totals().map(row => [row.id, row]));
  near(materials.thread.net, items('cable').reduce((m, item) => m + item.scaled[0] / 1000, 0));
  near(materials.channel.linearNet, items('duct').reduce((m, item) => m + item.scaled[0] / 1000, 0));
  assert.ok(materials.thread.net < network.links.reduce((m, link) => m + link.total / 25, 0));
  near(materials.wood.net, 2.8912);
  assert.equal(materials.cardstock.pieces, 343);
  near(materials.acetate.gross, materials.acetate.net * 1.15);
});
