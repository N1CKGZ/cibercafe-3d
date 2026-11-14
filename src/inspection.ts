import { buildInfrastructure, pathLength } from './infrastructure.ts';
import type { Network, NetworkPoint } from './network.ts';
import { portMap } from './network-design.ts';

export const inspectionLayers = [
  ['ethernet', 'Ethernet Cat6'], ['electricity', 'Electricidad decorativa'],
  ['dataDuct', 'Canalizaciones de datos'], ['powerDuct', 'Canalizaciones eléctricas'],
  ['boxes', 'Cajas de servicio'], ['sockets', 'RJ45 y tomacorrientes'],
  ['panel', 'Tablero TE-01'], ['rack', 'Rack, equipos técnicos y UPS'],
  ['computers', 'Computadoras'], ['furniture', 'Escritorios y sillas'],
  ['floor', 'Piso'], ['walls', 'Muros'],
] as const;
export type InspectionLayer = typeof inspectionLayers[number][0];
export type InfrastructureSelection = ReturnType<typeof connectionCatalog>[number];
export type InfrastructureOptions = {
  style: 'transparent' | 'only';
  layers: Record<InspectionLayer, boolean>;
  selection: InfrastructureSelection | null;
};
export function defaultInspectionOptions(): InfrastructureOptions {
  return { style: 'only', selection: null,
    layers: Object.fromEntries(inspectionLayers.map(([key]) => [key, key !== 'floor' && key !== 'walls'])) as InfrastructureOptions['layers'] };
}
export function pointKey(p: NetworkPoint) {
  return [p.x, p.y, p.z].map(n => n.toFixed(7)).join(',');
}
export function segmentKey(a: NetworkPoint, b: NetworkPoint) {
  return [pointKey(a), pointKey(b)].sort().join('|');
}

export function connectionCatalog(network: Network, infrastructure: ReturnType<typeof buildInfrastructure>) {
  const ports = portMap(network);
  return infrastructure.services.map(service => {
    const circuit = infrastructure.circuits.find(c => c.id === service.circuit)!;
    const ducts = infrastructure.ducts.filter(d => d.circuits.includes(circuit.id));
    const origin = pointKey(circuit.runs[0][0]), destination = pointKey(service.outlet);
    const neighbors = new Map<string, { next: string; length: number; key: string }[]>();
    for (const duct of ducts) {
      const from = pointKey(duct.from), to = pointKey(duct.to);
      const length = pathLength([duct.from, duct.to]), key = segmentKey(duct.from, duct.to);
      neighbors.set(from, [...neighbors.get(from) ?? [], { next: to, length, key }]);
      neighbors.set(to, [...neighbors.get(to) ?? [], { next: from, length, key }]);
    }
    const distances = new Map([[origin, 0]]);
    const previous = new Map<string, { node: string; segment: string }>();
    const pending = new Set([origin]);
    while (pending.size) {
      const current = [...pending].reduce((a, b) => distances.get(a)! <= distances.get(b)! ? a : b);
      pending.delete(current);
      if (current === destination) break;
      for (const edge of neighbors.get(current) ?? []) {
        const distance = distances.get(current)! + edge.length;
        if (distance >= (distances.get(edge.next) ?? Infinity)) continue;
        distances.set(edge.next, distance);
        previous.set(edge.next, { node: current, segment: edge.key });
        pending.add(edge.next);
      }
    }
    if (!distances.has(destination)) throw new Error(`Sin ruta eléctrica entre TE-01 y ${service.id}`);
    const powerSegments = [];
    let at = destination;
    while (at !== origin) {
      const step = previous.get(at)!;
      powerSegments.push(step.segment);
      at = step.node;
    }
    return {
      id: service.id, service, link: service.link, circuit,
      vlan: ports.sw.find(port => port.equipment === service.id)!.vlans[0],
      dataSegments: service.link.segments.map(d => d.id),
      powerSegments: powerSegments.reverse(), powerLength: distances.get(destination)!,
      powerCordLength: pathLength(service.leads.power),
    };
  });
}
