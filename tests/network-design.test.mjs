import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNetwork } from '../src/network.ts';
import { createModel, chairStates } from '../src/model.ts';
import { equipmentFicha, portMap, technicalEquipment, vlans } from '../src/network-design.ts';

const network = buildNetwork();

test('el diseño físico y lógico conserva las 26 tomas y asigna los 48 puertos del switch', () => {
  const { panel, sw } = portMap(network);
  assert.equal(network.links.filter(link => /^PC-\d{2}$/.test(link.equipment)).length, 25);
  assert.equal(network.links.filter(link => link.equipment === 'ADM-01').length, 1);
  assert.equal(technicalEquipment.filter(id => id === 'SRV-01').length, 1);
  assert.equal(panel.length, 48);
  assert.equal(panel.filter(Boolean).length, 26);
  assert.equal(new Set(panel.filter(Boolean).map(link => link.outlet)).size, 26);
  assert.equal(sw.filter(p => p.mode !== 'reserved').length, 28);
  assert.equal(sw.filter(p => p.mode === 'reserved').length, 20);
  for (let i = 0; i < 25; i++) {
    assert.deepEqual(sw[i], { number: i + 1, equipment: network.links[i].equipment, mode: 'access', vlans: [10] });
    assert.match(equipmentFicha(network, sw[i].equipment).fields.find(([key]) => key === 'IP prevista')[1], /^DHCP/);
  }
  assert.deepEqual(sw.slice(25, 28), [
    { number: 26, equipment: 'ADM-01', mode: 'access', vlans: [20] },
    { number: 27, equipment: 'SRV-01', mode: 'access', vlans: [30] },
    { number: 28, equipment: 'RTR-01 LAN', mode: 'trunk', vlans: [10, 20, 30] },
  ]);
  assert.deepEqual(sw.slice(28).map(port => port.number), Array.from({ length: 20 }, (_, i) => i + 29));
  assert.deepEqual(Object.values(vlans).map(vlan => [vlan.subnet, vlan.gateway]), [
    ['192.168.10.0/26', '192.168.10.1'], ['192.168.20.0/27', '192.168.20.1'], ['192.168.30.0/27', '192.168.30.1'],
  ]);
});

test('las salidas bajo las mesas quedan dentro del mueble y fuera de las sillas en los tres estados A2', () => {
  for (const state of Object.keys(chairStates)) {
    const { stations, admin } = createModel('compactA2', state);
    const furniture = [...stations, admin];
    for (const link of network.links) {
      const desk = furniture.find(item => item.id === link.equipment).desk;
      const { x, z } = link.outletPoint;
      assert.ok(Math.abs(x - desk.x) + 0.065 / 2 <= desk.w / 2);
      assert.ok(Math.abs(z - desk.z) + 0.045 / 2 <= desk.d / 2);
      assert.ok(furniture.every(({ chair }) =>
        Math.abs(x - chair.x) >= (chair.w + 0.065) / 2 ||
        Math.abs(z - chair.z) >= (chair.d + 0.045) / 2), `${state} / ${link.outlet}`);
    }
  }
});
