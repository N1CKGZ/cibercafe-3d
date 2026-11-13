import { entrance, leafThickness, leaves, leafTip, room, study, techDoor, technical, waiting, wallParts, walls } from './model.ts';
import type { Model, Point, Rect } from './model.ts';

export const minX = (r: Rect) => r.x - r.w / 2;
export const maxX = (r: Rect) => r.x + r.w / 2;
export const minZ = (r: Rect) => r.z - r.d / 2;
export const maxZ = (r: Rect) => r.z + r.d / 2;

function intersects(a: Rect, b: Rect) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-8 &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-8;
}

export type Passage = { id: string; label: string; width: number; rect: Rect; direction: 'x' | 'z'; detail: string; at?: Point };
function passage(id: string, label: string, x0: number, x1: number, z0: number, z1: number, direction: 'x' | 'z', detail: string): Passage {
  return {
    id, label, direction, detail,
    width: direction === 'x' ? z1 - z0 : x1 - x0,
    rect: { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.max(0.025, x1 - x0), d: Math.max(0.025, z1 - z0) },
  };
}

export function measurePassages(model: Model): Passage[] {
  const first = model.stations.filter(({ row }) => row === 0);
  const left = minX(first[0].desk);
  const right = maxX(first.at(-1)!.desk);
  const aisles = model.layout.rows.slice(0, -1).map((_, row) => {
    const a = model.stations.find(s => s.row === row)!;
    const b = model.stations.find(s => s.row === row + 1)!;
    const empty = minZ(b.desk) - maxZ(a.desk);
    return {
      ...passage(`P${row + 1}`, `Filas ${row + 1} y ${row + 2}`, left, right, maxZ(a.chair), minZ(b.desk), 'x',
        `Entre mesas hay ${meters(empty)}. La silla sobresale ${meters(a.chair.d)} desde el borde.`),
      at: { x: a.chair.x, z: (maxZ(a.chair) + minZ(b.desk)) / 2 },
    };
  });
  const last = model.stations.at(-1)!;
  const openWidth = (door: typeof entrance, count: number) => door.end - door.start - count * leafThickness / 2;
  const passages = [...aisles,
    passage('left', 'Lateral izquierdo', room.wall, left, minZ(first[0].desk), maxZ(last.chair), 'z',
      'Medido entre el muro interior y el borde de las mesas. La recepción se evalúa aparte.'),
    passage('right', model.layoutId === 'compactA2' ? 'Separación junto al tabique' : 'Lateral del cuarto',
      right, technical.x - room.wall / 2, minZ(first[0].desk), technical.z, 'z',
      model.layoutId === 'compactA2' ? 'Separación entre las mesas y el tabique, fuera de la ruta al cuarto.'
        : 'Medido junto al cuarto técnico, entre la última columna y el tabique.'),
    passage('front', 'Acceso principal', entrance.start + leafThickness / 2, entrance.end - leafThickness / 2,
      room.d - room.wall - 0.85, room.d, 'z',
      `Vano de ${meters(entrance.end - entrance.start)}. Luz estimada con dos hojas abiertas a 90°: ${meters(openWidth(entrance, 2))}.`),
    passage('tech', 'Acceso al cuarto técnico', techDoor.start + leafThickness / 2, techDoor.end,
      technical.z - 0.4, technical.z + 0.55, 'z',
      `Vano de ${meters(techDoor.end - techDoor.start)}. Luz estimada con la hoja abierta a 90°: ${meters(openWidth(techDoor, 1))}.`),
  ];
  if (model.layoutId === 'compactA2') {
    const center = passage('center-aisle', 'Corredor central', maxX(first[2].desk), minX(first[3].desk),
      minZ(first[0].desk), maxZ(last.chair), 'z', 'Entre los bloques de tres y dos mesas. El giro hacia cada fila se evalúa en la ruta al puesto.');
    passages.push({ ...center, at: { x: center.rect.x, z: first[2].desk.z } });
  }
  return passages;
}

export const meters = (n: number) => `${Math.max(0, n).toFixed(2)} m`;
export const service: Rect = { x: technical.rack.x, z: maxZ(technical.rack) + technical.serviceDepth / 2,
  w: technical.rack.w, d: technical.serviceDepth };

type Obstacle = { label: string; rect: Rect };
type Approach = { id: string; rect: Rect; preferred: Point };

function clearance(point: Point, rect: Rect) {
  return Math.max(0, Math.abs(point.x - rect.x) - rect.w / 2, Math.abs(point.z - rect.z) - rect.d / 2) * 2;
}

function routeGrid(obstacles: Obstacle[]) {
  const { grid } = study;
  const nx = Math.round(room.w / grid) + 1;
  const nz = Math.round(room.d / grid) + 1;
  const source = nx * (nz - 1) + Math.round((entrance.start + entrance.end) / (2 * grid));
  const limit = Math.ceil((entrance.end - entrance.start) / grid);
  const local = new Uint16Array(nx * nz).fill(limit);
  const widest = new Uint16Array(nx * nz);
  const parent = new Int32Array(nx * nz).fill(-1);
  const buckets: number[][] = Array.from({ length: limit + 1 }, () => []);
  const pointAt = (i: number): Point => ({ x: (i % nx) * grid, z: Math.floor(i / nx) * grid });
  const eps = 1e-7;

  // Evaluate only within range of each obstacle. Beyond the entry width,
  // local clearance cannot improve a route leading through that entry.
  const pad = limit * grid / 2;
  for (const { rect } of obstacles) {
    const x0 = Math.max(0, Math.ceil((minX(rect) - pad) / grid));
    const x1 = Math.min(nx - 1, Math.floor((maxX(rect) + pad) / grid));
    const z0 = Math.max(0, Math.ceil((minZ(rect) - pad) / grid));
    const z1 = Math.min(nz - 1, Math.floor((maxZ(rect) + pad) / grid));
    for (let iz = z0; iz <= z1; iz++) {
      const dz = Math.abs(iz * grid - rect.z) - rect.d / 2;
      for (let ix = x0; ix <= x1; ix++) {
        const dx = Math.abs(ix * grid - rect.x) - rect.w / 2;
        const i = iz * nx + ix;
        const steps = Math.floor((2 * Math.max(0, dx, dz) + eps) / grid);
        local[i] = Math.min(local[i], steps);
      }
    }
  }

  // Flood from the exit in descending width. Four-connected edges are no
  // longer than the thinnest modeled obstacle, so neither can skip a barrier.
  widest[source] = local[source];
  parent[source] = source;
  buckets[local[source]].push(source);
  for (let width = limit; width > 0; width--) {
    const bucket = buckets[width];
    for (let head = 0; head < bucket.length; head++) {
      const i = bucket[head];
      if (widest[i] !== width) continue;
      const x = i % nx;
      for (const next of [x > 0 ? i - 1 : -1, x < nx - 1 ? i + 1 : -1,
        i >= nx ? i - nx : -1, i < nx * (nz - 1) ? i + nx : -1]) {
        if (next < 0) continue;
        const capacity = Math.min(width, local[next]);
        if (capacity <= widest[next]) continue;
        widest[next] = capacity;
        parent[next] = i;
        buckets[capacity].push(next);
      }
    }
  }

  function measure({ rect, preferred }: Approach) {
    let index = -1;
    let width = 0;
    let distance = Infinity;
    const x0 = Math.max(0, Math.ceil((minX(rect) - eps) / grid));
    const x1 = Math.min(nx - 1, Math.floor((maxX(rect) + eps) / grid));
    const z0 = Math.max(0, Math.ceil((minZ(rect) - eps) / grid));
    const z1 = Math.min(nz - 1, Math.floor((maxZ(rect) + eps) / grid));
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const i = iz * nx + ix;
        const d = (ix * grid - preferred.x) ** 2 + (iz * grid - preferred.z) ** 2;
        if (widest[i] > width || (widest[i] === width && width > 0 && d < distance)) {
          index = i;
          width = widest[i];
          distance = d;
        }
      }
    }
    if (index < 0) return { index, width: 0, path: [] as Point[], pinch: null };

    let tightest = Infinity;
    let pinch = pointAt(index);
    const path: Point[] = [];
    for (let i = index; ; i = parent[i]) {
      const point = pointAt(i);
      const actual = Math.min(...obstacles.map(o => clearance(point, o.rect)));
      if (actual < tightest - eps) {
        tightest = actual;
        pinch = point;
      }
      path.push(point);
      if (i === source) break;
    }
    const nearby = obstacles.filter(o => clearance(pinch, o.rect) <= tightest + grid + eps).map(o => o.label);
    return { index, width: width * grid, path: path.reverse(), pinch: { point: pinch, nearby } };
  }
  return { measure, pointAt };
}

export function inspect(model: Model) {
  const furniture = [...model.stations, model.admin].flatMap(s => [
    { label: `Mesa ${s.id}`, rect: s.desk }, { label: `Silla ${s.id}`, rect: s.chair },
  ]).concat([{ label: 'Espera', rect: waiting }, { label: 'RACK-01', rect: technical.rack }]);
  const solidWalls = walls.flatMap(w => wallParts(w)
    .filter(part => part.bottom === 0).map(part => ({ label: `Muro ${w.id}`, rect: part.rect })));
  const fixed = [...furniture, ...solidWalls];
  const overlaps = furniture.flatMap((a, index) => [...furniture.slice(index + 1), ...solidWalls]
    .filter(b => intersects(a.rect, b.rect)).map(b => `${a.label} / ${b.label}`));
  const swings = leaves.map(leaf => {
    // Conservative sampled sweep. Each sample is a strip of the door thickness,
    // enlarged by the maximum tip travel between neighbouring poses.
    const steps = 45;
    const pad = leafThickness / 2 + leaf.width * Math.PI / (4 * steps);
    const hits = fixed.filter(({ rect }) => {
      for (let pose = 0; pose <= steps; pose++) {
        const tip = leafTip(leaf, pose * Math.PI / (2 * steps));
        // Begin inside the leaf to exclude the designed contact at the hinge.
        for (let along = pad; along <= leaf.width + pad; along += pad) {
          const t = Math.min(1, along / leaf.width);
          const sample = { x: leaf.hinge.x + (tip.x - leaf.hinge.x) * t,
            z: leaf.hinge.z + (tip.z - leaf.hinge.z) * t, w: pad * 2, d: pad * 2 };
          // The wall carrying this leaf includes its jamb contact by design.
          if (intersects(sample, rect) &&
            !((leaf.door === entrance.id && rect.z === walls[1].fixed) ||
              (leaf.door === techDoor.id && rect.z === technical.z && rect.d === room.wall))) return true;
        }
      }
      return false;
    }).map(item => item.label);
    return { id: leaf.id, hits };
  });

  const openLeaves = leaves.map(leaf => ({ label: leaf.id, rect: {
    x: leaf.hinge.x, z: leaf.hinge.z - leaf.width / 2, w: leafThickness, d: leaf.width,
  } }));
  const obstacles = [...fixed, ...openLeaves];
  const serviceHits = obstacles.filter(({ rect }) => intersects(service, rect)).map(item => item.label);
  const { width } = study;
  const radius = width / 2;
  const { measure, pointAt } = routeGrid(obstacles);
  const approaches: Approach[] = [...model.stations, model.admin].map(station => {
    const front = station.orientation === 0;
    const z = (front ? maxZ(station.chair) : minZ(station.chair)) + (front ? radius : -radius);
    const preferred = { x: station.chair.x, z };
    return { id: station.id, preferred, rect: { ...preferred, w: 0.38, d: 0.19 } };
  });
  const named = [
    { id: 'Cuarto técnico', rect: { x: (techDoor.start + techDoor.end) / 2, z: technical.z - 0.45, w: 0.35, d: 0.25 } },
    { id: 'Servicio del rack', rect: service },
    { id: 'Espera', rect: { x: waiting.x, z: minZ(waiting) - radius, w: waiting.w - width, d: 0.16 } },
  ].map(({ id, rect }) => ({ id, rect, preferred: { x: rect.x, z: rect.z } }));
  const passages = measurePassages(model);
  const principal = passages.find(p => p.id === 'center-aisle') ?? passages.find(p => p.id === 'left')!;
  const rear = { x: principal.rect.x, z: model.layout.rows[1] };
  const mainRoute = {
    ...measure({ id: 'Corredor principal', rect: { ...rear, w: 0.24, d: 0.28 }, preferred: rear }),
    id: 'Corredor principal', point: rear,
  };

  const targets = [...approaches, ...named].map(approach => {
    const route = measure(approach);
    return { ...route, id: approach.id, point: approach.preferred, index: route.width + 1e-8 >= width ? route.index : -1 };
  });
  return { passages, overlaps, swings, serviceHits, targets, mainRoute, pointAt };
}
