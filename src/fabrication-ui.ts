import { buildMaquette, computerParts, families, productionCuts, wasteMargin } from './maquette.ts';
import type { Cut, Item } from './maquette.ts';
import { cutGap, defaultStock, planPurchase, printableFamilies, printableFormats, sheetMargin, stationBatch } from './cut-layout.ts';
import type { PrintFormat } from './cut-layout.ts';
import { batchKey, renderBatch, renderTemplate } from './maquette-print.ts';

const fmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const qty = (n: number, unit: string) => `${fmt.format(n)} ${unit}`;

function download(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fabricationUI(catalog: ReturnType<typeof buildMaquette>) {
  const purchase = document.getElementById('purchase-dialog') as HTMLDialogElement;
  const template = document.getElementById('template-dialog') as HTMLDialogElement;
  const preview = document.getElementById('print-pages')!;
  const format = document.getElementById('template-format') as HTMLSelectElement;
  const print = document.getElementById('template-print') as HTMLButtonElement;
  const support = document.getElementById('monitor-support') as HTMLSelectElement;
  const scope = document.getElementById('production-scope') as HTMLSelectElement;
  const summary = document.getElementById('batch-summary')!;
  const printStyle = document.createElement('style');
  document.head.append(printStyle);
  let activeCuts: Cut[] = [];
  let activeLabel = '';
  let batch = false;
  const purchaseRows = catalog.totals().map(row => ({
    ...row, cuts: catalog.cuts.filter(cut => cut.material === row.id),
    stock: { ...defaultStock[row.id] }, price: null as number | null, valid: true,
  }));

  function pricing(row: typeof purchaseRows[number]) {
    const cuts = productionCuts(row.cuts, support.value === 'simple');
    const net = cuts.reduce((sum, cut) => sum + cut.net, 0);
    const gross = cuts.reduce((sum, cut) => sum + (cut.height === undefined ? cut.net : cut.width * cut.height / 100), 0)
      * (1 + wasteMargin);
    const result = row.valid ? planPurchase(cuts, row.stock, gross) : null;
    const quantity = result?.suggested ?? null;
    return { result, quantity, net, gross, amount: row.price === null || quantity === null ? null : row.price * quantity };
  }

  const tbody = purchase.querySelector('tbody')!;
  const refreshers = purchaseRows.map(row => {
    const tr = tbody.insertRow();
    tr.insertCell().textContent = row.name;
    const materialAmount = tr.insertCell();
    const stock = tr.insertCell();
    const suggested = tr.insertCell();
    const price = tr.insertCell();
    const amount = tr.insertCell();
    function numeric(label: string, value: number | string, min: number, max: number, step: string) {
      const control = document.createElement('input');
      control.type = 'number';
      control.value = String(value);
      control.min = String(min);
      control.max = String(max);
      control.step = step;
      control.setAttribute('aria-label', `${label} · ${row.name}`);
      return control;
    }
    const width = numeric(row.stock.height === undefined ? 'Largo de unidad (mm)' : 'Ancho de hoja (mm)', row.stock.width, 1, 1000000, 'any');
    const height = row.stock.height === undefined ? null : numeric('Alto de hoja (mm)', row.stock.height, 1, 1000000, 'any');
    const unit = document.createElement('span');
    unit.textContent = height ? ' mm por hoja' : row.id === 'thread' ? ' mm por rollo' : ' mm por palito';
    stock.append(width);
    if (height) stock.append(' × ', height);
    stock.append(unit);
    const cost = numeric('Precio unitario MXN', '', 0, 1000000000, '0.01');
    cost.placeholder = 'Sin cotizar';
    price.append(cost);
    for (const field of [width, height, cost]) field?.addEventListener('input', () => {
      row.valid = width.value !== '' && width.validity.valid &&
        (!height || (height.value !== '' && height.validity.valid));
      row.stock.width = width.valueAsNumber;
      if (height) row.stock.height = height.valueAsNumber;
      row.price = cost.value !== '' && cost.validity.valid ? cost.valueAsNumber : null;
      update();
    });
    return () => {
      const { result, quantity, net, gross, amount: subtotal } = pricing(row);
      materialAmount.textContent = `${qty(net, row.unit)} netos · ${qty(gross, row.unit)} de referencia`;
      suggested.replaceChildren();
      if (!result || quantity === null) {
        suggested.textContent = 'Cambia la presentación';
        if (result?.lost.length) {
          const problem = document.createElement('small');
          problem.textContent = `Fuera de formato: ${result.lost.length} · ${result.lost[0]}`;
          suggested.append(problem);
        }
      } else {
        suggested.textContent = `${quantity} ${height ? 'hojas' : row.id === 'thread' ? 'rollos' : 'palitos'}`;
        const detail = document.createElement('small');
        detail.textContent = height
          ? `${result.minimum} hojas para las piezas. Piezas por hoja: ${result.perSheet.join(', ')}.`
          : `${result.minimum} unidades para los cortes.`;
        suggested.append(detail);
      }
      amount.textContent = subtotal === null ? '—' : money.format(subtotal);
    };
  });

  function update() {
    refreshers.forEach(refresh => refresh());
    const amounts = purchaseRows.map(row => pricing(row).amount);
    const subtotal = amounts.reduce<number>((sum, n) => sum + (n ?? 0), 0);
    const missing = amounts.filter(n => n === null).length;
    document.getElementById('purchase-total')!.textContent = missing
      ? `Subtotal cotizado ${money.format(subtotal)} · ${missing} materiales pendientes`
      : `Total maqueta ${money.format(subtotal)} MXN`;
  }

  document.getElementById('purchase-open')!.addEventListener('click', () => {
    document.getElementById('purchase-spacing')!.textContent =
      `Borde de ${sheetMargin} mm y separación de ${cutGap} mm entre cortes. Soporte del monitor ${support.value === 'simple' ? 'ancho didáctico' : 'original'}.`;
    update();
    purchase.showModal();
  });
  document.getElementById('purchase-csv')!.addEventListener('click', () => {
    const csvCell = (value: string | number | null) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const records = [['Material', 'Neto', 'Unidad neta', 'Referencia con margen', 'Presentación mm', 'Cantidad sugerida', 'Unidad compra', 'Precio unitario MXN', 'Importe MXN'],
      ...purchaseRows.map(row => {
        const { quantity, net, gross, amount } = pricing(row);
        const presentation = row.valid ? row.stock.height === undefined ? row.stock.width : `${row.stock.width} × ${row.stock.height}` : '';
        return [row.name, net.toFixed(4), row.unit, gross.toFixed(4), presentation, quantity,
          row.stock.height !== undefined ? 'hoja' : row.id === 'thread' ? 'rollo' : 'palito', row.price, amount?.toFixed(2) ?? null];
      })];
    download('lista-compra-maqueta.csv', 'text/csv;charset=utf-8', '\uFEFF' + records.map(row => row.map(csvCell).join(',')).join('\r\n'));
  });
  document.getElementById('purchase-summary')!.addEventListener('click', () => {
    const counts = Object.entries(catalog.counts).map(([kind, count]) => `${families[kind as keyof typeof families].name}: ${count}`);
    const quantities = purchaseRows.map(row => {
      const { quantity, net, gross } = pricing(row);
      return `${row.name}: ${qty(net, row.unit)} netos; ${qty(gross, row.unit)} de referencia; ${quantity ?? 'sin formato válido'} unidades de compra.`;
    });
    download('resumen-cantidades-maqueta.txt', 'text/plain;charset=utf-8', ['Maqueta A2 · 1:25', ...counts, '', ...quantities].join('\n'));
  });
  document.getElementById('station-template')!.addEventListener('click', () => {
    openTemplate('Estación cliente · PC-01', catalog.cuts.filter(c => c.item === 'PC-01' && printableFamilies.includes(c.kind)));
  });
  document.getElementById('production-template')!.addEventListener('click', () => openTemplate('', [], true));
  for (const control of [format, scope, support]) control.addEventListener('change', refreshTemplate);
  print.addEventListener('click', () => window.print());

  function refreshTemplate() {
    const selected = format.value as PrintFormat;
    const paper = printableFormats[selected];
    const { width, height } = paper;
    printStyle.textContent = `@page { size: ${width}mm ${height}mm; margin: 10mm; }`;
    const simplified = support.value === 'simple';
    if (!batch) {
      print.disabled = !renderTemplate(preview, productionCuts(activeCuts, simplified), activeLabel, selected);
      return;
    }
    const admin = scope.value === 'admin';
    const cuts = productionCuts(stationBatch(catalog.cuts, admin), simplified);
    const stats = renderBatch(preview, cuts, admin ? 'Administración · ADM-01' : 'Producción · 25 puestos cliente',
      selected, simplified);
    const materials = document.getElementById('batch-materials')!;
    materials.replaceChildren();
    const total = document.createElement('p');
    total.textContent = `${stats.reduce((sum, row) => sum + row.sheets, 0)} hojas · ${cuts.length} piezas en el lote`;
    materials.append(total);
    for (const row of stats) {
      const line = document.createElement('p');
      line.textContent = `${row.material} · ${row.sheets} hoja(s) · ${row.count} piezas · ${qty(row.net, row.unit)} netos`;
      materials.append(line);
    }
    for (const row of batchKey(cuts)) {
      const details = document.createElement('details');
      const label = document.createElement('summary');
      label.textContent = `Códigos · ${row.material}`;
      const list = document.createElement('ul');
      for (const entry of row.pieces) {
        const li = document.createElement('li');
        li.textContent = entry;
        list.append(li);
      }
      details.append(label, list);
      materials.append(details);
    }
    print.disabled = !stats.length;
  }

  function openTemplate(label: string, cuts: Cut[], production = false) {
    activeCuts = cuts;
    activeLabel = label;
    batch = production;
    summary.hidden = !batch;
    document.getElementById('production-group')!.hidden = !batch;
    document.getElementById('support-group')!.hidden = !batch && !cuts.some(cut => cut.kind === 'monitor');
    refreshTemplate();
    template.showModal();
  }

  function guide(item: Item) {
    const family = families[item.kind];
    const cuts = productionCuts(catalog.cuts.filter(c => c.item === item.id && (item.kind === 'computer'
      ? computerParts.includes(c.kind) : c.kind === item.kind)), support.value === 'simple');
    const parts = cuts.map(c => `- ${c.name} · ${qty(c.width, 'mm')}${c.height === undefined ? '' : ` × ${qty(c.height, 'mm')}`}${c.tabs ? ' con pestañas' : ''}`);
    download(`guia-${item.kind}-${item.id}.txt`, 'text/plain;charset=utf-8',
      [`${family.name} · ${item.id} · 1:25`, '', family.material, family.tools, family.steps, family.pattern,
        ...(cuts.some(c => c.name === 'Soporte ancho') ? ['Soporte didáctico de 5.2 × 5.4 mm. Sustituye al original de 2.2 × 5.4 mm.'] : []),
        '', ...parts].join('\n'));
  }

  return {
    guide,
    template: (item: Item) => openTemplate(`${families[item.kind].name} · ${item.id}`,
      catalog.cuts.filter(c => c.kind === item.kind && c.item === item.id)),
  };
}
