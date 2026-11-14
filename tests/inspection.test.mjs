import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { connectionCatalog, defaultInspectionOptions, inspectionLayers, pointKey, segmentKey } from '../src/inspection.ts';
import { infrastructureInspection } from '../src/inspection-view.ts';
import { buildInfrastructure, panel, pathLength } from '../src/infrastructure.ts';
import { createModel } from '../src/model.ts';
import { buildNetwork } from '../src/network.ts';

const model = createModel('compactA2', 'occupied'), network = buildNetwork();
const infrastructure = buildInfrastructure(model, network);
const connections = connectionCatalog(network, infrastructure);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('las 26 fichas siguen los enlaces existentes y un camino continuo de su circuito desde TE-01', () => {
  const snapshot = JSON.stringify({ model, network, infrastructure });
  assert.equal(connections.length, 26);
  assert.deepEqual(connections.map(c => c.id), [...model.stations, model.admin].map(s => s.id));
  for (const row of connections) {
    assert.equal(row.link, network.links.find(link => link.equipment === row.id));
    assert.equal(row.service.labels.jack, row.link.outlet);
    assert.deepEqual(row.dataSegments, row.link.segments.map(d => d.id));
    assert.equal(row.vlan, row.id === 'ADM-01' ? 20 : 10);
    assert.equal(row.circuit.id, row.id === 'ADM-01' ? 'CE-06' : `CE-0${Math.ceil(Number(row.id.slice(3)) / 5)}`);
    let current = pointKey(panel);
    let length = 0;
    for (const key of row.powerSegments) {
      const duct = infrastructure.ducts.find(d => segmentKey(d.from, d.to) === key);
      assert.ok(duct.circuits.includes(row.circuit.id));
      const from = pointKey(duct.from), to = pointKey(duct.to);
      assert.ok(current === from || current === to, row.id + key);
      current = current === from ? to : from;
      length += pathLength([duct.from, duct.to]);
    }
    assert.equal(current, pointKey(row.service.outlet));
    near(length, row.powerLength);
    near(row.powerCordLength, pathLength(row.service.leads.power));
    assert.equal(new Set(row.powerSegments).size, row.powerSegments.length);
  }
  const pc1 = connections[0], pc2 = connections[1], admin = connections.at(-1);
  assert.ok(pc1.powerSegments.some(key => pc2.powerSegments.includes(key)));
  assert.ok(pc1.powerSegments.some(key => !pc2.powerSegments.includes(key)));
  assert.notDeepEqual(pc1.powerSegments, admin.powerSegments);
  assert.equal(JSON.stringify({ model, network, infrastructure }), snapshot);
});

function fixture() {
  const meshes = [];
  function mesh(parent, data = {}) {
    const part = new T.Mesh(new T.BoxGeometry(.1,.1,.1), new T.MeshStandardMaterial({ color: 0x345678 }));
    part.userData = data;
    part.castShadow = true;
    parent.add(part);
    meshes.push(part);
    return part;
  }
  const architecture = new T.Group(), objects = new T.Group(), utility = new T.Group(), extras = new T.Group();
  const floor = mesh(architecture), wall = mesh(architecture,{ wallId:'Posterior' });
  const rack = mesh(architecture,{materialKind:'rack'}); rack.name='RACK-01';
  const port = mesh(architecture); port.name='PP-01'; port.userData.port=1;
  const door = new T.Group(); architecture.add(door); mesh(door);
  const base = mesh(extras), grid = new T.GridHelper();
  architecture.add(grid);
  const clients = connections.map(row => {
    const group = new T.Group(); group.name=row.id; objects.add(group);
    return { pc: mesh(group,{materialKind:'tower'}), desk: mesh(group,{materialKind:'desk'}) };
  });
  const probes = {};
  for (const [layer] of inspectionLayers) {
    if (['floor','walls','computers','furniture','rack'].includes(layer)) continue;
    probes[layer] = mesh(utility,{inspectionLayer:layer});
  }
  const selected = connections[0];
  const data = mesh(utility,{ inspectionLayer:'ethernet', dataSegment:selected.dataSegments[0] });
  const other = mesh(utility,{ inspectionLayer:'ethernet', dataSegment:'SUBIDA-PC-25' });
  const power = mesh(utility,{ inspectionLayer:'electricity', powerSegment:selected.powerSegments.at(-1) });
  const foreign = mesh(utility,{ inspectionLayer:'electricity', powerSegment:connections.at(-1).powerSegments.at(-1) });
  const roots = { architecture, objects, infrastructure:utility, extras, floor, base, grid, door,
    network:new T.Group(), zones:new T.Group(), annotations:new T.Group(), guide:new T.Group(), rackMeshes:[rack,port] };
  const controller = infrastructureInspection(roots);
  return { roots, controller, floor, wall, rack, port, clients, meshes, probes, data, other, power, foreign };
}

test('el modo oculta la arquitectura, conserva equipos y restaura materiales, sombras y visibilidad', () => {
  const f = fixture();
  f.roots.infrastructure.visible=false;
  f.wall.visible=false;
  const original = [...f.meshes, ...Object.values(f.roots).filter(o=>o instanceof T.Object3D)].map(o =>
    ({ object:o, visible:o.visible, material:o.material, shadow:o.castShadow, position:o.position.toArray() }));
  const options = defaultInspectionOptions();
  f.controller.apply(options);
  assert.equal(f.floor.visible,false); assert.equal(f.wall.visible,false);
  assert.equal(f.roots.base.visible,false);
  assert.equal(f.roots.grid.visible,false);
  assert.equal(f.clients.filter(c => c.pc.visible && c.desk.visible).length,26);
  assert.ok(f.rack.visible);
  f.controller.apply({ ...options, style:'transparent', layers:{...options.layers, floor:true,walls:true} });
  assert.ok(f.floor.visible && f.wall.visible);
  assert.ok(f.floor.material.opacity < .15 && f.wall.material.opacity < .15);
  assert.equal(f.floor.castShadow,false);
  f.controller.apply(options);
  f.controller.apply(null);
  for (const saved of original) {
    assert.equal(saved.object.visible,saved.visible);
    assert.equal(saved.object.material,saved.material);
    assert.equal(saved.object.castShadow,saved.shadow);
    assert.deepEqual(saved.object.position.toArray(),saved.position);
  }
});

test('las doce capas son independientes y la selección resalta tramos compartidos y atenúa otros', () => {
  const f = fixture();
  const options = defaultInspectionOptions();
  for (const [layer] of inspectionLayers) {
    const all = Object.fromEntries(inspectionLayers.map(([key]) => [key,true]));
    f.controller.apply({ ...options, layers:{...all,[layer]:false} });
    const probe = layer==='floor' ? f.floor : layer==='walls' ? f.wall : layer==='computers' ? f.clients[0].pc
      : layer==='furniture' ? f.clients[0].desk : layer==='rack' ? f.rack : f.probes[layer];
    assert.equal(probe.visible,false,layer);
    if (layer!=='computers') assert.ok(f.clients[0].pc.visible,layer);
    if (layer!=='rack') assert.ok(f.rack.visible,layer);
  }
  for (const selection of connections) {
    f.controller.apply({...options,selection});
    assert.ok(f.clients.every(c=>c.pc.visible));
    if (selection.id==='PC-01') {
      assert.equal(f.data.material.opacity,1); assert.ok(f.other.material.opacity<.3);
      assert.equal(f.power.material.opacity,1); assert.ok(f.foreign.material.opacity<.3);
      assert.equal(f.port.material.color.getHex(),0xffcf40);
    }
  }
  f.controller.apply(null);
  assert.equal(f.port.material.color.getHex(),0x345678);
});
