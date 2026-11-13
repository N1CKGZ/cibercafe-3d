import { batchHeader, batchMaterials, calibrationMM, layoutBatch, layoutTemplate, printMargin, printableFormats } from './cut-layout.ts';
import type { PrintFormat } from './cut-layout.ts';
import { families, glueTab } from './maquette.ts';
import type { Cut } from './maquette.ts';

const svgNS = 'http://www.w3.org/2000/svg';
const number = (value: number) => String(Number(value.toFixed(3)));

function svgElement(name: string, attrs: Record<string, string | number>) {
  const el = document.createElementNS(svgNS, name);
  for (const [attribute, value] of Object.entries(attrs)) el.setAttribute(attribute, String(value));
  return el;
}

function outline(svg: SVGElement | SVGGElement, cut: Cut, x: number, y: number) {
  const h = cut.height ?? 1.8;
  const w = cut.width;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    svg.append(svgElement('line', { x1, y1, x2, y2, class: 'fold' }));
  if (cut.tabs) {
    const t = glueTab, b = h - t, r = w - t, half = t / 2;
    const vertices = [[t,t],[t+half,0],[r-half,0],[r,t],[w,t+half],[w,b-half],[r,b],[r-half,h],[t+half,h],[t,b],[0,b-half],[0,t+half]];
    svg.append(svgElement('polygon', { points: vertices.map(([a,b]) => `${x+a},${y+b}`).join(' '), class: 'cut' }));
    line(x+t,y+t,x+r,y+t);
    line(x+r,y+t,x+r,y+b);
    line(x+r,y+b,x+t,y+b);
    line(x+t,y+b,x+t,y+t);
  } else {
    svg.append(svgElement('rect', { x, y, width: w, height: h, class: 'cut' }));
  }
  for (const offset of cut.folds ?? []) line(x, y + offset, x + w, y + offset);
}

export function renderTemplate(target: HTMLElement, cuts: Cut[], label: string, format: PrintFormat) {
  const paper = printableFormats[format];
  const result = layoutTemplate(cuts, format);
  target.replaceChildren();
  if (result.oversized.length || !result.sheets.length) {
    const problem = document.createElement('p');
    problem.textContent = 'Hay piezas que requieren una hoja mayor.';
    target.append(problem);
    return false;
  }
  const width = paper.width - 2 * printMargin;
  const height = paper.height - 2 * printMargin;
  const kinds = [...new Set(cuts.flatMap(cut => cut.kind === 'base' ? [] : [cut.kind]))];
  for (const [index, pieces] of result.sheets.entries()) {
    const page = document.createElement('section');
    page.className = 'template-page';
    const svg = svgElement('svg', { xmlns: svgNS, width: `${width}mm`, height: `${height}mm`, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label });
    const text = (x: number, y: number, content: string, className = '') => {
      const node = svgElement('text', { x, y, class: className });
      node.textContent = content;
      svg.append(node);
    };
    text(1, 6, label, 'template-title');
    text(1, 12, `1:25 · ${paper.label} · ${cuts.length} piezas por juego · Hoja ${index + 1} de ${result.sheets.length}`);
    text(1, 17, 'Imprime al 100 % sin ajustar a página. Comprueba la barra antes de cortar.');
    svg.append(svgElement('line', { x1: 2, x2: 2 + calibrationMM, y1: 23, y2: 23, class: 'cut', 'data-calibration': calibrationMM }));
    for (const x of [2, 2 + calibrationMM]) svg.append(svgElement('line', { x1: x, x2: x, y1: 21, y2: 25, class: 'cut' }));
    text(106, 24, '100 mm');
    text(1, 30, 'Línea continua · corte     Línea discontinua · doblez     Medidas en mm');
    const shortNames: Record<string, string> = {
      monitor: 'Monitor', keyboard: 'Teclado', mouse: 'Mouse', tower: 'Gabinete', desk: 'Mesa', chair: 'Silla',
    };
    for (const { x, y, piece } of pieces) {
      const cut = piece.cut;
      const row = y + 34;
      outline(svg, cut, x, row + 8);
      const part = kinds.length === 1 ? cut.name : `${shortNames[cut.kind]} · ${cut.name}`;
      text(x, row + 2, part, 'part-label');
      text(x, row + 6, cut.tabs
        ? `${number(cut.width - 2 * glueTab)} × ${number(cut.height! - 2 * glueTab)} + pestañas de ${glueTab}`
        : cut.height ? `${number(cut.width)} × ${number(cut.height)}` : `${number(cut.width)} de largo`, 'part-label');
    }
    text(1, height - 47, 'Armado', 'template-title');
    const instructions: Record<string, string> = {
      monitor: cuts.some(c => c.name === 'Soporte ancho')
        ? 'Soporte didáctico de 5.2 × 5.4 mm. Dobla los extremos y pégalo al reverso y a la base.'
        : 'Dobla los extremos del soporte de 2.2 × 5.4 mm. Pégalo al reverso y a la base.',
      keyboard: cuts.some(c => c.kind === 'mouse')
        ? 'Dibuja las teclas y marca la división de botones del mouse plano.'
        : 'Recorta la pieza y dibuja las teclas.',
      mouse: 'Marca los botones del mouse plano.',
      tower: 'Dobla pestañas de frente y reverso. Une laterales, tapa y fondo.',
      desk: 'Transfiere las cuatro longitudes a madera. Pega las patas bajo el tablero.',
      chair: 'Usa EVA para el asiento y cartulina para respaldo y soporte. Dobla los extremos del soporte.',
    };
    kinds.filter(kind => kind !== 'mouse' || !kinds.includes('keyboard'))
      .forEach((kind, i) => text(1, height - 40 + i * 6, instructions[kind] ?? families[kind].steps));
    text(1, height - 4, kinds.length > 1
      ? 'Cartulina · monitor, gabinete, teclado y respaldo. Cartón · tablero y base. Papel · pantalla. EVA · asiento.'
      : families[kinds[0]].material);
    page.append(svg);
    target.append(page);
  }
  return true;
}

export function renderBatch(target: HTMLElement, cuts: Cut[], label: string, format: PrintFormat, simplified: boolean) {
  target.replaceChildren();
  const paper = printableFormats[format];
  const width = paper.width - 2 * printMargin;
  const height = paper.height - 2 * printMargin;
  const stats: { material: string; sheets: number; count: number; net: number; unit: string }[] = [];
  for (const [id, material] of Object.entries(batchMaterials)) {
    const group = cuts.filter(cut => cut.material === id);
    if (!group.length) continue;
    const result = layoutBatch(group, format);
    if (result.oversized.length) {
      target.textContent = 'El formato no admite todas las piezas.';
      return [];
    }
    stats.push({ material, sheets: result.sheets.length, count: group.length,
      net: group.reduce((sum, cut) => sum + cut.net, 0), unit: id === 'wood' ? 'm' : 'cm²' });
    const designs = [...new Map(group.map(cut => [designKey(cut), cut])).values()];
    const codes = new Map(designs.map((cut, i) => [designKey(cut), String(i + 1).padStart(2, '0')]));
    for (const [index, pieces] of result.sheets.entries()) {
      const page = document.createElement('section');
      page.className = 'template-page';
      const svg = svgElement('svg', { width: `${width}mm`, height: `${height}mm`,
        viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${label} · ${material}` });
      const text = (x: number, y: number, content: string, className = '') => {
        const node = svgElement('text', { x, y, class: className });
        node.textContent = content;
        svg.append(node);
      };
      text(1, 6, `${label} · ${material}`, 'template-title');
      text(1, 12, `${paper.label} · 1:25 · Hoja ${index + 1}/${result.sheets.length} · ${pieces.length} piezas · Soporte ${simplified ? 'ancho didáctico' : 'original'}`);
      text(1, 17, 'Imprime al 100 % sin ajuste. Corte continuo · doblez discontinuo.');
      svg.append(svgElement('line', { x1: 2, x2: 2 + calibrationMM, y1: 23, y2: 23, class: 'cut', 'data-calibration': calibrationMM }));
      for (const x of [2, 2 + calibrationMM]) svg.append(svgElement('line', { x1: x, x2: x, y1: 21, y2: 25, class: 'cut' }));
      text(106, 24, '100 mm');
      if (id === 'wood') text(1, 29, 'Transfiere las longitudes de las patas a la madera.');
      for (const { x, y, piece } of pieces) {
        const cut = piece.cut;
        const top = y + batchHeader;
        text(x, top + 2.4, `${codes.get(designKey(cut))} · ${cut.item}`, 'part-label');
        const shape = svgElement('g', { transform: piece.turned
          ? `translate(${x + cut.height!} ${top + 4}) rotate(90)` : `translate(${x} ${top + 4})` }) as SVGGElement;
        outline(shape, cut, 0, 0);
        svg.append(shape);
      }
      text(1, height - 1, 'Código y puesto por pieza. Consulta el despiece del lote en el visor.');
      page.append(svg);
      target.append(page);
    }
  }
  return stats;
}

function designKey(cut: Cut) {
  const name = cut.name.startsWith('Pata ') ? 'Pata' : cut.name;
  return [cut.kind, name, cut.width, cut.height].join('|');
}

export function batchKey(cuts: Cut[]) {
  return Object.entries(batchMaterials).map(([id, material]) => {
    const group = cuts.filter(cut => cut.material === id);
    const designs = new Map<string, { cut: Cut; count: number }>();
    for (const cut of group) {
      const key = designKey(cut);
      const entry = designs.get(key) ?? { cut, count: 0 };
      entry.count++;
      designs.set(key, entry);
    }
    return { material, pieces: [...designs.values()].map(({ cut, count }, i) => {
      const name = cut.name.startsWith('Pata ') ? 'Pata' : cut.name;
      const dims = cut.tabs ? `${number(cut.width - 2 * glueTab)} × ${number(cut.height! - 2 * glueTab)} mm + pestañas`
        : cut.height === undefined ? `${number(cut.width)} mm` : `${number(cut.width)} × ${number(cut.height)} mm`;
      return `${String(i + 1).padStart(2, '0')} · ${families[cut.kind as keyof typeof families].name}, ${name} · ${dims} · ${count} piezas`;
    }) };
  }).filter(row => row.pieces.length);
}
