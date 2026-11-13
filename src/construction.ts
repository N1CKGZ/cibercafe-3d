import { displayBase, toMM } from './maquette.ts';
import type { Cut, Material } from './maquette.ts';
import { createModel, room } from './model.ts';
import type { Network } from './network.ts';

export const phases = [
  {
    id: 'base', title: 'Base y trazado arquitectónico',
    goal: 'Escuadrar la base y transferir las referencias de A2.',
    materials: ['baseboard', 'board'], kinds: ['base'], tools: 'Regla, escuadra, lápiz, cúter y base de corte.',
    steps: ['Traza el contorno del local centrado sobre la base.', 'Marca entrada, cuarto técnico, ejes de mesas y corredor. Presenta el piso en seco.'],
    check: 'Mide ambos lados y diagonales. Comprueba la franja libre alrededor del local.',
    care: 'Usa las huellas del visor como referencias. Marca con lápiz antes de cortar.',
  },
  {
    id: 'floor', title: 'Piso y canalizaciones Cat6',
    goal: 'Representar los 26 recorridos y dejar un registro accesible.',
    materials: ['board', 'channel', 'thread'], kinds: ['cable', 'duct'], tools: 'Regla, cúter, base de corte, tijeras y cinta de papel.',
    steps: ['Marca el registro antes de pegar el piso. Guarda el recorte para la tapa.', 'Prueba en seco las tiras y el hilo. Identifica C-01 a C-26 en ambos extremos.', 'Apoya la tapa en pestañas por debajo. Usa una muesca lateral para levantarla.'],
    check: 'La tapa debe quedar al ras y salir sin mover mesas. Comprueba el espacio para el hilo y el apoyo de las pestañas.',
    care: 'Mide el grueso real del conjunto de tiras, hilos y apoyos antes de elegir separadores. Presenta los 26 recorridos antes de pegarlos.',
  },
  {
    id: 'walls', title: 'Muros, ventanas y puertas',
    goal: 'Levantar los paños con vanos y conservar el acceso al cuarto.',
    materials: ['foam', 'acetate', 'board'], kinds: ['wall', 'window', 'door'], tools: 'Escuadra, regla metálica, cúter, base de corte, tijeras y cinta.',
    steps: ['Traza cada paño completo y sus vanos. Corta los vanos y recorta el acetato.', 'Presenta los seis muros en seco. Escuadra y pega por tramos.', 'Coloca las hojas con bisagras de cinta y verifica su giro.'],
    check: 'Comprueba que las ventanas calcen y las puertas abran sin rozar piso ni mobiliario.',
    care: 'Corta el cartón pluma en pasadas ligeras. Deja la parte superior abierta.',
  },
  {
    id: 'stations', title: 'Escritorios, sillas y computadoras',
    goal: 'Validar PC-01 en seco y fabricar los juegos cliente y administrativo por separado.',
    materials: ['board', 'cardstock', 'paper', 'eva', 'wood'], kinds: ['desk', 'counter', 'chair', 'monitor', 'keyboard', 'mouse', 'tower'],
    tools: 'Regla milimétrica, tijeras, cúter, pinzas y pegamento blanco.',
    steps: ['Imprime PC-01 al 100 % y mide la barra de 100 mm. Prueba el mouse y el soporte original o ancho.', 'Ensambla tablero, patas, silla, monitor, teclado, mouse y gabinete. Presenta el conjunto en seco sobre A2.', 'Tras probar PC-01, imprime los lotes de clientes y ADM-01. Para recepción usa el tablero del mostrador.'],
    check: 'Verifica estabilidad, ajuste de periféricos y holgura de las sillas. Confirma que el registro pueda abrirse con los muebles colocados.',
    care: 'El soporte ancho es una simplificación didáctica opcional. La validación física de PC-01 está pendiente de que la registres.',
  },
  {
    id: 'equipment', title: 'Cuarto técnico y climatización',
    goal: 'Montar las piezas del cuarto técnico y la climatización prevista.',
    materials: ['board', 'thinboard', 'cardstock'], kinds: ['rack', 'server', 'minisplit', 'condenser'],
    tools: 'Regla, tijeras, escuadra, cúter y pegamento blanco.',
    steps: ['Forma el rack con sus caras y marca las bandas del panel, switch, router y ONT. Presenta el servidor en su repisa.', 'Dobla y cierra las cajas de minisplits y condensadoras. Marca rejillas y ventiladores.', 'Presenta en seco las condensadoras y sus soportes sobre las caras exteriores indicadas.'],
    check: 'Comprueba que rack y servidor sean distinguibles, que la puerta gire y que los soportes exteriores queden dentro de la base.',
    care: 'Las medidas de climatización son orientativas. Verifica el grosor y la estabilidad de los soportes antes de pegarlos.',
  },
  {
    id: 'finish', title: 'Acabados, comprobaciones y presentación',
    goal: 'Revisar la maqueta completa y preparar la demostración.',
    materials: ['cardstock', 'paper', 'thread'], kinds: [], tools: 'Regla, marcador fino, paño y pegamento.',
    steps: ['Limpia bordes y aplica rótulos de zonas y equipos.', 'Cuenta 25 estaciones cliente y ADM-01. Sigue el hilo hasta el rack y prueba el registro.', 'Prepara una vista superior y una isométrica para explicar la distribución y la escala.'],
    check: 'Revisa la escala, los accesos, el ajuste de la tapa y el conteo de los 26 enlaces.',
    care: 'Deja secar y comprueba la fijación de las piezas antes de transportar la maqueta.',
  },
] as const satisfies readonly {
  id: string; title: string; goal: string; materials: readonly Material[]; kinds: readonly Cut['kind'][];
  tools: string; steps: readonly string[]; check: string; care: string;
}[];

export type PhaseId = typeof phases[number]['id'];
export const buildGroups = [
  ['base', 'Base y piso'], ['ducts', 'Registro, tiras y tendido de hilo'],
  ['walls', 'Muros, ventanas y puertas'], ['clients', '25 estaciones cliente'],
  ['admin', 'Mostrador y estación ADM-01'], ['equipment', 'Rack, servidor y climatización'],
] as const;

export function floorRegister(network: Network) {
  const { stations } = createModel('compactA2', 'occupied');
  const left = stations[2].desk.x + stations[2].desk.w / 2;
  const right = stations[3].desk.x - stations[3].desk.w / 2;
  const corridor = right - left;
  const from = stations[10].desk.z;
  const to = stations[15].desk.z;
  const trunk = network.ducts.find(duct => duct.from.x === network.spineX && duct.to.x === network.spineX &&
    duct.from.z === from && duct.to.z === to)!;
  const bottom = trunk.from.y - Number(trunk.section.split('×')[1]) / 2000;
  return {
    x: network.spineX, z: (from + to) / 2, w: corridor / 2, d: (to - from) / 2,
    floorMm: toMM(room.slab), ductDepthMm: toMM(-bottom),
    minimumGapMm: toMM(-bottom - room.slab),
    baseMm: displayBase.thickness * 1000, trunk: trunk.id, ductY: trunk.from.y,
  };
}

export function summarizePhase(cuts: Cut[], members: readonly Cut['kind'][]) {
  const rows = new Map<Material, { area: number; length: number; pieces: number }>();
  for (const cut of cuts) {
    if (!members.includes(cut.kind)) continue;
    const row = rows.get(cut.material) ?? { area: 0, length: 0, pieces: 0 };
    if (cut.height === undefined) row.length += cut.net;
    else row.area += cut.net;
    row.pieces++;
    rows.set(cut.material, row);
  }
  return rows;
}

export const progressKey = 'cibercafe.mq03.v1';
export const materialStates = ['Pendiente de compra', 'Pendiente de medir', 'Adquirido'] as const;
export type MaterialState = typeof materialStates[number];
export type Progress = { completed: string[]; materials: Partial<Record<Material, MaterialState>> };

export function readProgress(raw: string | null, materialIds: readonly Material[]): Progress {
  const validTasks = new Set<string>(['prototype', ...buildGroups.map(([id]) => `built:${id}`), ...phases.flatMap(p =>
    [...p.steps.map((_, i) => `${p.id}:${i}`), `${p.id}:check`])]);
  const progress: Progress = { completed: [], materials: {} };
  try {
    const stored = JSON.parse(raw ?? 'null');
    if (Array.isArray(stored?.completed)) {
      progress.completed = [...new Set(stored.completed.filter((task: string) => validTasks.has(task)))] as string[];
    }
    for (const id of materialIds) {
      const value = stored?.materials?.[id];
      if (materialStates.includes(value)) progress.materials[id] = value;
    }
  } catch { /* A corrupt entry starts with an empty checklist. */ }
  return progress;
}
