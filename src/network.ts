import { createModel, rackHeight, server, technical } from './model.ts';

export type NetworkPoint = { x: number; y: number; z: number };
type Section = '80×40' | '40×25' | '25×16';
export type Duct = {
  id: string; from: NetworkPoint; to: NetworkPoint; section: Section;
  length: number; horizontal: number; vertical: number; cables: string[];
};

const point = (x: number, y: number, z: number): NetworkPoint => ({ x, y, z });
const { x: rackX, z: rackZ, d: rackDepth } = technical.rack;
const face = rackZ + rackDepth / 2 + 0.009;
export const serverPosition = point(rackX, rackHeight + 0.10, rackZ);
const device = (id: string, y: number, w: number, h: number, ports = 0) => ({
  id, point: point(rackX, y, face), w, h, ports,
});
export const rackDevices = {
  panel: device('PP-01', 0.63, 0.49, 0.057, 48),
  switch: device('SW-01', 0.51, 0.49, 0.057, 48),
  router: device('RTR-01', 0.36, 0.30, 0.075),
  ont: device('ONT-01', 0.22, 0.24, 0.07),
};

export const sectionSize = {
  '80×40': [0.08, 0.04], '40×25': [0.04, 0.025], '25×16': [0.025, 0.016],
} as const;
export const networkSpec = { underfloorY: -0.18, outletY: 0.45, reserve: 1.5, cableDiameter: 0.0065 };

function port(device: typeof rackDevices.panel, index: number) {
  return point(device.point.x + ((index - 1) % 24 - 11.5) * 0.0185,
    device.point.y + (index <= 24 ? 0.012 : -0.012), device.point.z + 0.008);
}

export const devicePorts = (device: typeof rackDevices.panel) =>
  Array.from({ length: device.ports }, (_, i) => port(device, i + 1));

export const localPatches = [
  { from: server.id, to: 'SW-01/27', points: [
    point(rackX, serverPosition.y + server.height / 2, rackZ + server.d / 2),
    point(rackX + 0.18, serverPosition.y, face + 0.05), port(rackDevices.switch, 27),
  ] },
  { from: 'RTR-01 LAN', to: 'SW-01/28', points: [
    point(rackX - 0.08, rackDevices.router.point.y, face + 0.009),
    point(rackX - 0.15, 0.43, face + 0.05), port(rackDevices.switch, 28),
  ] },
  { from: 'ONT-01', to: 'RTR-01 WAN', points: [
    point(rackX + 0.08, rackDevices.ont.point.y, face + 0.009),
    point(rackX + 0.16, 0.29, face + 0.05),
    point(rackX + 0.08, rackDevices.router.point.y, face + 0.009),
  ] },
];

export function buildNetwork() {
  const model = createModel('compactA2', 'occupied');
  const { underfloorY, outletY, reserve } = networkSpec;
  const spineX = (model.stations[2].desk.x + model.stations[3].desk.x) / 2;
  const spineAt = (z: number) => point(spineX, underfloorY, z);
  const ducts: Duct[] = [];
  const tray = (id: string, from: NetworkPoint, to: NetworkPoint, section: Section) => {
    const horizontal = Math.hypot(to.x - from.x, to.z - from.z);
    const vertical = Math.abs(to.y - from.y);
    const duct: Duct = { id, from, to, section, length: horizontal + vertical, horizontal, vertical, cables: [] };
    ducts.push(duct);
    return duct;
  };

  // The panel point is on the rear termination side, distinct from the
  // visible RJ45 patch ports on its front. Shared paths begin inside the rack.
  const panelRear = point(rackX, rackDevices.panel.point.y, rackZ);
  const rackFoot = point(rackX, underfloorY, rackZ);
  const feed = [
    tray('RACK-BAJADA', panelRear, rackFoot, '80×40'),
    tray('RACK-CRUCE', rackFoot, spineAt(rackZ), '80×40'),
  ];
  const destinations = [...model.stations.map(station => ({ id: station.id, x: station.desk.x, z: station.desk.z })),
    { id: model.admin.id, x: model.admin.chair.x, z: model.admin.desk.z }];
  const stops = [...new Set([...destinations.map(o => o.z), rackZ])].sort((a, b) => a - b);
  const spine = stops.slice(1).map((z, i) => tray(`TRONCAL-${i + 1}`, spineAt(stops[i]), spineAt(z), '80×40'));
  const endpoints = new Map<string, { path: Duct[]; at: NetworkPoint }>();

  for (const z of stops) {
    const row = destinations.filter(o => o.z === z);
    for (const direction of [-1, 1]) {
      const branch = row.filter(o => Math.sign(o.x - spineX) === direction)
        .sort((a, b) => Math.abs(a.x - spineX) - Math.abs(b.x - spineX));
      let previous = spineAt(z);
      const path: Duct[] = [];
      for (const item of branch) {
        const base = point(item.x, underfloorY, z);
        const at = point(item.x, outletY, z);
        path.push(tray(`RAMAL-${item.id}`, previous, base, '40×25'));
        endpoints.set(item.id, { path: [...path, tray(`SUBIDA-${item.id}`, base, at, '25×16')], at });
        previous = base;
      }
    }
  }

  const links = destinations.map((item, i) => {
    const number = String(i + 1).padStart(2, '0');
    const id = `C-${number}`;
    const end = endpoints.get(item.id)!;
    const low = Math.min(rackZ, item.z);
    const high = Math.max(rackZ, item.z);
    const trunk = spine.filter(s => s.from.z >= low && s.to.z <= high);
    const reverse = item.z < rackZ;
    const segments = [...feed, ...(reverse ? trunk.reverse() : trunk), ...end.path];
    const points = [panelRear, ...segments.map(s => reverse && trunk.includes(s) ? s.from : s.to)];
    for (const segment of segments) segment.cables.push(id);
    const horizontal = segments.reduce((sum, s) => sum + s.horizontal, 0);
    const vertical = segments.reduce((sum, s) => sum + s.vertical, 0);
    return {
      id, equipment: item.id, outlet: `TR-${number}`, panelPort: `PP-01/${number}`, switchPort: `SW-01/${number}`,
      outletPoint: end.at, points, segments, horizontal, vertical, reserve, total: horizontal + vertical + reserve,
    };
  });
  return { links, ducts, spineX, localPatches };
}

export type Network = ReturnType<typeof buildNetwork>;
