import './style.css';
import { inspect, maxX, meters, minX } from './geometry.ts';
import { chairStates, createModel, layouts, study } from './model.ts';
import type { ChairState, LayoutId } from './model.ts';
import { createViewer } from './viewer.ts';
import { buildNetwork } from './network.ts';
import { equipmentFicha, equipmentNames, portMap, technicalEquipment, trunkColor, vlans } from './network-design.ts';
import type { PortPair } from './network-design.ts';

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}
function selectOptions(select: HTMLSelectElement, entries: [string, string][]) {
  select.replaceChildren(...entries.map(([key, label]) => new Option(label, key)));
}
const layout = element<HTMLSelectElement>('layout');
const chair = element<HTMLSelectElement>('chair');
const passage = element<HTMLSelectElement>('passage');
const destination = element<HTMLSelectElement>('destination');
const dimensions = element<HTMLInputElement>('dimensions');
const circulation = element<HTMLInputElement>('circulation');
const defaultLayout: LayoutId = 'compactA2';
const network = buildNetwork();
const networkLink = element<HTMLSelectElement>('network-link');
const allButton = element<HTMLButtonElement>('network-all');
const equipment = element<HTMLSelectElement>('equipment');
const logical = element<HTMLInputElement>('logical');
const equipmentLabels = element<HTMLInputElement>('equipment-labels');
const highlightPorts = element<HTMLInputElement>('highlight-ports');
let activePort: PortPair | undefined;
let rackView = false;
const networkLayers = ['ducts', 'cables', 'outlets'].map(id => element<HTMLInputElement>(id));
let showAll = false;
selectOptions(networkLink, [['', 'Seleccionar computadora'], ...network.links.map(link =>
  [link.id, `${link.equipment} · ${link.outlet}`] as [string, string])]);
selectOptions(equipment, [['', 'Seleccionar equipo'], ...technicalEquipment.map(id =>
  [id, `${id} · ${equipmentNames[id]}`] as [string, string]),
  ...network.links.map(link => [link.equipment, link.equipment] as [string, string])]);
selectOptions(layout, Object.entries(layouts).map(([key, data]) => [key, data.label]));
layout.value = defaultLayout;
selectOptions(chair, Object.entries(chairStates));
chair.value = 'occupied';

let viewer: ReturnType<typeof createViewer> | undefined;
try {
  viewer = createViewer(element('viewport'), element('labels'), id => {
    passage.value = id;
    showInspection();
  }, selectEquipment);
} catch (error) {
  element('renderer-error').hidden = false;
  console.error(error);
}

let model = createModel(defaultLayout, 'occupied');
let inspection = inspect(model);
function updateModel() {
  model = createModel(layout.value as LayoutId, chair.value as ChairState);
  inspection = inspect(model);
  const activePassage = passage.value || 'center-aisle';
  const activeTarget = destination.value || inspection.mainRoute.id;
  selectOptions(passage, inspection.passages.map(p => [p.id, p.label]));
  selectOptions(destination, [inspection.mainRoute, ...inspection.targets].map(t => [
    t.id, `${t.id} · ${meters(t.width)}${t.width + 1e-8 < study.width ? ' (paso estrecho)' : ''}`,
  ]));
  passage.value = inspection.passages.some(p => p.id === activePassage) ? activePassage : 'P1';
  destination.value = activeTarget;
  element('layout-note').textContent = model.layout.note;
  element('chair-note').textContent = `La envolvente sobresale ${meters(model.layout.projection[model.chairState])} desde la mesa. ` +
    'Al separar la silla para entrar o levantarse, ocupa más pasillo.';
  showInspection();
  showNetwork();
}

function showNetwork() {
  const enabled = layout.value === defaultLayout;
  const [ducts, cables, outlets] = networkLayers.map(input => input.checked);
  const link = network.links.find(item => item.id === networkLink.value);
  element<HTMLFieldSetElement>('network-controls').disabled = !enabled;
  element('network-note').textContent = enabled
    ? 'Azul grisáceo: proyección de canalización bajo piso. Azul: Cat6. Las subidas se muestran en cada mueble.'
    : 'Los recorridos se calcularon para A2. Selecciona A2 para inspeccionarlos.';
  allButton.setAttribute('aria-pressed', String(showAll));
  element('network-reading').textContent = !enabled ? '' : link
    ? `${link.id} · ${meters(link.total)} estimados`
    : showAll ? '26 enlaces · tramos compartidos agrupados' : '';
  element('network-detail').textContent = enabled && link
    ? `${link.panelPort} → ${link.outlet} → ${link.equipment}. ${meters(link.horizontal)} horizontales + ${meters(link.vertical)} verticales + ${meters(link.reserve)} de reserva.`
    : '';
  viewer?.showNetwork(network, { enabled, ducts, cables, outlets, showAll, selected: link?.id,
    logical: logical.checked, equipmentLabels: equipmentLabels.checked,
    equipment: equipment.value, ports: highlightPorts.checked ? activePort ?? equipmentFicha(network, equipment.value)?.ports ?? {} : {} });
}

function selectEquipment(id: string, port?: number) {
  equipment.value = id;
  activePort = port ? portPair(id, port) : undefined;
  const link = network.links.find(item => item.equipment === id);
  if (link && layout.value === defaultLayout) {
    networkLink.value = link.id;
    showAll = false;
    networkLayers[1].checked = true;
  }
  if (technicalEquipment.includes(id)) networkLink.value = '';
  showEquipment();
}

function portPair(id: string, number: number): PortPair {
  if (number <= network.links.length) return { panel: number, switch: number };
  return id === 'PP-01' ? { panel: number } : { switch: number };
}

function showEquipment() {
  const id = equipment.value;
  const card = element('equipment-card');
  const grid = element('port-grid');
  const legend = element('vlan-legend');
  card.replaceChildren();
  grid.replaceChildren();
  legend.hidden = !logical.checked;
  legend.replaceChildren();
  if (logical.checked) {
    for (const [id, vlan] of Object.entries(vlans)) {
      const item = document.createElement('p');
      item.style.setProperty('--vlan-color', `#${vlan.color.toString(16).padStart(6, '0')}`);
      item.textContent = `VLAN ${id} · ${vlan.name} · ${vlan.subnet} · GW ${vlan.gateway}`;
      legend.append(item);
    }
    const trunk = document.createElement('p');
    trunk.style.setProperty('--vlan-color', '#087967');
    trunk.textContent = 'Verde · troncal 802.1Q. Ámbar en las líneas · latiguillos físicos.';
    legend.append(trunk);
  }
  const ficha = equipmentFicha(network, id);
  if (ficha) {
    const title = document.createElement('h4');
    title.textContent = `${id} · ${ficha.name}`;
    const dl = document.createElement('dl');
    for (const [name, value] of ficha.fields) {
      const term = document.createElement('dt');
      term.textContent = name;
      const detail = document.createElement('dd');
      detail.textContent = value;
      dl.append(term, detail);
    }
    card.append(title, dl);
  }
  if (id === 'PP-01' || id === 'SW-01') {
    const patchPanel = id === 'PP-01';
    const { panel, sw } = portMap(network);
    const current = patchPanel ? activePort?.panel : activePort?.switch;
    const buttons = document.createElement('div');
    buttons.className = 'port-grid';
    buttons.setAttribute('aria-label', `Puertos de ${id}`);
    const notes = document.createElement('p');
    notes.id = 'port-note';
    notes.textContent = 'Selecciona un puerto para consultar su destino.';
    for (const [i, port] of sw.entries()) {
      const number = String(port.number).padStart(2, '0');
      const link = panel[i];
      const description = patchPanel
        ? link ? `${link.outlet} · ${link.equipment} · ${link.switchPort}` : 'Libre'
        : port.mode === 'reserved' ? 'Reservado · disponible'
          : `${port.equipment}${link ? ` · ${link.panelPort} · ${link.outlet}` : ''} · ${port.mode === 'trunk' ? 'Troncal' : 'Acceso'} VLAN ${port.vlans.join(', ')}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = number;
      button.title = description;
      button.setAttribute('aria-label', `${id}/${number} · ${description}`);
      button.setAttribute('aria-pressed', String(port.number === current));
      if (logical.checked && !patchPanel && port.mode !== 'reserved') {
        const color = port.mode === 'trunk' ? trunkColor : vlans[port.vlans[0]].color;
        button.style.setProperty('--vlan-color', `#${color.toString(16).padStart(6, '0')}`);
      }
      if (port.number === current) notes.textContent = `${id}/${number} · ${description}`;
      button.addEventListener('click', () => {
        selectEquipment(id, port.number);
        grid.querySelectorAll('button')[i].focus();
      });
      buttons.append(button);
    }
    grid.append(buttons, notes);
  }
  showNetwork();
}

equipment.addEventListener('change', () => selectEquipment(equipment.value));
for (const input of [logical, equipmentLabels, highlightPorts]) input.addEventListener('change', showEquipment);
element('rack-view').addEventListener('click', () => {
  rackView = !rackView;
  if (rackView) equipmentLabels.checked = true;
  viewer?.setView(rackView ? 'rack' : 'iso');
  element('rack-view').setAttribute('aria-pressed', String(rackView));
  element('iso').setAttribute('aria-pressed', String(!rackView));
  element('top').setAttribute('aria-pressed', 'false');
  document.querySelector('.view-hint')!.textContent = rackView
    ? 'Selecciona un equipo o un puerto · Rueda para acercar' : 'Arrastra para orbitar · Rueda para acercar';
  showNetwork();
});

for (const input of networkLayers) input.addEventListener('change', showNetwork);
networkLink.addEventListener('change', () => {
  showAll = false;
  if (networkLink.value) networkLayers[1].checked = true;
  equipment.value = network.links.find(link => link.id === networkLink.value)?.equipment ?? '';
  activePort = undefined;
  showEquipment();
});
allButton.addEventListener('click', () => {
  showAll = true;
  networkLink.value = '';
  networkLayers[1].checked = true;
  equipment.value = '';
  activePort = undefined;
  showEquipment();
});
element('network-clear').addEventListener('click', () => {
  showAll = false;
  networkLink.value = '';
  equipment.value = '';
  activePort = undefined;
  showEquipment();
});

function check(label: string, value: string) {
  const row = document.createElement('p');
  const title = document.createElement('span');
  const result = document.createElement('strong');
  title.textContent = label;
  result.textContent = value;
  row.append(title, result);
  return row;
}

function showInspection() {
  const selected = inspection.passages.find(p => p.id === passage.value)!;
  const target = [inspection.mainRoute, ...inspection.targets].find(t => t.id === destination.value)!;
  element('width').textContent = meters(selected.width);
  const warning = selected.width < study.width - 1e-8;
  const status = element('width-status');
  status.textContent = warning ? 'Bajo el umbral de ensayo' : 'Cumple el ancho de ensayo';
  status.dataset.warning = String(warning);
  element('passage-detail').textContent = selected.detail;
  const passes = target.width + 1e-8 >= study.width;
  element('route-result').textContent = target.width
    ? `Mínimo en la mejor ruta: ${meters(target.width)}. ${passes ? 'Pasa' : 'Falla'} el ensayo de ${meters(study.width)}.`
    : 'Sin conexión por la zona de aproximación modelada.';
  element('route-pinch').textContent = target.pinch
    ? `Punto estrecho en x ${meters(target.pinch.point.x)}, z ${meters(target.pinch.point.z)} · ${target.pinch.nearby.join(' / ')}.`
    : '';
  const clients = inspection.targets.filter(t => t.id.startsWith('PC-') && t.index >= 0).length;
  const collisions = inspection.swings.flatMap(swing => swing.hits.map(hit => `${swing.id} / ${hit}`));
  const widthFor = (id: string) => meters(inspection.targets.find(t => t.id === id)!.width);
  element('checks').replaceChildren(
    check('Entre mesas contiguas', meters(minX(model.stations[1].desk) - maxX(model.stations[0].desk))),
    check('Puestos con ruta', `${clients} / ${model.stations.length}`),
    check('Mínimo entre rutas a puestos', meters(Math.min(...inspection.targets.slice(0, model.stations.length).map(t => t.width)))),
    check('Recepción / cuarto técnico', `${widthFor('ADM-01')} / ${widthFor('Cuarto técnico')}`),
    check('Servicio del rack', widthFor('Servicio del rack')),
    check('Giro de hojas', collisions.length ? collisions.join(' · ') : 'Sin interferencias detectadas'),
    check('Solapes', inspection.overlaps.length ? inspection.overlaps.join(' · ') : 'Ninguno detectado'),
    ...(inspection.serviceHits.length ? [check('Área de servicio', inspection.serviceHits.join(' · '))] : []),
  );
  viewer?.showZones(model, inspection, selected, destination.value);
}

for (const control of [layout, chair]) control.addEventListener('change', updateModel);
for (const control of [passage, destination]) control.addEventListener('change', showInspection);
for (const input of [dimensions, circulation]) {
  input.addEventListener('change', () => viewer?.layers(dimensions.checked, circulation.checked));
}
for (const view of ['iso', 'top'] as const) {
  element(view).addEventListener('click', () => {
    rackView = false;
    element('rack-view').setAttribute('aria-pressed', 'false');
    viewer?.setView(view);
    element('iso').setAttribute('aria-pressed', String(view === 'iso'));
    element('top').setAttribute('aria-pressed', String(view === 'top'));
    document.querySelector('.view-hint')!.textContent = view === 'iso'
      ? 'Arrastra para orbitar · Rueda para acercar'
      : 'Clic en un pasillo para medir · Rueda para acercar';
    showNetwork();
  });
}
element('center').addEventListener('click', () => viewer?.center());
element('in').addEventListener('click', () => viewer?.zoom(1.2));
element('out').addEventListener('click', () => viewer?.zoom(1 / 1.2));
element('criteria').textContent =
  `El visor busca la ruta que admite el cuadrado más ancho en una malla de ${study.grid * 100} cm. ` +
  `Se cuentan los puestos que alcanzan ${meters(study.width)}. Las puertas se prueban abiertas a 90°. ` +
  'El marcador indica un punto de anchura mínima. Las coordenadas parten de la esquina exterior posterior izquierda, con z hacia la entrada. El ancho de ensayo sirve para comparar la geometría.';
updateModel();
