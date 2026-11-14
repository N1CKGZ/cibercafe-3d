import assert from 'node:assert/strict';
import test from 'node:test';
import { condenserMount, climateFit, climatePairs, climatePipes, climatePipeLengths, climateUnits, wallPoint } from '../src/climate.ts';
import { layoutTemplate, printableFormats, printMargin, calibrationMM } from '../src/cut-layout.ts';
import { buildMaquette, displayBase, glueTab, toMM } from '../src/maquette.ts';
import { createModel, leaves, room, walls } from '../src/model.ts';
import { buildNetwork } from '../src/network.ts';

const catalog = buildMaquette(createModel('compactA2', 'occupied'), buildNetwork());
const onBase = ({ x, z }, radius = 0) => {
  const marginX = (displayBase.width * 25 - room.w) / 2;
  const marginZ = (displayBase.depth * 25 - room.d) / 2;
  return x - radius >= -marginX && x + radius <= room.w + marginX &&
    z - radius >= -marginZ && z + radius <= room.d + marginZ;
};
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('los tres pares conservan dimensiones provisionales y quedan sobre paños libres de vanos', () => {
  assert.deepEqual(climatePairs.map(pair => pair.capacity), [24000, 24000, 12000]);
  assert.equal(climateFit.blades, 5);
  for (const pair of climatePairs) {
    const wall = walls.find(wall => wall.id === pair.wall);
    const { indoor, outdoor } = climateUnits(pair);
    for (const unit of [indoor, outdoor]) {
      assert.ok(unit.along - unit.w / 2 >= wall.start);
      assert.ok(unit.along + unit.w / 2 <= wall.end);
      const bottom = unit.bottom - (unit.kind === 'condenser' ? climateFit.bracketDrop : 0.047);
      for (const opening of wall.openings) assert.ok(
        unit.along + unit.w / 2 <= opening.start || unit.along - unit.w / 2 >= opening.end ||
        bottom >= opening.high || unit.bottom + unit.h <= opening.low, unit.id);
      assert.ok(unit.bottom + unit.h <= room.height);
    }
    near(indoor.normal - indoor.d / 2, room.wall);
    const projection = climateFit.grilleOffset + outdoor.h * climateFit.fanRadius * climateFit.grilleTubeRatio;
    for (const along of [outdoor.along - outdoor.w / 2, outdoor.along + outdoor.w / 2]) {
      assert.ok(onBase(wallPoint(pair, along, outdoor.bottom, outdoor.normal - outdoor.d / 2 - projection)));
    }
    for (const door of leaves) {
      // The complete swing lies in the disc swept by the leaf around its hinge.
      // The exterior envelope of each condenser and support is contained in this footprint.
      const center = wallPoint(pair, outdoor.along, outdoor.bottom, 0);
      const halfX = pair.axis === 'x' ? outdoor.w / 2 : outdoor.d + climateFit.outdoorGap + projection;
      const halfZ = pair.axis === 'z' ? outdoor.w / 2 : outdoor.d + climateFit.outdoorGap + projection;
      const dx = Math.max(0, Math.abs(door.hinge.x - center.x) - halfX);
      const dz = Math.max(0, Math.abs(door.hinge.z - center.z) - halfZ);
      assert.ok(Math.hypot(dx, dz) > door.width);
    }
  }
});

test('cada condensadora apoya sobre dos ménsulas continuas pegadas al muro', () => {
  for (const pair of climatePairs) {
    const { outdoor } = climateUnits(pair);
    const { width, centers, wallLeg, armBox, wallBox } = condenserMount(outdoor);
    const wallFace = outdoor.normal;
    const worldNormal = z => wallFace - z;
    assert.equal(centers.length, 2);
    assert.ok(centers[1] - centers[0] > width);
    near(worldNormal(wallBox.z - wallBox.d / 2), 0);
    near(worldNormal(armBox.z - armBox.d / 2), 0);
    near(armBox.y + armBox.h / 2, -outdoor.h / 2);
    near(armBox.y - armBox.h / 2, wallBox.y + wallBox.h / 2);
    near(wallBox.y - wallBox.h / 2, -outdoor.h / 2 - wallLeg);
    assert.ok(worldNormal(armBox.z + armBox.d / 2) < -climateFit.outdoorGap);
    for (const center of centers) {
      assert.ok(Math.abs(center) + width / 2 < outdoor.w / 2);
    }
  }
});

test('las dos tuberías de cada par cruzan el muro arriba del vano y bajan por el paño sólido', () => {
  for (const pair of climatePairs) {
    const { indoor, outdoor } = climateUnits(pair);
    const wall = walls.find(wall => wall.id === pair.wall);
    const along = p => pair.axis === 'x' ? p.x : p.z;
    const normal = p => pair.axis === 'x' ? p.z : p.x;
    for (const points of climatePipes(pair)) {
      const [from, through, top, bottom, end] = points;
      const r = climateFit.pipeRadius * 1.2; // Includes the small overlap rendered at joints.
      assert.ok(Math.abs(along(from) - indoor.along) + r < indoor.w / 2);
      assert.ok(normal(from) > room.wall && normal(through) < 0);
      for (const p of points) assert.ok(onBase(p, r));
      for (const [i, b] of points.slice(1).entries()) {
        const a = points[i];
        for (const opening of wall.openings) assert.ok(
          Math.max(along(a), along(b)) + r < opening.start ||
          Math.min(along(a), along(b)) - r > opening.end ||
          Math.max(a.y, b.y) + r < opening.low || Math.min(a.y, b.y) - r > opening.high);
        for (const door of leaves) {
          const dx = Math.max(0, Math.min(a.x, b.x) - door.hinge.x, door.hinge.x - Math.max(a.x, b.x));
          const dz = Math.max(0, Math.min(a.z, b.z) - door.hinge.z, door.hinge.z - Math.max(a.z, b.z));
          assert.ok(Math.hypot(dx, dz) > door.width + r);
        }
      }
      // The vertical drop keeps at least 1 mm at scale after accounting for the pipe envelope.
      for (const opening of wall.openings) assert.ok(along(top) + r + 0.025 <= opening.start ||
        along(top) - r - 0.025 >= opening.end);
      assert.ok(bottom.y < top.y && end.y > outdoor.bottom);
      near(along(end), outdoor.along + outdoor.w / 2);
    }
  }
});

test('los seis diseños imprimibles caben en A4 y carta y alimentan el inventario una vez', () => {
  assert.equal(calibrationMM, 100);
  for (const pair of climatePairs) {
    for (const unit of Object.values(climateUnits(pair))) {
      const cuts = catalog.cuts.filter(cut => cut.item === unit.id && cut.kind === unit.kind);
      const band = cuts.find(cut => cut.name === 'Banda de caja');
      near(band.width, toMM(unit.w));
      near(band.height, toMM(2 * (unit.h + unit.d)) + glueTab);
      assert.equal(band.folds.length, 4);
      assert.equal(cuts.filter(cut => cut.tabs).length, 2);
      assert.equal(cuts.filter(cut => cut.artwork).length, 1);
      const outdoor = unit.kind === 'condenser';
      assert.equal(cuts.length, outdoor ? 8 : 4);
      if (outdoor) {
        const mount = condenserMount(unit);
        const brackets = cuts.filter(cut => cut.name.startsWith('Ménsula'));
        assert.equal(brackets.length, 2);
        for (const part of brackets) {
          assert.equal(part.material, 'thinboard');
          assert.deepEqual(part.folds, [toMM(mount.wallLeg)]);
          near(part.width, toMM(mount.width));
          near(part.height - part.folds[0], toMM(mount.arm));
        }
        assert.deepEqual(cuts.filter(cut => cut.material === 'hvacCord').map(cut => cut.width), climatePipeLengths(pair).map(toMM));
      }
      for (const format of Object.keys(printableFormats)) {
        const packed = layoutTemplate(cuts, format);
        assert.deepEqual(packed.oversized, []);
        assert.equal(packed.sheets.length, 1);
        assert.equal(packed.sheets[0].length, cuts.length);
        for (const box of packed.sheets[0]) {
          assert.ok(box.x + box.width <= printableFormats[format].width - 2 * printMargin);
          assert.ok(box.y + box.height + 34 < printableFormats[format].height - 2 * printMargin - 47);
        }
      }
    }
  }
  assert.equal(catalog.totals().find(row => row.id === 'hvacCord').pieces, 6);
});
