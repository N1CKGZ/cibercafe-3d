import { condenserMount, climatePairs, climatePipeLengths, climateUnits } from './climate.ts';
import { furniture, leaves, leafThickness, rackHeight, room, server, technical, walls } from './model.ts';
import type { Model } from './model.ts';
import type { Network } from './network.ts';

import { buildInfrastructure, chamberParts, floorLayers, panel, pathLength, powerDuctSize, rackOutlet, serviceBoxSize, serviceSymbol, ups } from './infrastructure.ts';

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
  chamber: { name: 'Cámara técnica', material: 'Cartón rígido', tools: 'Regla, escuadra, cúter y base de corte', steps: 'Corta y apila los apoyos hasta 12 mm. Presenta el piso en seco y verifica que la tapa lateral se levante desde el borde de la base.', pattern: 'Dos juegos de costillas perimetrales segmentadas y seis apoyos interiores. Ajustar espesor, rigidez y uniones al prototipo.' },
  access: { name: 'Tapa lateral extraíble', material: 'Cartón rígido', tools: 'Regla, cúter, pinzas y pegamento', steps: 'Construye la tapa con una lengüeta de papel y sujétala con guías de cartón. Ensaya la extracción hacia el margen de la base.', pattern: '1 tapa rectangular. Guías y lengüeta con sobrantes, tras prueba en seco.' },
  inspection: { name: 'Ventana de inspección', material: 'Acetato', tools: 'Regla, tijeras y cinta de doble cara', steps: 'Corta el visor y fíjalo por detrás del marco. Conserva libre la extracción de la tapa lateral.', pattern: '1 paño de acetato. Ajusta solapes con sobrantes.' },
  panel: { name: 'Tablero eléctrico principal', material: 'Cartón delgado y papel', tools: 'Regla, tijeras, marcador y pegamento', steps: 'Arma la caja gris, marca el contorno de la puerta y pega un rótulo con CE-01 a CE-08. El alumbrado queda identificado como previsto.', pattern: '6 caras y 1 rótulo.' },
  serviceBox: { name: 'Caja de servicio', material: 'Cartón delgado y cartulina', tools: 'Regla milimétrica, tijeras, pegamento y pinzas', steps: 'Forma la caja y fíjala bajo el tablero con una tira de cartón. Añade los símbolos de la toma eléctrica y del RJ45 en la misma placa.', pattern: '6 caras, 1 soporte, 1 placa con ID y dos símbolos separados.' },
  socket: { name: 'Tomacorriente miniatura', material: 'Cartulina blanca', tools: 'Marcador fino, tijeras y pinzas', steps: 'Dibuja dos pares de ranuras en un solo recorte. Pega el símbolo plano sobre la placa de servicio.', pattern: '1 símbolo dúplex por placa o toma dedicada.' },
  jack: { name: 'Puerto RJ45 miniatura', material: 'Cartulina blanca marcada en azul', tools: 'Marcador fino, tijeras y pinzas', steps: 'Marca una ventana rectangular en azul y pega el recorte junto a la toma dúplex. Usa el mismo TR del enlace existente.', pattern: '1 símbolo RJ45 por placa.' },
  powerDuct: { name: 'Canalización eléctrica decorativa', material: 'Cartulina rígida naranja', tools: 'Regla, tijeras y pegamento', steps: 'Traza las tiras y marca qué circuitos representa cada tramo. Cruza el Cat6 por el nivel inferior. Usa sobrantes para uniones y guías.', pattern: '1 tira por tramo compartido, con pequeños elevadores ajustados en seco.' },
  powerWire: { name: 'Hilo eléctrico decorativo', material: 'Hilo negro o gris oscuro', tools: 'Regla, tijeras y adhesivo', steps: 'Corta un hilo por recorrido mostrado y fija los puentes sin tensar. Rotula el circuito en las derivaciones.', pattern: '1 hilo por tendido y cordones cortos para gabinete, monitor y respaldo.' },
  dataLead: { name: 'Latiguillo azul de estación', material: 'Hilo fino azul', tools: 'Regla, tijeras y adhesivo', steps: 'Fija un hilo azul entre gabinete y placa. Une el final de la subida Cat6 a la representación RJ45.', pattern: '1 latiguillo y 1 remate de subida por puesto.' },
  rackPatch: { name: 'Latiguillo de rack', material: 'Hilo fino azul', tools: 'Regla, tijeras y adhesivo', steps: 'Representa el puente frontal entre el patch panel y el switch con hilo azul. Usa un trazo dibujado si un hilo individual resulta demasiado grueso.', pattern: '1 puente por enlace permanente. Verificar legibilidad a escala.' },
  peripheral: { name: 'Conexiones cortas de estación', material: 'Hilo gris claro', tools: 'Regla, tijeras, pinzas y adhesivo', steps: 'Fija las líneas cortas de teclado y mouse por la parte posterior. Reserva el hilo oscuro para el monitor y la alimentación.', pattern: '2 líneas cortas por puesto.' },
  ups: { name: 'Respaldo UPS decorativo', material: 'Cartón delgado y cartulina', tools: 'Regla, tijeras y pegamento', steps: 'Arma una caja gris, dibuja su indicador y pega la identificación. Representa el tendido desde la toma dedicada hacia los equipos del cuarto.', pattern: '6 caras y 1 rótulo.' },
  minisplit: { name: 'Minisplit interior', material: 'Cartón delgado y papel blanco y gris', tools: 'Regla, tijeras, marcador y pegamento blanco', steps: 'Dobla la banda de cartón, cierra sus tapas y pega el frente impreso. Apoya el cuerpo contra el muro. La ranura va impresa sobre el frente.', pattern: '1 banda, 2 tapas y 1 frente impreso. Medidas provisionales.' },
  condenser: { name: 'Condensadora exterior', material: 'Cartón delgado de 1 mm, papel blanco y cordón flexible', tools: 'Regla, tijeras, marcador y pegamento blanco', steps: 'Dobla la caja, cierra sus tapas y pega el frente impreso. Marca dos tiras de cartón delgado y dóblalas a 90°. Pega las caras largas al muro y apoya la caja en los brazos a la misma altura. Une el par al minisplit con cordón.', pattern: '1 banda, 2 tapas, 1 frente impreso, 2 ménsulas y 2 cordones. Medidas provisionales.' },
} as const;
export type ComponentKind = keyof typeof families;
export type Item = { id: string; kind: ComponentKind; dims: number[]; labels: string[]; scaled?: number[]; detail?: string };
export type Material = 'foam' | 'baseboard' | 'thinboard' | 'board' | 'cardstock' | 'wood' | 'acetate' | 'thread' | 'channel' | 'eva' | 'paper' | 'powerThread' | 'peripheralThread' | 'powerChannel' | 'labels' | 'hvacCord';
export const isThread = (id: Material) => ['thread', 'powerThread', 'peripheralThread', 'hvacCord'].includes(id);
const materialLabels: Record<Material, [string, string]> = {
  foam: ['Cartón pluma', 'cm²'], baseboard: ['Cartón para base de 5 mm', 'cm²'],
  board: ['Cartón rígido', 'cm²'], thinboard: ['Cartón delgado de 1 mm', 'cm²'], cardstock: ['Cartulina', 'cm²'],
  wood: ['Palitos de madera', 'm'], acetate: ['Acetato', 'cm²'], thread: ['Hilo azul', 'm'],
  labels: ['Cartulina blanca para placas y símbolos', 'cm²'],
  powerThread: ['Hilo negro/gris oscuro de electricidad', 'm'], peripheralThread: ['Hilo gris claro de conexiones cortas', 'm'],
  powerChannel: ['Cartulina rígida naranja para canaleta eléctrica', 'cm²'],
  channel: ['Cartulina rígida para canaleta de datos', 'cm²'], eva: ['Goma EVA', 'cm²'], paper: ['Papel para frentes, pantallas y rótulos', 'cm²'], hvacCord: ['Cordón fino para tuberías decorativas', 'm'],
};

export const wasteMargin = 0.15;
export const supportWidths = { original: 2.2, simple: 5.2 };
export const computerParts = ['monitor', 'tower', 'keyboard', 'mouse'];
export type Cut = {
  kind: ComponentKind | 'base'; item: string; material: Material; name: string;
  width: number; height?: number; net: number;
  tabs?: boolean; folds?: number[]; artwork?: 'air-outlet' | 'fan';
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
  function item(id: string, kind: ComponentKind, dims: number[], labels = ['Ancho', 'Alto', 'Fondo'], scaled?: number[], detail?: string) {
    items.push({ id, kind, dims, labels, scaled, detail });
  }
  function rectangle(kind: Cut['kind'], id: string, material: Material, name: string,
    width: number, height: number, details: { tabs?: boolean; folds?: number[]; net?: number; artwork?: Cut['artwork'] } = {}) {
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
  for (const pair of climatePairs) {
    const { indoor, outdoor } = climateUnits(pair);
    for (const unit of [indoor, outdoor]) {
      const { kind, id } = unit;
      const [w, h, d] = [unit.w, unit.h, unit.d].map(toMM);
      const exterior = kind === 'condenser';
      item(id, kind, [unit.w, unit.h, unit.d], undefined, undefined,
        `${indoor.id} ↔ ${outdoor.id} · ${pair.capacity.toLocaleString('en-US')} BTU/h nominales de referencia · muro ${pair.wall.toLowerCase()} · dimensiones provisionales.`);
      const folds = [h, h + d, 2 * h + d, 2 * (h + d)];
      rectangle(kind, id, 'thinboard', 'Banda de caja', w, folds[3] + glueTab, { folds });
      for (const name of ['Tapa lateral 1', 'Tapa lateral 2']) {
        rectangle(kind, id, 'thinboard', name, d + 2 * glueTab, h + 2 * glueTab, {
          tabs: true, net: (d * h + 2 * glueTab * (d + h) - 2 * glueTab ** 2) / 100,
        });
      }
      rectangle(kind, id, 'paper', exterior ? 'Frente y ventilador' : 'Frente y salida de aire', w, h,
        { artwork: exterior ? 'fan' : 'air-outlet' });
      if (exterior) {
        const mount = condenserMount(outdoor);
        const drop = toMM(mount.wallLeg);
        for (const name of ['Ménsula 1', 'Ménsula 2']) {
          rectangle(kind, id, 'thinboard', name, toMM(mount.width),
            drop + toMM(mount.arm), { folds: [drop] });
        }
        for (const [i, span] of climatePipeLengths(pair).entries())
          length(kind, id, 'hvacCord', `Tubería ${i + 1}`, toMM(span));
      }
    }
  }
  for (const link of network.links) {
    const shown = link.horizontal + link.vertical;
    item(link.id, 'cable', [link.horizontal + link.vertical], ['Longitud sin reserva'], [toMM(shown)]);
    length('cable', link.id, 'thread', 'Hilo', toMM(shown));
  }
  for (const duct of network.ducts) {
    const [width, depth] = duct.section.split('×').map(Number);
    const shown = toMM(duct.length);
    const stripWidth = toMM(width / 1000);
    item(duct.id, 'duct', [duct.length, width / 1000, depth / 1000], ['Largo', 'Ancho', 'Alto'],
      [shown, stripWidth, toMM(depth / 1000)], duct.cables.join(', '));
    rectangle('duct', duct.id, 'channel', 'Tira', shown, stripWidth);
  }
  const infrastructure = buildInfrastructure(model, network);
  const chamber = chamberParts();
  item('PT-01', 'chamber', [room.w, floorLayers.gap, room.d], undefined, undefined,
    'Base de 500 × 500 mm, cámara libre de 12 mm y piso superior de 400 × 400 mm.');
  for (const [index, rail] of chamber.supports.entries()) {
    const span = Math.max(rail.w, rail.d);
    for (let ply = 1; ply <= 2; ply++) rectangle('chamber', 'PT-01', 'board', `Apoyo ${index + 1} · cara ${ply}`, toMM(span), toMM(floorLayers.gap));
  }
  item('TL-01', 'access', [chamber.cover.d, floorLayers.gap, chamber.cover.w], ['Largo', 'Alto', 'Espesor']);
  rectangle('access', 'TL-01', 'board', 'Tapa lateral', toMM(chamber.cover.d), toMM(floorLayers.gap));
  item('VI-01', 'inspection', [chamber.window.w, floorLayers.gap], ['Ancho', 'Alto']);
  rectangle('inspection', 'VI-01', 'acetate', 'Ventana inferior', toMM(chamber.window.w), toMM(floorLayers.gap));

  for (const [part, kind, detail] of [[panel, 'panel', 'E-01/E-02 · CE-01 a CE-07 representados bajo piso. CE-08 identifica alumbrado previsto. Esquema académico sin corriente.'],
    [ups, 'ups', 'CE-07 → PE-UPS → UPS-01 → SW-01, RTR-01, ONT-01 y SRV-01. El patch panel PP-01 es pasivo.']] as const) {
    item(part.id, kind, [part.w, part.h, part.d], undefined, undefined, detail);
    faces(kind, part.id, 'thinboard', toMM(part.w), toMM(part.h), toMM(part.d));
    rectangle(kind, part.id, 'paper', 'Rótulo', toMM(part.w * 0.8), toMM(part.h * 0.3));
  }
  item(rackOutlet.id, 'socket', [serviceSymbol.w, serviceSymbol.h], ['Ancho', 'Alto'], undefined, 'CE-07 → toma dedicada de representación → UPS-01.');
  rectangle('socket', rackOutlet.id, 'labels', 'Símbolo de toma dedicada', toMM(serviceSymbol.w), toMM(serviceSymbol.h));
  for (const station of infrastructure.services) {
    const { link, labels } = station;
    const detail = `${station.id} · ${station.circuit} · ${labels.power} · ${link.outlet} → ${link.id} → ${link.panelPort} → ${link.switchPort}`;
    item(labels.box, 'serviceBox', [serviceBoxSize.w, serviceBoxSize.h, serviceBoxSize.d], undefined, undefined, detail);
    faces('serviceBox', labels.box, 'thinboard', toMM(serviceBoxSize.w), toMM(serviceBoxSize.h), toMM(serviceBoxSize.d));
    rectangle('serviceBox', labels.box, 'thinboard', 'Soporte bajo el tablero', toMM(station.bracket.w), toMM(station.bracket.h));
    rectangle('serviceBox', labels.box, 'labels', 'Placa con ID', toMM(serviceBoxSize.w), toMM(serviceBoxSize.h));
    for (const [kind, id] of [['socket', labels.power], ['jack', labels.jack]] as const) {
      item(id, kind, [serviceSymbol.w, serviceSymbol.h], ['Ancho', 'Alto'], undefined, detail);
      rectangle(kind, id, 'labels', 'Símbolo', toMM(serviceSymbol.w), toMM(serviceSymbol.h));
    }
    const { ethernet, jackTail, power, monitor, keyboard, mouse } = station.leads;
    for (const [kind, material, lines] of [
      ['dataLead', 'thread', [['Gabinete a RJ45', ethernet], ['Remate RJ45', jackTail]]],
      ['powerWire', 'powerThread', [['Gabinete a toma', power], ['Monitor a gabinete', monitor]]],
      ['peripheral', 'peripheralThread', [['Teclado', keyboard], ['Mouse', mouse]]],
    ] as const) {
      item(station.id, kind, [lines.reduce((sum, [, points]) => sum + pathLength(points), 0)], ['Longitud'], undefined, detail);
      for (const [name, points] of lines) length(kind, station.id, material, name, toMM(pathLength(points)));
    }
  }
  for (const duct of infrastructure.ducts) {
    const span = pathLength([duct.from, duct.to]);
    item(duct.id, 'powerDuct', [span, powerDuctSize.w, powerDuctSize.h],
      ['Largo', 'Ancho', 'Alto útil de representación'], undefined, duct.circuits.join(', '));
    rectangle('powerDuct', duct.id, 'powerChannel', 'Tira naranja', toMM(span), toMM(powerDuctSize.w));
  }
  for (const circuit of infrastructure.circuits) {
    item(circuit.id, 'powerWire', [circuit.runs.reduce((sum, points) => sum + pathLength(points), 0)],
      ['Longitud'], undefined, circuit.loads.join(', '));
    rectangle('powerWire', circuit.id, 'labels', 'Etiqueta de circuito', 12, 4);
    for (const points of circuit.runs) length('powerWire', circuit.id, 'powerThread', 'Tendido de circuito', toMM(pathLength(points)));
  }
  item('UPS-01', 'powerWire', [pathLength(infrastructure.rackLeads) +
    infrastructure.backup.reduce((sum, lead) => sum + pathLength(lead.points), 0)], ['Longitud'],
    undefined, 'Alimentación decorativa del UPS, switch, router, ONT y servidor.');
  length('powerWire', 'UPS-01', 'powerThread', 'Entrada UPS', toMM(pathLength(infrastructure.rackLeads)));
  for (const lead of infrastructure.backup) length('powerWire', 'UPS-01', 'powerThread', lead.id, toMM(pathLength(lead.points)));
  for (const patch of infrastructure.patches) {
    const link = network.links.find(link => link.id === patch.id)!;
    const span = pathLength(patch.points);
    item(patch.id, 'rackPatch', [span], ['Longitud'], undefined, `${link.outlet} → ${link.id} → ${link.panelPort} → ${link.switchPort}`);
    length('rackPatch', patch.id, 'thread', 'Puente de rack', toMM(span));
  }
  const totals = (kind?: ComponentKind, simplified = false, itemId?: string) => Object.entries(materialLabels).flatMap(([id, [name, unit]]) => {
    const matching = productionCuts(cuts, simplified).filter(cut => cut.material === id && (!itemId || cut.item === itemId) &&
      (!kind || cut.kind === kind || (kind === 'computer' && computerParts.includes(cut.kind))));
    if (!matching.length) return [];
    const base = matching.reduce((sum, cut) => sum + (cut.height === undefined ? cut.net : cut.width * cut.height / 100), 0);
    const net = matching.reduce((sum, cut) => sum + cut.net, 0);
    const linearNet = id === 'channel' || id === 'powerChannel' ? matching.reduce((sum, cut) => sum + cut.width / 1000, 0) : undefined;
    return [{ id: id as Material, name, unit, net, base, gross: base * (1 + wasteMargin),
      pieces: matching.length, linearNet }];
  });
  return { items, cuts, totals, counts: Object.fromEntries(Object.keys(families).map(kind =>
    [kind, items.filter(item => item.kind === kind).length])) };
}

export const glueTab = 1.5;
