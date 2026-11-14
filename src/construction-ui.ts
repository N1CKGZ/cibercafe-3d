import { chamberParts, floorLayers } from './infrastructure.ts';
import { buildGroups, floorRegister, materialStates, phases, progressKey, readProgress, summarizePhase } from './construction.ts';
import type { MaterialState, PhaseId } from './construction.ts';
import { displayBase, families, productionCuts, scale, toMM } from './maquette.ts';
import type { buildMaquette, ComponentKind } from './maquette.ts';
import type { Network } from './network.ts';
import { room, study } from './model.ts';
import { calibrationMM } from './cut-layout.ts';

const fmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const mm = (n: number) => fmt.format(n);
const dimensions = (...values: number[]) =>
  `${values.map(mm).join(' × ')} mm (${values.map(n => mm(n / 10)).join(' × ')} cm)`;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, content = '') {
  const node = document.createElement(tag);
  node.textContent = content;
  return node;
}

export function constructionGuide(catalog: ReturnType<typeof buildMaquette>, network: Network,
  onPhase: (phase: PhaseId | null, open: boolean) => void,
  onComponent: (kind: ComponentKind, id: string) => void) {
  const panel = document.getElementById('construction-guide')!;
  const toggle = document.getElementById('construction-toggle')!;
  const source = document.getElementById('maquette-catalog')!;
  const totals = catalog.totals();
  const materialIds = totals.map(row => row.id);
  const register = floorRegister(network);
  const chamber = chamberParts();
  let saved: string | null = null;
  try { saved = localStorage.getItem(progressKey); } catch { /* Storage can be disabled. */ }
  let progress = readProgress(saved, materialIds);
  let index = 0;
  let open = false;
  let hatchOpen = false;

  function save() {
    try { localStorage.setItem(progressKey, JSON.stringify(progress)); } catch { /* Keep progress in the current session. */ }
  }
  function task(id: string, text: string, prototype = false) {
    const label = element('label');
    const input = element('input');
    input.type = 'checkbox';
    input.checked = progress.completed.includes(id);
    input.dataset.task = id;
    const caption = element('span', text);
    input.addEventListener('change', () => {
      progress.completed = input.checked ? [...progress.completed, id] : progress.completed.filter(key => key !== id);
      if (prototype && !input.checked) progress.completed = progress.completed.filter(key => key !== 'stations:check');
      save();
      render();
      panel.querySelector<HTMLInputElement>(`[data-task="${id}"]`)?.focus();
    });
    label.className = 'guide-task';
    label.append(input, caption);
    return label;
  }

  const prep = element('details');
  prep.append(element('summary', 'Lista de preparación'));
  function renderPreparation() {
    prep.replaceChildren(element('summary', 'Lista de preparación'));
    const supplies = element('div');
    for (const row of totals) {
      const label = element('label', row.name);
      const select = element('select');
      for (const state of materialStates) select.append(new Option(state, state));
      select.value = progress.materials[row.id] ?? materialStates[0];
      select.addEventListener('change', () => {
        progress.materials[row.id] = select.value as MaterialState;
        save();
      });
      label.append(select);
      supplies.append(label);
    }
    prep.append(supplies);
    prep.append(task('prototype', 'PC-01 armado y probado físicamente con la barra de 100 mm', true));
    prep.append(element('h4', 'Piezas construidas y por fabricar'));
    for (const [id, name] of buildGroups) {
      const taskId = `built:${id}`;
      prep.append(task(taskId, `${name} · ${progress.completed.includes(taskId) ? 'Construido' : 'Por fabricar'}`));
    }
    const buttons = element('div');
    buttons.className = 'network-actions';
    const exportButton = element('button', 'Exportar progreso');
    exportButton.type = 'button';
    exportButton.addEventListener('click', () => {
      const output = new Blob([JSON.stringify({
        project: 'CIBERCAFE-3D', stage: 'MQ-03', scale, ...progress,
        preparation: Object.fromEntries(totals.map(row => [row.name, progress.materials[row.id] ?? materialStates[0]])),
        built: Object.fromEntries(buildGroups.map(([id, name]) => [name, progress.completed.includes(`built:${id}`)])),
        phases: phases.map(p => ({
          title: p.title, steps: p.steps.map((step, i) => ({ step, done: progress.completed.includes(`${p.id}:${i}`) })),
          check: p.check, checked: progress.completed.includes(`${p.id}:check`),
        })),
      }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(output);
      const link = element('a');
      link.href = url;
      link.download = 'progreso-mq03.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    const reset = element('button', 'Reiniciar progreso');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      if (!window.confirm('¿Reiniciar las tareas y los estados de materiales de la guía?')) return;
      progress = { completed: [], materials: {} };
      save();
      render();
    });
    buttons.append(exportButton, reset);
    prep.append(buttons);
  }

  function phaseDimensions(id: PhaseId) {
    const desk = catalog.items.find(item => item.kind === 'desk')!;
    const counter = catalog.items.find(item => item.kind === 'counter')!;
    switch (id) {
      case 'base': return [
        `Base ${dimensions(displayBase.width * 1000, displayBase.depth * 1000)}.`,
        `Local ${dimensions(toMM(room.w), toMM(room.d))}. Franja perimetral ${dimensions((displayBase.width * 1000 - toMM(room.w)) / 2)}.`,
      ];
      case 'floor': return [
        `Piso ${dimensions(toMM(room.w), toMM(room.d))}. Espesor del modelo ${dimensions(register.floorMm)}.`,
        `Registro propuesto ${dimensions(toMM(register.w), toMM(register.d))}. Centro desde la esquina posterior izquierda ${dimensions(toMM(register.x), toMM(register.z))}.`,
        `Cámara libre de ${dimensions(toMM(floorLayers.gap))}. Con la base y el piso, la superficie queda a ${dimensions(register.baseMm + register.floorMm + toMM(floorLayers.gap))} sobre la mesa.`,
        `Tapa lateral ${dimensions(toMM(chamber.cover.d), toMM(floorLayers.gap))}. Ventana ${dimensions(toMM(chamber.window.w), toMM(floorLayers.gap))}.`,
        `Ejes de Cat6 y electricidad a ${dimensions(-toMM(floorLayers.dataY))} y ${dimensions(-toMM(floorLayers.powerY))} bajo el piso terminado, respectivamente. Prueba el espesor real en el cruce.`,
      ];
      case 'walls': return catalog.items.filter(item => ['wall', 'window', 'door'].includes(item.kind))
        .map(item => `${families[item.kind].name} ${item.id} · ${dimensions(...item.dims.map(toMM))}.`);
      case 'stations': return [
        `${catalog.counts.desk} escritorios · ${dimensions(...desk.dims.map(toMM))} (ancho, alto, fondo).`,
        `Mostrador ADM-01 · ${dimensions(...counter.dims.map(toMM))} (ancho, alto, fondo).`,
        ...catalog.items.filter(item => ['chair','monitor','keyboard','mouse','tower'].includes(item.kind) && item.id === desk.id)
          .map(item => `${catalog.counts[item.kind]} × ${families[item.kind].name} · ${dimensions(...item.dims.map(toMM))}.`),
      ];
      case 'equipment': return catalog.items.filter(item => ['rack', 'server', 'minisplit', 'condenser'].includes(item.kind))
        .map(item => `${item.id} · ${dimensions(...item.dims.map(toMM))} (ancho, alto, fondo).${item.kind === 'minisplit' || item.kind === 'condenser' ? ' ' + item.detail : ''}`);
      case 'finish': return [`Local ${dimensions(toMM(room.w), toMM(room.d))}. Escala 1:${scale}. Calibración ${dimensions(calibrationMM)}.`,
        `Paso de ensayo a escala ${dimensions(toMM(study.width))}. ${network.links.length} enlaces representados.`];
    }
  }

  function render() {
    const phase = phases[index];
    const completed = phases.filter(p => p.steps.every((_, i) => progress.completed.includes(`${p.id}:${i}`)) &&
      progress.completed.includes(`${p.id}:check`) && (p.id !== 'stations' || progress.completed.includes('prototype'))).length;
    const nav = element('select');
    nav.setAttribute('aria-label', 'Fase de construcción');
    for (const [i, step] of phases.entries()) nav.append(new Option(`${i + 1}. ${step.title}`, String(i)));
    nav.value = String(index);
    nav.addEventListener('change', () => selectPhase(Number(nav.value)));
    const heading = element('h3', phase.title);
    heading.tabIndex = -1;
    const status = element('p', `Fase ${index + 1} de ${phases.length} · ${completed} completas · ${phases.length - completed} pendientes`);
    status.className = 'muted';
    const goal = element('p', phase.goal);
    const support = (document.getElementById('monitor-support') as HTMLSelectElement)?.value === 'simple';
    const rows = summarizePhase(productionCuts(catalog.cuts, support), phase.kinds);
    const materials = phase.materials.map(id => {
      const row = rows.get(id);
      const name = totals.find(material => material.id === id)!.name;
      if (!row) return name;
      return `${name} · ${row.pieces} piezas${row.area ? `, ${mm(row.area)} cm²` : ''}${row.length ? `, ${mm(row.length)} m` : ''}`;
    });
    const materialList = element('ul');
    for (const material of materials) materialList.append(element('li', material));
    const sizes = element('ul');
    for (const size of phaseDimensions(phase.id)) sizes.append(element('li', size));
    const checks = element('div');
    const pending = element('ul');
    const done = element('ul');
    for (const [i, step] of phase.steps.entries()) {
      const id = `${phase.id}:${i}`;
      const row = element('li');
      row.append(task(id, step));
      (progress.completed.includes(id) ? done : pending).append(row);
    }
    checks.append(element('p', 'Pendientes de ensamblaje'), pending, element('p', 'Tareas terminadas'));
    checks.append(done.children.length ? done : element('p', 'Aún no hay tareas marcadas.'));
    const checked = task(`${phase.id}:check`, phase.check);
    if (phase.id === 'stations' && !progress.completed.includes('prototype')) {
      checked.querySelector('input')!.disabled = true;
    }
    const actions = element('div');
    actions.className = 'network-actions';
    for (const [direction, text] of [[-1, 'Anterior'], [1, 'Siguiente']] as const) {
      const button = element('button', text);
      button.type = 'button';
      button.disabled = index + direction < 0 || index + direction >= phases.length;
      button.addEventListener('click', () => selectPhase(index + direction));
      actions.append(button);
    }
    const phaseActions = element('div');
    phaseActions.className = 'network-actions';
    if (phase.id === 'floor') {
      const hatch = element('button', hatchOpen ? 'Cerrar registro' : 'Abrir registro');
      hatch.type = 'button';
      hatch.setAttribute('aria-pressed', String(hatchOpen));
      hatch.addEventListener('click', () => {
        hatchOpen = !hatchOpen;
        onPhase(phase.id, hatchOpen);
        render();
      });
      phaseActions.append(hatch);
    }
    if (phase.id === 'stations') {
      for (const [label, id] of [['Plantilla PC-01', 'station-template'], ['Lotes de fabricación', 'production-template']]) {
        const button = element('button', label);
        button.type = 'button';
        button.addEventListener('click', () => document.getElementById(id)?.click());
        phaseActions.append(button);
      }
    }
    const items = catalog.items.filter(item => (phase.kinds as readonly string[]).includes(item.kind));
    const example = items.find(item => item.kind === (phase.id === 'stations' ? 'desk' : phase.id === 'equipment' ? 'rack' : 'wall'));
    if (example) {
      const button = element('button', 'Consultar ficha de ejemplo');
      button.type = 'button';
      button.addEventListener('click', () => onComponent(example.kind, example.id));
      phaseActions.append(button);
    }
    renderPreparation();
    panel.replaceChildren(status, nav, heading, goal, actions, phaseActions,
      element('h4', 'Materiales'), materialList, element('p', phase.tools),
      element('h4', 'Piezas y medidas'), sizes, element('h4', 'Ensamblaje'), checks,
      element('h4', 'Antes de continuar'), element('p', phase.care), checked, prep);
  }

  function selectPhase(next: number) {
    index = next;
    hatchOpen = false;
    onPhase(phases[index].id, false);
    render();
    panel.querySelector('h3')?.focus();
  }

  function setOpen(enabled: boolean) {
    open = enabled;
    panel.hidden = !open;
    source.hidden = open;
    toggle.setAttribute('aria-expanded', String(open));
    onPhase(open ? phases[index].id : null, open && hatchOpen);
    if (open) render();
  }

  toggle.addEventListener('click', () => setOpen(!open));
  document.getElementById('monitor-support')?.addEventListener('change', () => { if (open) render(); });
  return {
    close: () => { if (open) setOpen(false); },
    reflectRegister(enabled: boolean) {
      hatchOpen = enabled;
      if (open && phases[index].id === 'floor') render();
    },
  };
}
