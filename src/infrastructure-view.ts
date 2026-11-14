import { segmentKey } from './inspection.ts';
import * as T from 'three';
import { buildInfrastructure, chamberParts, circuitLabels, floorLayers, panel, powerDuctSize, rackOutlet, serviceBoxSize, ups, wireClearance, wireGauge } from './infrastructure.ts';
import { sectionSize } from './network.ts';
import type { Network, NetworkPoint } from './network.ts';
import type { Model, Rect } from './model.ts';
import type { ComponentKind } from './maquette.ts';

type Box = (group: T.Group, rect: Rect, bottom: number, height: number, color: number, material?: T.Material) => T.Mesh;
type Tag = (mesh: T.Mesh, kind: ComponentKind, id: string, color?: number) => T.Mesh;

export function infrastructureView(model: Model, network: Network, box: Box, tag: Tag, floorBottom: number) {
  const frame = new T.Group(), access = new T.Group(), services = new T.Group();
  const underData = new T.Group(), underPower = new T.Group();
  const visibleData = new T.Group(), visiblePower = new T.Group(), peripherals = new T.Group();
  const equipment = new T.Group(), rackPower = new T.Group(), rackData = new T.Group();
  const parts = chamberParts();
  const { gap, dataColor, dataDuctColor, powerColor, powerDuctColor, peripheralColor } = floorLayers;
  for (const support of parts.supports) tag(box(frame, support, floorBottom - gap, gap, 0xb38d65), 'chamber', 'PT-01', 0xb38d65);
  tag(box(access, parts.cover, floorBottom - gap, gap, 0xa97b51), 'access', 'TL-01', 0xa97b51);
  tag(box(access, { ...parts.cover, x: parts.cover.x + 0.065, d: 0.36 }, floorBottom - gap * 0.65,
    0.08, 0x79634b), 'access', 'TL-01', 0x79634b);
  const acrylic = new T.MeshStandardMaterial({ color: 0x8dc9df, transparent: true, opacity: 0.33, depthWrite: false });
  const glass = box(frame, parts.window, floorBottom - gap, gap, 0x8dc9df, acrylic);
  glass.userData.keepMaterial = true;
  tag(glass, 'inspection', 'VI-01');

  const lineBox = new T.BoxGeometry(1, 1, 1);
  const lineMaterials = new Map<number, T.Material>();
  const up = new T.Vector3(0, 1, 0);
  function bar(group: T.Group, from: NetworkPoint, to: NetworkPoint, w: number, d: number, color: number,
    kind: ComponentKind, id: string) {
    const delta = new T.Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
    const length = delta.length();
    if (length < 1e-8) return;
    let material = lineMaterials.get(color);
    if (!material) {
      material = color === dataDuctColor || color === powerDuctColor
        ? new T.MeshBasicMaterial({ color })
        : new T.MeshStandardMaterial({ color, roughness: 0.9 });
      lineMaterials.set(color, material);
    }
    const mesh = new T.Mesh(lineBox, material);
    mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    mesh.quaternion.setFromUnitVectors(up, delta.divideScalar(length));
    mesh.scale.set(from.y === to.y && from.z === to.z ? d : w, length,
      from.y === to.y && from.z === to.z ? w : d);
    mesh.userData.keepMaterial = true;
    group.add(mesh);
    tag(mesh, kind, id, color);
  }
  function cable(group: T.Group, points: NetworkPoint[], width: number, color: number, kind: ComponentKind, id: string) {
    for (const [i, to] of points.slice(1).entries()) bar(group, points[i], to, width, width, color, kind, id);
  }
  const shifted = (p: NetworkPoint, dy: number) => ({ ...p, y: p.y + dy });
  const infra = buildInfrastructure(model, network);
  function run(from: NetworkPoint, to: NetworkPoint, width: number, depth: number, power: boolean, id: string, wireId: string) {
    const groups = [underData, underPower, visibleData, visiblePower, rackPower];
    const before = groups.map(group => group.children.length);
    const ductColor = power ? powerDuctColor : dataDuctColor;
    const wireColor = power ? powerColor : dataColor;
    const ductKind = power ? 'powerDuct' : 'duct';
    const wireKind = power ? 'powerWire' : 'cable';
    const hidden = power ? underPower : underData;
    const above = power ? visiblePower : visibleData;
    const y = power ? floorLayers.powerY : floorLayers.dataY;
    const covered = from.y === y && to.y === y;
    const aboveGroup = power && id.startsWith('CE-07') ? rackPower : above;
    if (covered) bar(hidden, from, to, width, depth, ductColor, ductKind, id);
    else if (Math.max(from.y, to.y) > 0) {
      const top = from.y > to.y ? from : to;
      const low = from.y > to.y ? to : from;
      bar(aboveGroup, low, top, width, depth, ductColor, ductKind, id);
      bar(aboveGroup, low, top, wireGauge, wireGauge, wireColor, wireKind, wireId);
    }
    if (covered) {
      for (const sign of [-1, 1]) {
        bar(hidden, shifted(from, sign * (depth / 2 + wireClearance)), shifted(to, sign * (depth / 2 + wireClearance)),
          wireGauge, wireGauge, wireColor, wireKind, wireId);
      }
    }
    for (const [i, group] of groups.entries()) {
      for (const mesh of group.children.slice(before[i])) {
        Object.assign(mesh.userData, {
          inspectionLayer: mesh.userData.materialKind === ductKind
            ? power ? 'powerDuct' : 'dataDuct' : power ? 'electricity' : 'ethernet',
          ...(power ? { powerSegment: segmentKey(from, to) } : { dataSegment: id }),
        });
      }
    }
  }
  for (const duct of network.ducts) {
    const [w, d] = sectionSize[duct.section];
    run(duct.from, duct.to, w, d, false, duct.id, duct.cables[0]);
  }
  for (const duct of infra.ducts) run(duct.from, duct.to, powerDuctSize.w, powerDuctSize.h, true, duct.id, duct.circuits[0]);

  function caption(group: T.Group, lines: string[], x: number, y: number, z: number, w: number, h: number,
    kind: ComponentKind, id: string, face = 1, flat = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f0ede6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1e3247';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${lines.length === 1 ? 72 : 41}px sans-serif`;
    lines.forEach((line, i) => ctx.fillText(line, 256, 128 * (i + 0.5) / lines.length, 495));
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map, side: flat ? T.FrontSide : T.DoubleSide }));
    mesh.position.set(x, y, z);
    if (flat) mesh.rotation.x = -face * Math.PI / 2;
    else mesh.rotation.y = face === 1 ? 0 : Math.PI;
    mesh.userData.keepMaterial = true;
    tag(mesh, kind, id);
    group.add(mesh);
  }
  for (const [index, circuit] of infra.circuits.entries()) {
    const first = infra.services.find(service => service.circuit === circuit.id);
    const origin = first?.plate ?? rackOutlet;
    const x = origin.x - 0.45;
    const z = origin.z + (index < 5 ? 0.24 : 0.21);
    for (const side of [1, -1]) {
      caption(underPower, [circuit.id], x, floorLayers.powerY + side * 0.022, z,
        0.41, 0.17, 'powerWire', circuit.id, side, true);
    }
  }
  for (const station of infra.services) {
    const { plate, bracket, outlet, jack, labels, face, leads } = station;
    const y = plate.y - serviceBoxSize.h / 2;
    const blockStart = [services, visibleData, visiblePower, peripherals].map(group => group.children.length);
    const dataMarker = tag(box(underData, { ...station.link.outletPoint, w: 0.105, d: 0.105 },
      floorLayers.dataY - 0.04, 0.075, dataColor), 'jack', labels.jack, dataColor);
    const powerMarker = tag(box(underPower, { ...outlet, z: plate.z, w: 0.105, d: 0.105 },
      floorLayers.powerY - 0.04, 0.075, powerDuctColor), 'socket', labels.power, powerDuctColor);
    dataMarker.userData.station = powerMarker.userData.station = station.id;
    tag(box(services, { ...serviceBoxSize, ...plate }, y, serviceBoxSize.h, 0xf2eee3), 'serviceBox', labels.box, 0xf2eee3);
    tag(box(services, bracket, bracket.y, bracket.h, 0xc4b394), 'serviceBox', labels.box, 0xc4b394);
    const jackFront = jack.z + face * 0.006;
    tag(box(services, { x: jack.x, z: jackFront, w: 0.074, d: 0.009 }, jack.y - 0.033, 0.043, dataColor), 'jack', labels.jack, dataColor);
    for (const offset of [-0.021, -0.006, 0.009, 0.024]) {
      tag(box(services, { x: outlet.x + offset, z: outlet.z + face * 0.006, w: 0.009, d: 0.009 },
        outlet.y - 0.022, 0.020, powerColor), 'socket', labels.power, powerColor);
    }
    caption(services, [station.id], plate.x, plate.y + 0.032, jack.z + face * 0.007,
      0.21, 0.036, 'serviceBox', labels.box, face);
    cable(visibleData, leads.ethernet, 0.017, dataColor, 'dataLead', station.id);
    cable(visibleData, leads.jackTail, 0.013, dataColor, 'dataLead', station.id);
    cable(visiblePower, leads.power, 0.015, powerColor, 'powerWire', station.id);
    cable(visiblePower, leads.monitor, 0.012, powerColor, 'powerWire', station.id);
    for (const points of [leads.keyboard, leads.mouse])
      cable(peripherals, points, 0.012, peripheralColor, 'peripheral', station.id);
    [services, visibleData, visiblePower, peripherals].forEach((group, index) => {
      for (const mesh of group.children.slice(blockStart[index])) mesh.userData.station = station.id;
    });
  }
  tag(box(equipment, panel, panel.y, panel.h, 0xcfd5dd), 'panel', panel.id, 0xcfd5dd);
  const face = panel.z + panel.d / 2 + 0.016;
  tag(box(equipment, { x: panel.x, z: face, w: panel.w * 0.91, d: 0.022 },
    panel.y + 0.022, panel.h - 0.044, 0xf1f3f4), 'panel', panel.id, 0xf1f3f4);
  caption(equipment, ['TE-01'], panel.x, panel.y + panel.h * .82, face + .015, .31, .078, 'panel', panel.id);
  for (const [i, label] of circuitLabels.entries()) {
    const x = panel.x + (i % 2 - 0.5) * 0.18;
    const y = panel.y + 0.37 - Math.floor(i / 2) * 0.083;
    tag(box(equipment, { x: x - 0.05, z: face + 0.016, w: 0.028, d: 0.018 },
      y - 0.021, 0.044, i === 7 ? 0x8a8984 : powerColor), 'panel', panel.id, i === 7 ? 0x8a8984 : powerColor);
    caption(equipment, [`CE-0${i + 1}`, i === 7 ? 'Previsto' : label], x + 0.023, y, face + 0.019,
      0.116, 0.054, 'panel', panel.id);
  }
  tag(box(equipment, ups, ups.y, ups.h, 0x586575), 'ups', ups.id, 0x586575);
  caption(equipment, [ups.id], ups.x, ups.h * 0.65, ups.z + ups.d / 2 + 0.008, 0.24, 0.058, 'ups', ups.id);
  tag(box(equipment, { ...rackOutlet, w: 0.1, d: 0.035 }, rackOutlet.y - 0.035, 0.07, 0xeae6db),
    'socket', rackOutlet.id, 0xeae6db);
  for (const x of [rackOutlet.x - 0.024, rackOutlet.x - 0.008, rackOutlet.x + 0.008, rackOutlet.x + 0.024]) {
    tag(box(equipment, { x, z: rackOutlet.z + 0.021, w: 0.008, d: 0.009 }, rackOutlet.y - 0.01,
      0.025, powerColor), 'socket', rackOutlet.id, powerColor);
  }
  cable(rackPower, infra.rackLeads, 0.018, powerColor, 'powerWire', ups.id);
  for (const lead of infra.backup) cable(rackPower, lead.points, 0.018, powerColor, 'powerWire', ups.id);

  for (const patch of infra.patches) cable(rackData, patch.points, 0.007, dataColor, 'rackPatch', patch.id);
  return { frame, access, services, underData, underPower, visibleData, visiblePower, peripherals, equipment, rackPower, rackData };
}
