import assert from 'node:assert/strict';
import test from 'node:test';
import { accessOpening, buildInfrastructure, chamberParts, floorLayers, panel, pathLength, powerDuctSize,
  rackOutlet, serviceBoxSize, ups, wireClearance, wireGauge } from '../src/infrastructure.ts';
import { leaves, room, createModel, technical } from '../src/model.ts';
import { buildNetwork, sectionSize } from '../src/network.ts';
import { buildMaquette, toMM } from '../src/maquette.ts';
import { defaultStock, planPurchase } from '../src/cut-layout.ts';
import { floorRegister, readProgress } from '../src/construction.ts';

const model = createModel('compactA2', 'occupied');
const network = buildNetwork();
const layout = buildInfrastructure(model, network);
const catalog = buildMaquette(model, network);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const overlap = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-8 &&
  Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-8;
const rect = (d, w) => ({
  x: (d.from.x + d.to.x) / 2, z: (d.from.z + d.to.z) / 2,
  w: Math.max(Math.abs(d.to.x - d.from.x), w), d: Math.max(Math.abs(d.to.z - d.from.z), w),
});
const horizontal = d => d.from.y === d.to.y && d.from.y < 0;

test('MQ-04 usa los jacks y puertos aprobados y añade una placa dentro de cada mesa', () => {
  assert.equal(layout.services.length, 26);
  assert.deepEqual(layout.patches.map(patch => patch.id), network.links.map(link => link.id));
  assert.equal(new Set(layout.services.map(s => s.labels.jack)).size, 26);
  for (const [index, entry] of layout.services.entries()) {
    const link = network.links[index];
    const station = [...model.stations, model.admin][index];
    assert.equal(entry.link, link);
    assert.equal(entry.id, station.id);
    assert.equal(entry.labels.jack, link.outlet);
    assert.match(link.panelPort, new RegExp(`/${entry.labels.jack.slice(-2)}$`));
    assert.match(link.switchPort, new RegExp(`/${entry.labels.jack.slice(-2)}$`));
    const { desk } = station;
    assert.ok(Math.abs(entry.plate.x - desk.x) + serviceBoxSize.w / 2 <= desk.w / 2);
    assert.ok(Math.abs(entry.plate.z - desk.z) + serviceBoxSize.d / 2 <= desk.d / 2);
    assert.equal(overlap({ ...entry.plate, ...serviceBoxSize }, station.chair), false);
    for (const points of Object.values(entry.leads)) {
      assert.ok(points.every(p => Math.abs(p.x - desk.x) <= desk.w / 2 && Math.abs(p.z - desk.z) <= desk.d / 2));
    }
  }
});

test('siete circuitos independientes y respaldo para equipos activos', () => {
  assert.deepEqual(layout.circuits.map(c => c.loads.length), [5, 5, 5, 5, 5, 1, 1]);
  assert.deepEqual(layout.circuits[5].loads, ['ADM-01']);
  assert.deepEqual(layout.circuits[6].loads, ['UPS-01']);
  for (const { runs } of layout.circuits) assert.deepEqual(runs[0][0], { x: panel.x, y: panel.y, z: panel.z });
  assert.deepEqual(layout.circuits[6].runs[0].at(-1), rackOutlet);
  assert.deepEqual(layout.backup.map(item => item.id), ['SW-01', 'RTR-01', 'ONT-01', 'SRV-01']);
  const door = leaves.at(-1);
  const swingBounds = { x: door.hinge.x + door.width / 2, z: door.hinge.z - door.width / 2, w: door.width, d: door.width };
  for (const part of [panel, ups]) {
    assert.equal(overlap(part, swingBounds), false);
    assert.equal(overlap(part, technical.rack), false);
  }
});

test('la cámara y sus apoyos respetan los ductos y sus cruces a distinta altura', () => {
  near(toMM(floorLayers.gap), 12);
  near(toMM(chamberParts().cover.d), 220);
  near(toMM(chamberParts().window.w), 100);
  const data = network.ducts.filter(horizontal);
  const power = layout.ducts.filter(horizontal);
  assert.ok(data.some(a => power.some(b => overlap(rect(a, sectionSize[a.section][0]), rect(b, powerDuctSize.w)))));
  const margin = wireClearance + wireGauge / 2;
  for (const [y, height] of [[floorLayers.dataY, 0.04], [floorLayers.powerY, powerDuctSize.h]]) {
    assert.ok(y + height / 2 + margin < -room.slab);
    assert.ok(y - height / 2 - margin > -room.slab - floorLayers.gap);
  }
  assert.ok(floorLayers.dataY - (0.04 / 2 + margin) > floorLayers.powerY + powerDuctSize.h / 2 + margin);
  for (const support of chamberParts().supports) {
    for (const duct of data) assert.equal(overlap(support, rect(duct, sectionSize[duct.section][0])), false, duct.id);
    for (const duct of power) assert.equal(overlap(support, rect(duct, powerDuctSize.w)), false, duct.id);
  }
  const hatch = floorRegister(network);
  near(toMM(hatch.w), 26);
  near(toMM(hatch.d), 35.6);
  assert.ok(accessOpening.end < room.d);
});

test('inventario reproducible, piezas con presentación comprable y progreso previo conservado', () => {
  assert.equal(catalog.counts.serviceBox, 26);
  assert.equal(catalog.counts.jack, 26);
  assert.equal(catalog.counts.socket, 27);
  assert.equal(catalog.counts.powerDuct, layout.ducts.length);
  const materials = Object.fromEntries(catalog.totals().map(row => [row.id, row]));
  near(materials.powerChannel.linearNet, layout.ducts.reduce((m, d) => m + toMM(pathLength([d.from, d.to])) / 1000, 0));
  near(materials.powerThread.net, toMM([
    ...layout.circuits.flatMap(c => c.runs), layout.rackLeads, ...layout.backup.map(lead => lead.points),
    ...layout.services.flatMap(s => [s.leads.power, s.leads.monitor]),
  ].reduce((m, points) => m + pathLength(points), 0)) / 1000);
  for (const row of catalog.totals()) {
    const purchase = planPurchase(catalog.cuts.filter(c => c.material === row.id), defaultStock[row.id], row.gross);
    assert.ok(purchase.suggested > 0, row.id);
    assert.deepEqual(purchase.lost, []);
  }
  const prior = { completed: ['floor:0', 'floor:2', 'floor:check', 'built:ducts', 'equipment:2'],
    materials: { thread: 'Adquirido' } };
  assert.deepEqual(readProgress(JSON.stringify(prior), Object.keys(materials)), prior);
});
