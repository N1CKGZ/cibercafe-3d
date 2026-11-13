import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNetwork, devicePorts, networkSpec, rackDevices } from '../src/network.ts';
import { createModel } from '../src/model.ts';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const { links, ducts, localPatches, spineX } = buildNetwork();

test('los 26 enlaces convergen en el panel y conservan el mapa de M-01', () => {
  const { stations, admin } = createModel('compactA2', 'occupied');
  assert.equal(links.length, 26);
  for (const [i, link] of links.entries()) {
    const nn = String(i + 1).padStart(2, '0');
    const station = [...stations, admin][i];
    assert.equal(link.equipment, station.id);
    assert.equal(link.id, `C-${nn}`);
    assert.equal(link.panelPort, `PP-01/${nn}`);
    assert.equal(link.outlet, `TR-${nn}`);
    assert.equal(link.switchPort, `SW-01/${nn}`);
    assert.deepEqual(link.points[0], links[0].points[0]);
    assert.deepEqual(link.points.at(-1), link.outletPoint);
    assert.ok(Math.abs(link.outletPoint.x - station.desk.x) < station.desk.w / 2);
    assert.ok(Math.abs(link.outletPoint.z - station.desk.z) < station.desk.d / 2);
    assert.equal(link.segments.filter(d => d.id.startsWith('SUBIDA-')).length, 1);
  }
  assert.equal(devicePorts(rackDevices.panel).length, 48);
  assert.equal(devicePorts(rackDevices.switch).length, 48);
  assert.deepEqual(localPatches.map(p => [p.from, p.to]), [
    ['SRV-01', 'SW-01/27'], ['RTR-01 LAN', 'SW-01/28'], ['ONT-01', 'RTR-01 WAN'],
  ]);
});

test('los cruces horizontales están protegidos bajo piso y las rutas son continuas', () => {
  for (const link of links) {
    let horizontal = 0;
    let vertical = 0;
    for (const [i, duct] of link.segments.entries()) {
      const a = link.points[i], b = link.points[i + 1];
      const ends = [JSON.stringify(duct.from), JSON.stringify(duct.to)].sort();
      assert.deepEqual([JSON.stringify(a), JSON.stringify(b)].sort(), ends);
      assert.ok(duct.cables.includes(link.id));
      const h = Math.hypot(a.x - b.x, a.z - b.z);
      if (h > 0) {
        assert.equal(a.y, networkSpec.underfloorY);
        assert.equal(b.y, networkSpec.underfloorY);
      }
      horizontal += h;
      vertical += Math.abs(a.y - b.y);
    }
    close(link.total, horizontal + vertical + 1.5);
    if (link.outletPoint.x < spineX) {
      assert.ok(link.segments.some(d => d.from.x === spineX && d.to.x < spineX));
    }
  }
});

test('la canalización compartida se cuenta una sola vez', () => {
  const key = d => [JSON.stringify(d.from), JSON.stringify(d.to)].sort().join('|');
  assert.equal(new Set(ducts.map(key)).size, ducts.length);
  assert.equal(ducts.find(d => d.id === 'RACK-CRUCE').cables.length, 26);
  for (const [section, expected] of [['80×40', 14.06], ['40×25', 32.49], ['25×16', 16.38]]) {
    close(ducts.filter(d => d.section === section).reduce((s, d) => s + d.length, 0), expected);
  }
  close(links.reduce((s, l) => s + l.total, 0), 320.21);
});
