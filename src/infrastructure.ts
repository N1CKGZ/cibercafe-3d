import { furniture, room, server, technical } from './model.ts';
import type { Model, Rect } from './model.ts';
import { devicePorts, rackDevices, serverPosition } from './network.ts';
import type { Network, NetworkPoint } from './network.ts';

export const floorLayers = {
  gap: 0.30, // 12 mm at 1:25, between the deck and the structural base.
  dataY: -0.18,
  powerY: -0.31,
  dataColor: 0x1764bd,
  dataDuctColor: 0x79c8f5,
  powerColor: 0x30343e,
  powerDuctColor: 0xf7a258,
  peripheralColor: 0x777784,
};
export const wireGauge = 0.017;
export const wireClearance = 0.008;
export const accessOpening = { start: 3.7, end: 9.2, x: room.w - 0.045, thickness: 0.09 };
export const inspectionWindow = { x: 6.8, z: room.d - 0.045, w: 2.5, d: 0.09 };
export const serviceBoxSize = { w: 0.25, h: 0.12, d: 0.08 };
export const serviceSymbol = { w: 0.10, h: 0.07 };
export const plateBracket = { w: 0.11, d: 0.038 };
export const powerDuctSize = { w: 0.09, h: 0.045 };
export const panel = { id: 'TE-01', x: 8.72, z: room.wall + 0.105, y: 1.24, w: 0.46, d: 0.21, h: 0.52 };
export const ups = { id: 'UPS-01', x: 9.35, z: 0.82, y: 0, w: 0.34, d: 0.36, h: 0.28 };
export const rackOutlet = { id: 'PE-UPS', x: ups.x, y: 0.26, z: room.wall + 0.10 };
export const circuitLabels = ['Fila 1', 'Fila 2', 'Fila 3', 'Fila 4', 'Fila 5', 'Recepción', 'UPS y rack', 'Alumbrado previsto'] as const;

const point = (x: number, y: number, z: number): NetworkPoint => ({ x, y, z });
const circuitId = (index: number) => `CE-0${index + 1}`;
export const pathLength = (points: NetworkPoint[]) => points.slice(1).reduce((sum, to, i) => {
  const from = points[i];
  return sum + Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
}, 0);

export function chamberParts() {
  const t = accessOpening.thickness;
  const railX = (start: number, end: number, z: number): Rect =>
    ({ x: (start + end) / 2, z, w: end - start, d: t });
  const railZ = (start: number, end: number, x: number): Rect =>
    ({ x, z: (start + end) / 2, w: t, d: end - start });
  return {
    supports: [
      railX(0, room.w, t / 2),
      railX(0, inspectionWindow.x - inspectionWindow.w / 2, room.d - t / 2),
      railX(inspectionWindow.x + inspectionWindow.w / 2, room.w, room.d - t / 2),
      railZ(t, room.d - t, t / 2),
      railZ(t, accessOpening.start, accessOpening.x),
      railZ(accessOpening.end, room.d - t, accessOpening.x),
      // Small intermediate piers. Their clearances are tested against the routed ducts.
      ...[1.05, 4.35, 7.12].flatMap(z => [2.25, 7.90].map(x => ({ x, z, w: 0.15, d: 0.15 }))),
    ],
    cover: railZ(accessOpening.start, accessOpening.end, accessOpening.x),
    window: inspectionWindow,
  };
}

export function stationHardware(station: Model['admin']) {
  const { desk, chair, orientation } = station;
  const admin = station.id === 'ADM-01';
  const side = Math.cos(orientation);
  const x = admin ? chair.x : desk.x;
  const towerX = x + (admin ? 1 : -1) * 0.31;
  const towerDepth = Math.min(desk.d - 0.10, 0.34);
  const top = furniture.deskHeight;
  return { x, towerX, towerDepth, monitorZ: desk.z - side * desk.d * 0.23,
    inputZ: desk.z + side * desk.d * 0.20, side, top };
}

export function buildInfrastructure(model: Model, network: Network) {
  const { powerY } = floorLayers;
  const stations = new Map<string, { station: Model['admin']; row: number }>([
    ...model.stations.map(station => [station.id, { station, row: station.row }] as const),
    [model.admin.id, { station: model.admin, row: 5 }] as const,
  ]);
  const services = network.links.map(link => {
    const { station, row } = stations.get(link.equipment)!;
    const { desk } = station;
    const hw = stationHardware(station);
    const plate = point(hw.x + 0.04, link.outletPoint.y, desk.z - hw.side * 0.13);
    const outlet = point(plate.x + 0.062, plate.y, plate.z + hw.side * serviceBoxSize.d / 2);
    const jack = point(plate.x - 0.062, plate.y, outlet.z);
    const labels = { box: `CS-${station.id}`, power: `PE-${station.id}`, jack: link.outlet };
    const towerBack = point(hw.towerX, 0.33, desk.z - hw.side * hw.towerDepth / 2);
    const tie = point(hw.towerX, hw.top - 0.08, towerBack.z);
    const drop = point(hw.towerX, hw.top + 0.025, towerBack.z);
    const deviceLead = (x: number, y: number, z: number) => [
      point(x, y, z), point(x, y, drop.z), drop, tie, towerBack,
    ];
    const socketLead = (socket: NetworkPoint, dy: number) => {
      const y = socket.y + dy;
      const front = socket.z + hw.side * 0.025;
      return [socket, point(socket.x, y, front), point(towerBack.x, y, front), towerBack];
    };
    const bracket = { ...plateBracket, x: plate.x, z: plate.z,
      y: plate.y + serviceBoxSize.h / 2,
      h: hw.top - 0.055 - (plate.y + serviceBoxSize.h / 2) };
    return {
      id: station.id, link, plate, bracket, jack, outlet, labels, face: hw.side,
      circuit: circuitId(row),
      leads: {
        ethernet: socketLead(jack, -0.018),
        power: socketLead(outlet, 0.018),
        monitor: deviceLead(hw.x, hw.top + 0.18, hw.monitorZ - hw.side * 0.02),
        keyboard: deviceLead(hw.x, hw.top + 0.014, hw.inputZ - hw.side * 0.06),
        mouse: deviceLead(hw.x + 0.24, hw.top + 0.016, hw.inputZ - hw.side * 0.052),
        jackTail: [link.outletPoint, point(jack.x, jack.y, link.outletPoint.z), jack],
      },
    };
  });

  const spineX = network.spineX + 0.48;
  const intake = point(panel.x, powerY, panel.z);
  const feedX = point(spineX, powerY, panel.z);
  const ductMap = new Map<string, { id: string; from: NetworkPoint; to: NetworkPoint; circuits: string[] }>();
  function addDuct(circuit: string, from: NetworkPoint, to: NetworkPoint, name: string) {
    if (pathLength([from, to]) < 1e-8) return;
    const key = [from, to].map(p => [p.x, p.y, p.z].join(':')).sort().join('|');
    const duct = ductMap.get(key) ?? { id: name, from, to, circuits: [] };
    if (!duct.circuits.includes(circuit)) duct.circuits.push(circuit);
    ductMap.set(key, duct);
  }
  const stops = [...new Set(services.map(s => s.plate.z))].sort((a, b) => a - b);
  const circuits = stops.map((z, i) => {
    // Reception and each row receive an independent feed. Common ducts are counted once.
    const row = services.filter(s => s.plate.z === z);
    const id = row[0].circuit;
    const feed = [point(panel.x, panel.y, panel.z), intake, feedX,
      ...stops.slice(0, i + 1).map(stop => point(spineX, powerY, stop))];
    const runs: NetworkPoint[][] = [feed];
    for (const dir of [-1, 1]) {
      const branch = row.filter(s => Math.sign(s.outlet.x - spineX) === dir)
        .sort((a, b) => Math.abs(a.outlet.x - spineX) - Math.abs(b.outlet.x - spineX));
      if (!branch.length) continue;
      runs.push([point(spineX, powerY, z), ...branch.map(s => point(s.outlet.x, powerY, z))]);
      runs.push(...branch.map(s => [point(s.outlet.x, powerY, z),
        point(s.outlet.x, s.outlet.y, z), s.outlet]));
    }
    return { id, label: circuitLabels[Number(id.at(-1)) - 1], loads: row.map(s => s.id), runs };
  });
  const rackBase = point(rackOutlet.x, powerY, rackOutlet.z);
  const upsInput = point(ups.x, 0.12, ups.z - ups.d / 2);
  const upsOutput = point(ups.x, 0.18, ups.z + ups.d / 2);
  const rackLeads = [rackOutlet, point(upsInput.x, rackOutlet.y, upsInput.z), upsInput];
  const backup = [...[rackDevices.switch, rackDevices.router, rackDevices.ont].map(device => ({
    id: device.id, to: point(technical.rack.x, device.point.y, technical.rack.z - technical.rack.d / 2),
  })), { id: server.id, to: point(serverPosition.x, serverPosition.y + server.height / 2, serverPosition.z - server.d / 2) }]
    .map(({ id, to }) => ({ id, points: [upsOutput, point(to.x, upsOutput.y, to.z), to] }));
  const rackCircuit = circuitId(6);
  circuits.push({ id: rackCircuit, label: circuitLabels[6], loads: [ups.id], runs: [
    [point(panel.x, panel.y, panel.z), intake, rackBase, rackOutlet],
  ] });
  for (const circuit of circuits) {
    for (const [run, points] of circuit.runs.entries()) {
      for (const [i, to] of points.slice(1).entries()) {
        addDuct(circuit.id, points[i], to, `${circuit.id}-${run + 1}-${i + 1}`);
      }
    }
  }
  const panelPorts = devicePorts(rackDevices.panel);
  const switchPorts = devicePorts(rackDevices.switch);
  const patches = network.links.map(link => {
    const from = panelPorts[Number(link.panelPort.split('/')[1]) - 1];
    const to = switchPorts[Number(link.switchPort.split('/')[1]) - 1];
    const frontZ = rackDevices.panel.point.z + 0.07;
    return { id: link.id, points: [from, { ...from, z: frontZ }, { ...to, z: frontZ }, to] };
  });
  return { services, circuits, ducts: [...ductMap.values()], rackLeads, backup, patches };
}
