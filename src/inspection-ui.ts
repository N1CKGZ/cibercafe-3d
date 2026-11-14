import { connectionCatalog, defaultInspectionOptions, inspectionLayers } from './inspection.ts';
import type { InfrastructureOptions, InspectionLayer } from './inspection.ts';
import type { Network } from './network.ts';
import type { buildInfrastructure } from './infrastructure.ts';

export function inspectionUI(network: Network, infrastructure: ReturnType<typeof buildInfrastructure>,
  onChange: (options: InfrastructureOptions) => void, camera: (view: 'iso' | 'bottom') => void) {
  const catalog = connectionCatalog(network, infrastructure);
  const panel = document.getElementById('infrastructure-panel')!;
  const station = panel.querySelector<HTMLSelectElement>('#infrastructure-station')!;
  const style = panel.querySelector<HTMLSelectElement>('#infrastructure-style')!;
  const card = panel.querySelector<HTMLElement>('#connection-card')!;
  const layers = panel.querySelector<HTMLElement>('#infrastructure-layers')!;
  const fields = new Map<InspectionLayer, HTMLInputElement>();
  let options = defaultInspectionOptions();
  station.append(new Option('Mostrar todas', ''), ...catalog.map(row => new Option(row.id, row.id)));
  for (const [id, text] of inspectionLayers) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.layer = id;
    input.checked = options.layers[id];
    input.addEventListener('change', () => {
      options = { ...options, layers: { ...options.layers, [id]: input.checked } };
      render();
    });
    label.append(input, ' ' + text);
    fields.set(id, input);
    layers.append(label);
  }
  const number = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
  const mm = (meters: number) => number.format(meters * 1000 / 25) + ' mm';
  function render() {
    const row = options.selection;
    const heading = document.createElement('h3');
    heading.textContent = row ? row.id : '26 estaciones conectadas';
    const content = document.createElement('dl');
    const rows = row ? [
      ['Caja de servicio', row.service.labels.box],
      ['Toma eléctrica', row.service.labels.power],
      ['Ethernet académico', `${row.id} → ${row.link.outlet} → ${row.link.id} → ${row.link.panelPort} → ${row.link.switchPort}`],
      ['VLAN', String(row.vlan)],
      ['Cat6 del proyecto · metros', `${number.format(row.link.total)} m estimados con reserva (${number.format(row.link.horizontal + row.link.vertical)} m geométricos + ${number.format(row.link.reserve)} m de reserva)`],
      ['Electricidad decorativa · maqueta 1:25', `TE-01 → ${row.circuit.id} → ${row.service.labels.power} → ${row.id}`],
      ['Ruta TE-01 a toma · maqueta', mm(row.powerLength)],
      ['Cordón toma a gabinete · maqueta', mm(row.powerCordLength)],
      ['Tramos eléctricos compartidos', `${row.circuit.label} · ${row.circuit.loads.join(', ')}. Se resalta el camino hasta esta toma.`],
    ] : [
      ['Selección', 'Elige una computadora en el modelo o en el selector para seguir sus dos conexiones.'],
      ['Ethernet', '26 enlaces físicos convergen en PP-01 y SW-01.'],
      ['Electricidad decorativa', 'Siete circuitos representados con hilo, con origen en TE-01.'],
    ];
    for (const [name, value] of rows) {
      const term = document.createElement('dt'), detail = document.createElement('dd');
      term.textContent = name;
      detail.textContent = value;
      content.append(term, detail);
    }
    card.replaceChildren(heading, content);
    for (const [id, input] of fields) input.checked = options.layers[id];
    style.value = options.style;
    station.value = row?.id ?? '';
    onChange(options);
  }
  function select(id: string) {
    options = { ...options, selection: catalog.find(row => row.id === id) ?? null };
    render();
  }
  station.addEventListener('change', () => select(station.value));
  style.addEventListener('change', () => {
    const transparent = style.value === 'transparent';
    options = { ...options, style: transparent ? 'transparent' : 'only',
      layers: { ...options.layers, floor: transparent, walls: transparent } };
    render();
  });
  panel.querySelector('#infrastructure-bottom')!.addEventListener('click', () => camera('bottom'));
  panel.querySelector('#infrastructure-reset')!.addEventListener('click', () => {
    options = defaultInspectionOptions();
    render();
    camera('iso');
  });
  return { select, refresh: render, catalog };
}
