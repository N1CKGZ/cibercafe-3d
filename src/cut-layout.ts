import type { Cut, Material } from './maquette.ts';

export type Stock = { width: number; height?: number };
export const defaultStock: Record<Material, Stock> = {
  foam: { width: 500, height: 700 }, baseboard: { width: 550, height: 700 },
  board: { width: 500, height: 700 }, thinboard: { width: 210, height: 297 },
  cardstock: { width: 216, height: 279 }, acetate: { width: 216, height: 279 },
  eva: { width: 216, height: 279 }, paper: { width: 210, height: 297 },
  labels: { width: 216, height: 279 }, powerChannel: { width: 216, height: 279 },
  powerThread: { width: 10000 }, peripheralThread: { width: 10000 },
  channel: { width: 216, height: 279 }, wood: { width: 150 }, thread: { width: 10000 }, hvacCord: { width: 1000 },
};
export const sheetMargin = 5;
export const cutGap = 2;

type Size = { width: number; height: number };
type Position = Size & { x: number; y: number; rotated: boolean };
type Shelf = { y: number; height: number; nextX: number };
type Sheet<T> = { shelves: Shelf[]; pieces: (Position & { piece: T })[] };

export function packSheets<T extends Size>(pieces: T[], stock: Size, margin: number, gap: number, rotate = true,
  priority: 'longest' | 'height' = 'longest') {
  const width = stock.width - 2 * margin;
  const height = stock.height - 2 * margin;
  const sheets: Sheet<T>[] = [];
  const oversized: T[] = [];
  const eps = 1e-7;
  const ordered = [...pieces].sort((a, b) => (priority === 'height' ? b.height - a.height
    : Math.max(b.width, b.height) - Math.max(a.width, a.height)) ||
    b.width * b.height - a.width * a.height);
  for (const piece of ordered) {
    const options = [{ width: piece.width, height: piece.height, rotated: false }];
    if (rotate && piece.width !== piece.height) options.push({ width: piece.height, height: piece.width, rotated: true });
    const fits = options.filter(o => o.width <= width + eps && o.height <= height + eps);
    if (!fits.length) {
      oversized.push(piece);
      continue;
    }
    // Prefer an established shelf. New shelves use the shorter feasible orientation.
    let target: { sheet: Sheet<T>; shelf: Shelf; position: typeof fits[number] } | undefined;
    for (const sheet of sheets) {
      for (const shelf of sheet.shelves) {
        const position = fits.filter(o => shelf.nextX + o.width <= width + eps && o.height <= shelf.height + eps)
          .sort((a, b) => a.width - b.width)[0];
        if (position && !target) target = { sheet, shelf, position };
      }
      if (target) break;
    }
    if (!target) {
      const position = fits.sort((a, b) => a.height - b.height)[0];
      let sheet = sheets.find(s => {
        const last = s.shelves.at(-1)!;
        return last.y + last.height + gap + position.height <= height + eps;
      });
      if (!sheet) {
        sheet = { shelves: [], pieces: [] };
        sheets.push(sheet);
      }
      const last = sheet.shelves.at(-1);
      const shelf = { y: last ? last.y + last.height + gap : 0, height: position.height, nextX: 0 };
      sheet.shelves.push(shelf);
      target = { sheet, shelf, position };
    }
    const { sheet, shelf, position } = target;
    sheet.pieces.push({ ...position, x: shelf.nextX + margin, y: shelf.y + margin, piece });
    shelf.nextX += position.width + gap;
  }
  return { sheets: sheets.map(s => s.pieces), oversized };
}

export function planPurchase(cuts: Cut[], stock: Stock, gross: number) {
  if (stock.height !== undefined) {
    const rectangles = cuts.map(cut => ({ ...cut, height: cut.height! }));
    const result = packSheets(rectangles, { width: stock.width, height: stock.height }, sheetMargin, cutGap);
    const capacity = (stock.width - 2 * sheetMargin) * (stock.height - 2 * sheetMargin) / 100;
    return { minimum: result.sheets.length, suggested: result.oversized.length ? null
      : Math.max(result.sheets.length, Math.ceil(gross / capacity)),
      lost: result.oversized.map(c => `${c.name} · ${c.item}`), perSheet: result.sheets.map(s => s.length) };
  }
  const available: number[] = [];
  const lost: string[] = [];
  const gap = cuts[0]?.material === 'wood' ? cutGap : 0;
  for (const cut of [...cuts].sort((a, b) => b.width - a.width)) {
    if (cut.width > stock.width) {
      lost.push(cut.name);
      continue;
    }
    const i = available.findIndex(left => left >= cut.width);
    if (i < 0) available.push(stock.width - cut.width - gap);
    else available[i] -= cut.width + gap;
  }
  return { minimum: available.length, suggested: lost.length ? null
    : Math.max(available.length, Math.ceil(gross * 1000 / stock.width)), lost, perSheet: [] };
}

export const printableFormats = {
  a4: { label: 'A4', width: 210, height: 297 },
  letter: { label: 'Carta', width: 215.9, height: 279.4 },
};
export type PrintFormat = keyof typeof printableFormats;
export const calibrationMM = 100;
export const printMargin = 10;
// Space for titles, numbered instructions, legend, and calibration bar.
export const printChrome = 84;
export const printableFamilies = ['monitor', 'keyboard', 'mouse', 'tower', 'desk', 'chair'];

export const climatePrintableFamilies = ['minisplit', 'condenser'];

export function layoutTemplate(cuts: Cut[], format: PrintFormat) {
  const paper = printableFormats[format];
  const labels = cuts.map(cut => ({ cut, width: Math.max(cut.width + 4, cut.kind === 'condenser' ? 45 : cut.kind === 'minisplit' ? 49 : 32), height: (cut.height ?? 1.8) + 11 }));
  return packSheets(labels, { width: paper.width - 2 * printMargin, height: paper.height - 2 * printMargin - printChrome },
    1, 3, false);
}

export const batchMaterials: Partial<Record<Material, string>> = {
  cardstock: 'Cartulina', board: 'Cartón rígido', eva: 'Goma EVA', paper: 'Papel de pantalla', wood: 'Madera',
};
export const batchHeader = 31;
export const batchFooter = 4;

export function layoutBatch(cuts: Cut[], format: PrintFormat) {
  const { width, height } = printableFormats[format];
  const available = { width: width - 2 * printMargin, height: height - 2 * printMargin - batchHeader - batchFooter };
  // Labels stay horizontal while the cut itself can turn 90 degrees.
  const candidates = [false, true].map(turn => {
    const slots = cuts.map(cut => {
      const cutHeight = cut.height ?? 1.8;
      const turned = turn && cut.width > cutHeight && cut.width <= 21 && cut.height !== undefined;
      return { cut, turned, width: Math.max(17, turned ? cutHeight : cut.width), height: (turned ? cut.width : cutHeight) + 4 };
    });
    return (['height', 'longest'] as const).map(priority => packSheets(slots, available, 1, cutGap, false));
  }).flat();
  return candidates.sort((a, b) => a.oversized.length - b.oversized.length || a.sheets.length - b.sheets.length)[0];
}

export function stationBatch(cuts: Cut[], administration: boolean) {
  return cuts.filter(cut => (administration ? cut.item === 'ADM-01' : /^PC-\d{2}$/.test(cut.item)) &&
    (printableFamilies.includes(cut.kind) || (administration && cut.kind === 'counter')));
}
