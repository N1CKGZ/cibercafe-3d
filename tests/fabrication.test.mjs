import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMaquette, glueTab, productionCuts } from '../src/maquette.ts';
import { createModel } from '../src/model.ts';
import { buildNetwork } from '../src/network.ts';
import { batchMaterials, layoutBatch, stationBatch, calibrationMM, cutGap, defaultStock, layoutTemplate, packSheets, planPurchase,
  printableFamilies, printableFormats, printChrome, printMargin, sheetMargin } from '../src/cut-layout.ts';

const catalog = buildMaquette(createModel('compactA2', 'occupied'), buildNetwork());
const close = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-7, `${value} != ${expected}`);

test('el despiece separa recepción, descuenta vanos y cuenta pestañas y piezas', () => {
  const material = id => catalog.totals().find(row => row.id === id);
  close(material('foam').net, 1561.888);
  close(material('foam').base, 1839.968);
  close(material('foam').gross, 2115.9632);
  assert.equal(material('cardstock').pieces, 26 * (3 + 6 + 1 + 1 + 2) + 4 + 1);
  assert.equal(material('channel').pieces, 60);
  const fronts = catalog.cuts.filter(cut => cut.kind === 'tower' && cut.name === 'Frente');
  close(fronts[0].width - 2 * glueTab, 6.8);
  close(fronts[0].height - 2 * glueTab, 14.8);
  assert.equal(fronts.length, 26);
  assert.equal(catalog.cuts.filter(cut => cut.kind === 'counter' && cut.material === 'wood').length, 4);
  assert.equal(catalog.cuts.filter(cut => cut.kind === 'desk' && cut.material === 'wood').length, 100);
});

test('la estación imprimible lleva 21 piezas con calibración de 100 mm y cabe entera en A4 y carta', () => {
  const cuts = catalog.cuts.filter(c => c.item === 'PC-01' && printableFamilies.includes(c.kind));
  assert.equal(calibrationMM, 100);
  assert.equal(cuts.length, 21);
  close(cuts.find(c => c.kind === 'desk' && c.name === 'Tablero').width, 40);
  close(cuts.find(c => c.kind === 'desk' && c.name === 'Pata 1').width, 27.8);
  for (const [key, paper] of Object.entries(printableFormats)) {
    const result = layoutTemplate(cuts, key);
    assert.deepEqual(result.oversized, []);
    assert.equal(result.sheets.length, 1);
    for (const p of result.sheets[0]) {
      assert.ok(p.x + p.width <= paper.width - 2 * printMargin);
      assert.ok(p.y + p.height <= paper.height - 2 * printMargin - printChrome);
    }
  }
});

test('el acomodo rota, respeta separación y rechaza piezas sobredimensionadas aun si hay área', () => {
  const stock = { width: 100, height: 60 };
  const result = packSheets([{ width: 45, height: 85 }, { width: 95, height: 2 }], stock, 5, 2);
  assert.equal(result.sheets[0][0].rotated, true);
  assert.equal(result.oversized.length, 1);
  for (const row of catalog.totals()) {
    const pieces = catalog.cuts.filter(c => c.material === row.id);
    const available = defaultStock[row.id];
    const purchase = planPurchase(pieces, available, row.gross);
    assert.ok(purchase.suggested >= purchase.minimum && purchase.minimum > 0);
    if (!available.height) continue;
    assert.equal(purchase.perSheet.reduce((a, b) => a + b, 0), pieces.length);
    const packed = packSheets(pieces, available, sheetMargin, cutGap);
    for (const sheet of packed.sheets) for (const [i, a] of sheet.entries())  {
      assert.ok(a.x >= sheetMargin && a.y >= sheetMargin);
      assert.ok(a.x + a.width <= available.width - sheetMargin + 1e-7);
      assert.ok(a.y + a.height <= available.height - sheetMargin + 1e-7);
      for (const b of sheet.slice(i + 1)) assert.ok(
        a.x + a.width + cutGap <= b.x + 1e-7 || b.x + b.width + cutGap <= a.x + 1e-7 ||
        a.y + a.height + cutGap <= b.y + 1e-7 || b.y + b.height + cutGap <= a.y + 1e-7);
    }
  }
});

test('la producción separa administración y acomoda cada pieza una vez en ambos formatos', () => {
  for (const simplified of [false, true]) for (const admin of [false, true]) {
    const cuts = productionCuts(stationBatch(catalog.cuts, admin), simplified);
    assert.equal(cuts.length, admin ? 21 : 525);
    assert.equal(cuts.filter(cut => cut.kind === 'mouse').length, admin ? 1 : 25);
    assert.equal(cuts.filter(cut => cut.kind === (admin ? 'counter' : 'desk') && cut.name === 'Tablero').length, admin ? 1 : 25);
    const support = cuts.find(cut => cut.kind === 'monitor' && cut.name.startsWith('Soporte'));
    close(support.width, simplified ? 5.2 : 2.2);
    close(support.height, 5.4);
    for (const format of Object.keys(printableFormats)) {
      const pages = Object.keys(batchMaterials).flatMap(material => {
        const group = cuts.filter(cut => cut.material === material);
        const packed = layoutBatch(group, format);
        assert.equal(packed.oversized.length, 0);
        assert.deepEqual(new Set(packed.sheets.flat().map(slot => slot.piece.cut)), new Set(group));
        for (const sheet of packed.sheets) for (const [i, a] of sheet.entries()) {
          assert.ok(a.x + a.width <= printableFormats[format].width - 2 * printMargin);
          assert.ok(a.y + a.height <= printableFormats[format].height - 2 * printMargin - 35);
          for (const b of sheet.slice(i + 1)) assert.ok(
            a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
        }
        return packed.sheets;
      });
      assert.equal(pages.length, admin ? 5 : 7);
      assert.equal(pages.flat().length, cuts.length);
    }
  }
});
