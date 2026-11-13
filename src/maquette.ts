import { furniture, leaves, leafThickness, rackHeight, room, server, technical, walls } from './model.ts';
import type { Model } from './model.ts';
import type { Network } from './network.ts';

export const scale = 25;
export const toMM = (meters: number) => meters * 1000 / scale;
export const displayBase = { width: 0.50, depth: 0.50, thickness: 0.005 };
export const projectedY = 0.095;
export const models = {
  monitor: { w: 0.48, h: 0.374, d: 0.13, screenH: 0.27, screenD: 0.035 },
  tower: { w: 0.17, h: 0.37, maxD: 0.34 },
  keyboard: { w: 0.33, h: 0.018, d: 0.12 },
  mouse: { w: 0.065, h: 0.025, d: 0.105 },
  desktop: { thickness: 0.055 },
  seat: { w: furniture.chairWidth * 0.82, h: 0.81, backH: 0.33, maxD: 0.40 },
};

export const hvacPieces = [
  { id: 'HVAC-01', kind: 'minisplit', x: 4.20, y: 2.23, z: 0.25, w: 0.90, h: 0.30, d: 0.22 },
  { id: 'HVAC-02', kind: 'minisplit', x: 0.25, y: 2.23, z: 4.0, w: 0.22, h: 0.30, d: 0.90 },
  { id: 'HVAC-03', kind: 'minisplit', x: 0.25, y: 2.23, z: 7.0, w: 0.20, h: 0.27, d: 0.75 },
  { id: 'CX-01', kind: 'condenser', x: 4.20, y: 0.90, z: -0.22, w: 0.85, h: 0.55, d: 0.32 },
  { id: 'CX-02', kind: 'condenser', x: -0.22, y: 0.90, z: 4.0, w: 0.32, h: 0.55, d: 0.85 },
  { id: 'CX-03', kind: 'condenser', x: -0.20, y: 0.90, z: 7.0, w: 0.30, h: 0.50, d: 0.74 },
] as const;

export const families = {
  computer: { name: 'Computadora completa', material: 'Cartulina negra, cartón rígido y papel', tools: 'Tijeras, regla, pegamento blanco', steps: 'Arma el gabinete, el monitor, el teclado y el mouse por separado. Fija los periféricos a la mesa y el gabinete debajo.', pattern: '1 monitor + 1 gabinete + 1 teclado + 1 mouse por puesto.' },
  monitor: { name: 'Monitor', material: 'Cartulina negra, papel y cartón rígido', tools: 'Tijeras, regla, pegamento blanco', steps: 'Recorta el marco frontal y el reverso. Dobla el soporte, pégalo a la base y dibuja o imprime la pantalla en papel.', pattern: '2 rectángulos de pantalla + 1 soporte plegado + 1 base de cartón + 1 inserto de papel.' },
  tower: { name: 'Gabinete de computadora', material: 'Cartulina negra', tools: 'Regla, tijeras, pegamento blanco', steps: 'Dobla las pestañas del frente y reverso hacia dentro. Pega los laterales, la tapa y el fondo a las pestañas. Dibuja los puertos en el frente.', pattern: '2 caras por cada combinación de ancho, alto y fondo.' },
  keyboard: { name: 'Teclado', material: 'Cartulina oscura', tools: 'Regla, tijeras, marcador fino', steps: 'Recorta un rectángulo y dibuja las teclas con un marcador fino.', pattern: '1 rectángulo por teclado.' },
  mouse: { name: 'Mouse', material: 'Cartulina oscura', tools: 'Regla, tijeras, marcador fino', steps: 'Recorta un rectángulo plano y dibuja la división de los botones con marcador fino.', pattern: '1 rectángulo de 2.6 × 4.2 mm por puesto, con altura omitida en la pieza plana.' },
  desk: { name: 'Escritorio', material: 'Cartón rígido y palitos de madera delgada', tools: 'Regla, cúter, base de corte y pegamento', steps: 'Recorta la cubierta. Corta cuatro patas de la misma longitud y pégalas bajo la cubierta.', pattern: '1 tablero + 4 patas por mesa.' },
  counter: { name: 'Mostrador administrativo', material: 'Cartón rígido y palitos de madera delgada', tools: 'Regla, cúter, base de corte y pegamento', steps: 'Recorta la cubierta de recepción y pégala sobre cuatro patas iguales.', pattern: '1 tablero de recepción + 4 patas.' },
  chair: { name: 'Silla', material: 'Cartulina y goma EVA', tools: 'Tijeras, regla, pegamento blanco', steps: 'Recorta el asiento de EVA. Dobla el respaldo y un soporte de cartulina. Únelos y deja secar.', pattern: '1 asiento + 1 respaldo + 1 soporte plegado.' },
  wall: { name: 'Muro', material: 'Cartón pluma', tools: 'Regla metálica, cúter y base de corte', steps: 'Traza el paño y sus vanos, corta sobre una base y escuadra con los muros vecinos.', pattern: '1 paño con vanos según el muro. Espesor a escala de 5.6 mm.' },
  window: { name: 'Ventana', material: 'Acetato transparente', tools: 'Tijeras, regla y cinta de doble cara', steps: 'Corta el acetato al tamaño del vano. Agrega pestañas si lo sujetas por detrás. El margen general contempla recortes.', pattern: '1 paño de acetato por ventana.' },
  door: { name: 'Puerta', material: 'Cartón rígido y cinta adhesiva', tools: 'Regla, cúter, base de corte y pegamento', steps: 'Recorta cada hoja y usa una tira de cinta como bisagra. Comprueba el giro antes de fijarla.', pattern: '2 hojas para la entrada y 1 para el cuarto técnico.' },
  rack: { name: 'Rack', material: 'Cartón rígido y cartulina oscura', tools: 'Regla, cúter, base de corte y pegamento', steps: 'Arma la caja con seis caras. Dibuja en el frente las bandas del panel, switch y router.', pattern: '6 caras de cartón + 4 bandas de cartulina.' },
  server: { name: 'Servidor Mac mini', material: 'Cartón y cartulina gris', tools: 'Regla, tijeras, pegamento blanco', steps: 'Recorta y apila rectángulos de cartón hasta obtener la altura. Forra la tapa con cartulina gris.', pattern: '2 capas de cartón de 1 mm + 1 tapa de cartulina.' },
  cable: { name: 'Cableado didáctico', material: 'Hilo fino azul', tools: 'Regla, tijeras y cinta adhesiva', steps: 'Corta y etiqueta el hilo de cada enlace. Sujeta los tramos al recorrido bajo piso que se quiera mostrar.', pattern: '1 hilo por enlace permanente.' },
  duct: { name: 'Canalización', material: 'Tiras de cartulina rígida', tools: 'Regla, tijeras, pegamento blanco', steps: 'Corta tiras del ancho indicado y márcalas por tramo. Representa los codos con tiras unidas en ángulo.', pattern: '1 tira por tramo físico compartido.' },
  minisplit: { name: 'Minisplit interior', material: 'Cartón delgado y papel', tools: 'Regla, tijeras, pegamento blanco', steps: 'Dobla una caja de cartón, fórrala con papel claro y dibuja la rejilla.', pattern: '6 caras de cartón por equipo. Medidas orientativas.' },
  condenser: { name: 'Condensadora exterior', material: 'Cartón delgado', tools: 'Regla, tijeras, pegamento blanco', steps: 'Forma una caja, dibuja el ventilador y pégala a una pequeña escuadra de cartón en el muro exterior.', pattern: '6 caras de cartón por equipo. Soportes por ajustar.' },
} as const;
export type ComponentKind = keyof typeof families;
export type Item = { id: string; kind: ComponentKind; dims: number[]; labels: string[]; scaled?: number[] };
export type Material = 'foam' | 'baseboard' | 'thinboard' | 'board' | 'cardstock' | 'wood' | 'acetate' | 'thread' | 'channel' | 'eva' | 'paper';
const materialLabels: Record<Material, [string, string]> = {
  foam: ['Cartón pluma', 'cm²'], baseboard: ['Cartón para base de 5 mm', 'cm²'],
  board: ['Cartón rígido', 'cm²'], thinboard: ['Cartón delgado de 1 mm', 'cm²'], cardstock: ['Cartulina', 'cm²'],
  wood: ['Palitos de madera', 'm'], acetate: ['Acetato', 'cm²'], thread: ['Hilo azul', 'm'],
  channel: ['Cartulina rígida para canaleta', 'cm²'], eva: ['Goma EVA', 'cm²'], paper: ['Papel para pantallas', 'cm²'],
};

export const wasteMargin = 0.15;
export const supportWidths = { original: 2.2, simple: 5.2 };
export const computerParts = ['monitor', 'tower', 'keyboard', 'mouse'];
export type Cut = {
  kind: ComponentKind | 'base'; item: string; material: Material; name: string;
  width: number; height?: number; net: number;
  tabs?: boolean; folds?: number[];
};

export function productionCuts(cuts: Cut[], simplified: boolean): Cut[] {
  if (!simplified) return cuts;
  return cuts.map(cut => cut.kind === 'monitor' && cut.name === 'Soporte'
    ? { ...cut, name: 'Soporte ancho', width: supportWidths.simple, net: supportWidths.simple * cut.height! / 100 }
    : cut);
}

export function buildMaquette(model: Model, network: Network) {
  const items: Item[] = [];
  const cuts: Cut[] = [];
  function item(id: string, kind: ComponentKind, dims: number[], labels = ['Ancho', 'Alto', 'Fondo'], scaled?: number[]) {
    items.push({ id, kind, dims, labels, scaled });
  }
  function rectangle(kind: Cut['kind'], id: string, material: Material, name: string,
    width: number, height: number, details: { tabs?: boolean; folds?: number[]; net?: number } = {}) {
    cuts.push({ kind, item: id, material, name, width, height, ...details,
      net: details.net ?? width * height / 100 });
  }
  function length(kind: ComponentKind, id: string, material: Material, name: string, mm: number) {
    cuts.push({ kind, item: id, material, name, width: mm, net: mm / 1000 });
  }
  function faces(kind: ComponentKind, id: string, material: Material, w: number, h: number, d: number, tabs = false) {
    for (const name of ['Frente', 'Reverso']) {
      const tab = tabs ? glueTab : 0;
      rectangle(kind, id, material, name, w + 2 * tab, h + 2 * tab, {
        tabs, net: (w * h + 2 * tab * (w + h) - 2 * tab ** 2) / 100,
      });
    }
    for (const name of ['Lateral 1', 'Lateral 2']) rectangle(kind, id, material, name, d, h);
    for (const name of ['Tapa', 'Fondo']) rectangle(kind, id, material, name, w, d);
  }
  rectangle('base', 'Base', 'baseboard', 'Base', displayBase.width * 1000, displayBase.depth * 1000);
  rectangle('base', 'Piso', 'board', 'Piso', toMM(room.w), toMM(room.d));

  for (const station of [...model.stations, model.admin]) {
    const { id, desk, chair } = station;
    const m = models.monitor;
    const t = models.tower;
    const depth = Math.min(desk.d - 0.10, t.maxD);
    const k = models.keyboard;
    const mouse = models.mouse;
    const s = models.seat;
    const seatDepth = Math.min(chair.d * 0.84, s.maxD);
    const tableKind = id === 'ADM-01' ? 'counter' : 'desk';
    item(id, 'computer', [m.w, m.h, m.d], ['Ancho del monitor', 'Alto del monitor', 'Fondo del monitor']);
    item(id, 'monitor', [m.w, m.h, m.d]);
    item(id, 'tower', [t.w, t.h, depth]);
    item(id, 'keyboard', [k.w, k.h, k.d]);
    item(id, 'mouse', [mouse.w, mouse.h, mouse.d]);
    item(id, tableKind, [desk.w, furniture.deskHeight, desk.d]);
    item(id, 'chair', [s.w, s.h, seatDepth], ['Ancho', 'Alto', 'Fondo del asiento']);
    rectangle(tableKind, id, 'board', 'Tablero', toMM(desk.w), toMM(desk.d));
    for (let leg = 1; leg <= 4; leg++) length(tableKind, id, 'wood', `Pata ${leg}`,
      toMM(furniture.deskHeight - models.desktop.thickness));
    for (const name of ['Marco', 'Reverso']) rectangle('monitor', id, 'cardstock', name, toMM(m.w), toMM(m.screenH));
    rectangle('monitor', id, 'cardstock', 'Soporte', supportWidths.original, toMM(0.135), { folds: [0.8, 4.6] });
    rectangle('monitor', id, 'board', 'Base', toMM(0.17), toMM(m.d));
    rectangle('monitor', id, 'paper', 'Pantalla', toMM(0.44), toMM(0.23));
    faces('tower', id, 'cardstock', toMM(t.w), toMM(t.h), toMM(depth), true);
    rectangle('keyboard', id, 'cardstock', 'Teclado', toMM(k.w), toMM(k.d));
    rectangle('mouse', id, 'cardstock', 'Mouse', toMM(mouse.w), toMM(mouse.d));
    rectangle('chair', id, 'eva', 'Asiento', toMM(s.w), toMM(seatDepth));
    rectangle('chair', id, 'cardstock', 'Respaldo', toMM(s.w), toMM(s.backH));
    rectangle('chair', id, 'cardstock', 'Soporte', toMM(0.13), toMM(0.52), { folds: [1.2, 19.6] });
  }
  for (const wall of walls) {
    const width = toMM(wall.end - wall.start);
    const height = toMM(room.height);
    item(wall.id, 'wall', [wall.end - wall.start, room.height, room.wall], ['Largo', 'Alto', 'Espesor']);
    const openings = wall.openings.reduce((sum, o) => sum + toMM(o.end - o.start) * toMM(o.high - o.low), 0);
    rectangle('wall', wall.id, 'foam', 'Paño completo', width, height, { net: (width * height - openings) / 100 });
    for (const o of wall.openings.filter(o => o.kind === 'window')) {
      item(o.id, 'window', [o.end - o.start, o.high - o.low], ['Ancho', 'Alto']);
      rectangle('window', o.id, 'acetate', 'Paño', toMM(o.end - o.start), toMM(o.high - o.low));
    }
  }
  for (const leaf of leaves) {
    item(leaf.id, 'door', [leaf.width, leaf.height, leafThickness]);
    rectangle('door', leaf.id, 'board', 'Hoja', toMM(leaf.width), toMM(leaf.height));
  }
  const rack = technical.rack;
  item('RACK-01', 'rack', [rack.w, rackHeight, rack.d]);
  faces('rack', 'RACK-01', 'board', toMM(rack.w), toMM(rackHeight), toMM(rack.d));
  for (let i = 0; i < 4; i++) rectangle('rack', 'RACK-01', 'cardstock', 'Banda', toMM(0.49), toMM(0.06));
  item(server.id, 'server', [server.w, server.height, server.d]);
  for (let i = 0; i < 2; i++) rectangle('server', server.id, 'thinboard', 'Capa', toMM(server.w), toMM(server.d));
  rectangle('server', server.id, 'cardstock', 'Tapa', toMM(server.w), toMM(server.d));
  for (const piece of hvacPieces) {
    item(piece.id, piece.kind, [Math.max(piece.w, piece.d), piece.h, Math.min(piece.w, piece.d)]);
    faces(piece.kind, piece.id, 'thinboard', ...[piece.w, piece.h, piece.d].map(toMM) as [number, number, number]);
  }
  for (const link of network.links) {
    const shown = link.segments.reduce((sum, segment) => sum + visibleLength(segment), 0);
    item(link.id, 'cable', [link.horizontal + link.vertical], ['Longitud sin reserva'], [toMM(shown)]);
    length('cable', link.id, 'thread', 'Hilo', toMM(shown));
  }
  for (const duct of network.ducts) {
    const [width, depth] = duct.section.split('×').map(Number);
    const shown = toMM(visibleLength(duct));
    const stripWidth = toMM(width / 1000);
    item(duct.id, 'duct', [duct.length, width / 1000, depth / 1000], ['Largo', 'Ancho', 'Alto'],
      [shown, stripWidth, toMM(depth / 1000)]);
    rectangle('duct', duct.id, 'channel', 'Tira', shown, stripWidth);
  }
  const totals = (kind?: ComponentKind, simplified = false) => Object.entries(materialLabels).flatMap(([id, [name, unit]]) => {
    const matching = productionCuts(cuts, simplified).filter(cut => cut.material === id &&
      (!kind || cut.kind === kind || (kind === 'computer' && computerParts.includes(cut.kind))));
    if (!matching.length) return [];
    const base = matching.reduce((sum, cut) => sum + (cut.height === undefined ? cut.net : cut.width * cut.height / 100), 0);
    const net = matching.reduce((sum, cut) => sum + cut.net, 0);
    const linearNet = id === 'channel' ? matching.reduce((sum, cut) => sum + cut.width / 1000, 0) : undefined;
    return [{ id: id as Material, name, unit, net, base, gross: base * (1 + wasteMargin),
      pieces: matching.length, linearNet }];
  });
  return { items, cuts, totals, counts: Object.fromEntries(Object.keys(families).map(kind =>
    [kind, items.filter(item => item.kind === kind).length])) };
}

export const glueTab = 1.5;

function visibleLength(duct: Network['ducts'][number]) {
  return duct.horizontal + Math.abs(Math.max(duct.from.y, projectedY) - Math.max(duct.to.y, projectedY));
}
