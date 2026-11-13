import assert from 'node:assert/strict';
import test from 'node:test';
import { chairStates, createModel, entrance, layouts, leaves, room, server } from '../src/model.ts';
import { inspect } from '../src/geometry.ts';

test('los escenarios conservan el local, los puestos y las zonas requeridas', () => {
  assert.deepEqual([room.w, room.d], [10, 10]);
  assert.equal(server.id, 'SRV-01');
  for (const id of Object.keys(layouts)) {
    const model = createModel(id, 'occupied');
    assert.equal(model.admin.id, 'ADM-01');
    assert.deepEqual(model.stations.map(p => p.id),
      Array.from({ length: 25 }, (_, i) => `PC-${String(i + 1).padStart(2, '0')}`));
    assert.equal(new Set(model.stations.map(p => p.desk.z)).size, 5);
  }
});

test('la distribución original reproduce los cuatro pasos estrechos y el solape de recepción', () => {
  for (const [state, width] of [['tucked', 0.73], ['occupied', 0.45], ['extended', 0.30]]) {
    const { passages } = inspect(createModel('original', state));
    assert.deepEqual(passages.slice(0, 4).map(p => Number(p.width.toFixed(2))), Array(4).fill(width));
  }
  const result = inspect(createModel('original', 'occupied'));
  assert.ok(result.overlaps.includes('Silla PC-21 / Silla ADM-01'));
  assert.equal(result.targets.find(t => t.id === 'PC-03').index, -1);
  assert.equal(result.targets.filter(t => t.id.startsWith('PC-') && t.index >= 0).length, 3);
});

test('la variante compacta conecta los 25 puestos y las zonas en los tres estados de silla', () => {
  for (const state of Object.keys(chairStates)) {
    const result = inspect(createModel('compact', state));
    assert.equal(result.targets.length, 29);
    assert.deepEqual(result.overlaps, []);
    assert.deepEqual(result.serviceHits, []);
    assert.ok(result.swings.every(s => s.hits.length === 0));
    for (const target of result.targets) {
      assert.ok(target.index >= 0, target.id);
      const { path } = target;
      assert.ok(Math.abs(path[0].x - (entrance.start + entrance.end) / 2) < 1e-8);
      assert.equal(path[0].z, room.d);
      assert.deepEqual(path.at(-1), result.pointAt(target.index));
    }
  }
});

test('la variante de filas más separadas detecta interferencias en ambas hojas', () => {
  const result = inspect(createModel('spread', 'extended'));
  assert.deepEqual(result.swings.slice(0, 2).map(s => s.id), leaves.slice(0, 2).map(l => l.id));
  assert.deepEqual(result.swings.slice(0, 2).map(s => s.hits), [['Silla PC-23'], ['Silla PC-24']]);
});

test('A2 mejora el corredor principal y mantiene el acceso a los 25 puestos en los tres estados', () => {
  for (const state of Object.keys(chairStates)) {
    const a = inspect(createModel('compact', state));
    const a2 = inspect(createModel('compactA2', state));
    assert.ok(a.mainRoute.width < 1.2);
    assert.ok(a2.mainRoute.width >= 1.2);
    assert.ok(a2.targets.every(t => t.index >= 0));
    assert.ok(a2.swings.every(s => s.hits.length === 0));
    assert.deepEqual(a2.overlaps, []);
    assert.deepEqual(a2.serviceHits, []);
    const center = a2.passages.find(p => p.id === 'center-aisle');
    assert.ok(Math.abs(center.width - 1.30) < 1e-8);
    assert.ok(a2.mainRoute.pinch.point.x > center.rect.x - center.rect.w / 2);
    assert.ok(a2.mainRoute.pinch.point.x < center.rect.x + center.rect.w / 2);
  }
});

test('la cota entre mesas y el mínimo de la ruta son medidas distintas', () => {
  const occupied = inspect(createModel('compactA2', 'occupied'));
  const extended = inspect(createModel('compactA2', 'extended'));
  const routeTo = (result, id) => result.targets.find(t => t.id === id);
  const pc01 = routeTo(extended, 'PC-01');
  assert.ok(pc01.width < routeTo(occupied, 'PC-01').width);
  assert.ok(pc01.width < extended.passages[0].width);
  assert.ok(pc01.pinch.nearby.includes('Silla PC-01'));
  assert.ok(pc01.pinch.nearby.includes('Mesa PC-06'));
  assert.ok(routeTo(occupied, 'Cuarto técnico').width < occupied.mainRoute.width);
});
