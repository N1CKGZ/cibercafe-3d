export type Point = { x: number; z: number };
export type Rect = Point & { w: number; d: number };
export type ChairState = 'tucked' | 'occupied' | 'extended';
export type LayoutId = 'original' | 'compact' | 'compactA2' | 'spread';

export const room = { w: 10, d: 10, wall: 0.14, height: 2.6, slab: 0.12 };
export const technical = { x: 8, z: 3, rack: { x: 9.35, z: 1.7, w: 0.6, d: 0.6 }, serviceDepth: 0.75 };
export const server = { id: 'SRV-01', w: 0.127, d: 0.127, height: 0.05 };
export const rackHeight = 0.75;
export const chairStates = { tucked: 'Recogidas bajo la mesa', occupied: 'Ocupadas', extended: 'Retiradas de la mesa' };
export const study = { width: 0.60, grid: 0.025 };
export const waiting: Rect = { x: 8.3, z: 9.43, w: 1.95, d: 0.62 };
const compact = {
  label: 'A · Mobiliario compacto', note: 'Mesas de 0.50 m, filas a 1.78 m y recepción compacta hacia la izquierda.',
  rows: [0.43, 2.21, 3.99, 5.77, 7.55], deskDepth: 0.50,
  projection: { tucked: 0.30, occupied: 0.55, extended: 0.65 },
  counter: { x: 1.10, z: 9.35, w: 1.65, d: 0.65 }, adminX: 0.9,
};
export const layouts = {
  original: {
    label: 'Distribución original', note: 'Ejes de R-02 Rev. 02 y mesas de 0.60 m.',
    rows: [0.85, 2.50, 4.15, 5.80, 7.45], deskDepth: 0.60,
    projection: { tucked: 0.32, occupied: 0.60, extended: 0.75 },
    counter: { x: 2.35, z: 9.2, w: 2.1, d: 0.68 }, adminX: 2.35,
  },
  compact,
  compactA2: {
    ...compact,
    label: 'A2 · Corredor central',
    note: 'Filas de 3 + 2 puestos y mostrador 0.07 m más cerca de la fachada.',
    columns: [1.70, 2.82, 3.94, 6.24, 7.36],
    counter: { ...compact.counter, z: 9.42 },
  },
  spread: {
    label: 'B · Filas más separadas', note: 'Mesas de 0.60 m, filas a 1.86 m y recepción desplazada hacia la izquierda.',
    rows: [0.58, 2.44, 4.30, 6.16, 8.02], deskDepth: 0.60,
    projection: { tucked: 0.32, occupied: 0.60, extended: 0.75 },
    counter: { x: 1.2, z: 9.56, w: 1.75, d: 0.60 }, adminX: 0.8,
  },
} satisfies Record<LayoutId, {
  label: string; note: string; rows: number[]; deskDepth: number;
  projection: Record<ChairState, number>; counter: Rect; adminX: number; columns?: number[];
}>;
const columns = [2.10, 3.25, 4.40, 5.55, 6.70];
export const furniture = { deskWidth: 1, deskHeight: 0.75, chairWidth: 0.53 };
export type Opening = { id: string; kind: 'window' | 'door'; start: number; end: number; low: number; high: number };
export type Wall = { id: string; axis: 'x' | 'z'; fixed: number; start: number; end: number; openings: Opening[] };
const windowAt = (id: string, start: number, end: number): Opening =>
  ({ id, kind: 'window', start, end, low: 1.05, high: 2.15 });
export const entrance: Opening = { id: 'Entrada principal', kind: 'door', start: 4.35, end: 6.05, low: 0, high: 2.15 };
export const techDoor: Opening = { id: 'Puerta técnica', kind: 'door', start: 8.35, end: 9.15, low: 0, high: 2.1 };
export const walls: Wall[] = [
  { id: 'Posterior', axis: 'x', fixed: room.wall / 2, start: 0, end: room.w,
    openings: [windowAt('V1', 1.75, 3.05), windowAt('V2', 5.35, 6.7)] },
  { id: 'Frente', axis: 'x', fixed: room.d - room.wall / 2, start: 0, end: room.w,
    openings: [windowAt('V3', 1.75, 3.55), entrance] },
  { id: 'Izquierdo', axis: 'z', fixed: room.wall / 2, start: room.wall, end: room.d - room.wall,
    openings: [windowAt('V4', 1.55, 2.85), windowAt('V5', 4.25, 5.55), windowAt('V6', 7.15, 8.45)] },
  { id: 'Derecho', axis: 'z', fixed: room.w - room.wall / 2, start: room.wall, end: room.d - room.wall,
    openings: [windowAt('V7', 4.25, 5.55), windowAt('V8', 7.15, 8.45)] },
  { id: 'Cuarto lateral', axis: 'z', fixed: technical.x, start: room.wall, end: technical.z, openings: [] },
  { id: 'Cuarto frontal', axis: 'x', fixed: technical.z, start: technical.x - room.wall / 2,
    end: room.w - room.wall, openings: [techDoor] },
];
export type Leaf = { id: string; door: string; hinge: Point; width: number; direction: 1 | -1; height: number };
export const leafThickness = 0.045;
export const leaves: Leaf[] = [
  { id: 'Entrada · hoja izquierda', door: entrance.id, hinge: { x: entrance.start, z: walls[1].fixed },
    width: (entrance.end - entrance.start) / 2, direction: 1, height: entrance.high },
  { id: 'Entrada · hoja derecha', door: entrance.id, hinge: { x: entrance.end, z: walls[1].fixed },
    width: (entrance.end - entrance.start) / 2, direction: -1, height: entrance.high },
  { id: 'Puerta técnica', door: techDoor.id, hinge: { x: techDoor.start, z: technical.z },
    width: techDoor.end - techDoor.start, direction: 1, height: techDoor.high },
];

export function wallRect(wall: Wall, start: number, end: number): Rect {
  const middle = (start + end) / 2;
  const length = end - start;
  return wall.axis === 'x'
    ? { x: middle, z: wall.fixed, w: length, d: room.wall }
    : { x: wall.fixed, z: middle, w: room.wall, d: length };
}

export function wallParts(wall: Wall) {
  const parts: { rect: Rect; bottom: number; top: number; glass?: boolean }[] = [];
  let cursor = wall.start;
  for (const opening of wall.openings) {
    parts.push({ rect: wallRect(wall, cursor, opening.start), bottom: 0, top: room.height });
    parts.push({ rect: wallRect(wall, opening.start, opening.end), bottom: opening.high, top: room.height });
    if (opening.kind === 'window') {
      const rect = wallRect(wall, opening.start, opening.end);
      parts.push({ rect, bottom: 0, top: opening.low });
      parts.push({ rect, bottom: opening.low, top: opening.high, glass: true });
    }
    cursor = opening.end;
  }
  parts.push({ rect: wallRect(wall, cursor, wall.end), bottom: 0, top: room.height });
  return parts;
}

export function leafTip(leaf: Leaf, angle: number): Point {
  return { x: leaf.hinge.x + leaf.direction * leaf.width * Math.cos(angle),
    z: leaf.hinge.z - leaf.width * Math.sin(angle) };
}

export function createModel(layoutId: LayoutId, chairState: ChairState) {
  const layout = layouts[layoutId];
  const depth = layout.projection[chairState];
  const rowColumns = 'columns' in layout ? layout.columns : columns;
  const stations = layout.rows.flatMap((z, row) => rowColumns.map((x, column) => ({
    id: `PC-${String(row * columns.length + column + 1).padStart(2, '0')}`,
    row, column, orientation: 0,
    desk: { x, z, w: furniture.deskWidth, d: layout.deskDepth },
    chair: { x, z: z + (layout.deskDepth + depth) / 2, w: furniture.chairWidth, d: depth },
  })));
  const admin = {
    id: 'ADM-01', orientation: Math.PI, desk: layout.counter,
    chair: { x: layout.adminX, z: layout.counter.z - (layout.counter.d + depth) / 2, w: furniture.chairWidth, d: depth },
  };
  return { layoutId, layout, chairState, stations, admin };
}

export type Model = ReturnType<typeof createModel>;
