import type { Network } from './network.ts';

export const vlans = {
  10: { name: 'Clientes', subnet: '192.168.10.0/26', gateway: '192.168.10.1', color: 0x207cc8 },
  20: { name: 'Administración', subnet: '192.168.20.0/27', gateway: '192.168.20.1', color: 0xb55a14 },
  30: { name: 'Servidor e infraestructura', subnet: '192.168.30.0/27', gateway: '192.168.30.1', color: 0x7d46b8 },
} as const;
export type Vlan = keyof typeof vlans;
export const trunkVlans: Vlan[] = [10, 20, 30];
export const trunkColor = 0x087967;

export const equipmentNames: Record<string, string> = {
  'RACK-01': 'Gabinete de comunicaciones',
  'PP-01': 'Patch panel Cat6 de 48 puertos',
  'SW-01': 'Switch administrable Gigabit de 48 puertos',
  'RTR-01': 'Router / firewall',
  'ONT-01': 'Terminal del proveedor de Internet',
  'SRV-01': 'Apple Mac mini M4',
};
export const technicalEquipment = Object.keys(equipmentNames);

export function portMap(network: Network) {
  const panel = Array.from({ length: 48 }, (_, i) => network.links[i] ?? null);
  const access = (i: number, equipment: string, vlan: Vlan) =>
    ({ number: i, equipment, mode: 'access' as const, vlans: [vlan] });
  const sw = [
    ...network.links.map((link, i) => access(i + 1, link.equipment, link.equipment === 'ADM-01' ? 20 : 10)),
    access(27, 'SRV-01', 30),
    { number: 28, equipment: 'RTR-01 LAN', mode: 'trunk' as const, vlans: trunkVlans },
    ...Array.from({ length: 20 }, (_, i) => ({ number: 29 + i, equipment: '', mode: 'reserved' as const, vlans: [] })),
  ];
  return { panel, sw };
}

type Fields = [string, string][];
export type PortPair = { panel?: number; switch?: number };

export function equipmentFicha(network: Network, id: string): { name: string; fields: Fields; ports: PortPair } | undefined {
  const { panel, sw } = portMap(network);
  const linkIndex = network.links.findIndex(link => link.equipment === id);
  const vlanFields = (vlan: Vlan): Fields =>
    [['VLAN', String(vlan)], ['Subred', vlans[vlan].subnet], ['Gateway', vlans[vlan].gateway]];
  if (linkIndex >= 0) {
    const link = network.links[linkIndex];
    const admin = id === 'ADM-01';
    return {
      name: admin ? 'Computadora administrativa' : 'Computadora cliente',
      fields: [
        ['Procesador', admin ? 'Por definir' : 'AMD Ryzen 5 5600G'],
        ['RAM', admin ? 'Por definir' : '16 GB'], ['Sistema operativo', 'Windows 11 previsto'],
        ['Toma RJ45', link.outlet], ['Patch panel', link.panelPort], ['Switch', link.switchPort],
        ...vlanFields(sw[linkIndex].vlans[0]),
        ['IP prevista', admin ? '192.168.20.10 (fija o reserva DHCP)' : 'DHCP (192.168.10.20–192.168.10.59)'],
        ['Cable permanente', `${link.total.toFixed(2)} m con reserva`],
      ],
      ports: { panel: linkIndex + 1, switch: linkIndex + 1 },
    };
  }
  const fields: Record<string, Fields> = {
    'SRV-01': [['RAM', '24 GB previstos'], ['Almacenamiento', 'SSD 1 TB previsto'], ['Sistema operativo', 'macOS'],
      ['IP prevista', '192.168.30.10'], ...vlanFields(30), ['Switch', 'SW-01/27 · latiguillo directo'],
      ['Servicios previstos', 'SMB para administración y respaldos']],
    'SW-01': [['Ocupación inicial', `${sw.filter(p => p.mode !== 'reserved').length} de ${sw.length} puertos`],
      ['Puertos disponibles', '20 · 29–48 reservados'], ['Acceso', '01–25 VLAN 10 · 26 VLAN 20 · 27 VLAN 30'],
      ['Troncal 802.1Q', '28 · VLAN 10, 20 y 30 hacia RTR-01'], ['IP de gestión prevista', '192.168.30.2']],
    'PP-01': [['Terminaciones', `${panel.filter(Boolean).length} de ${panel.length} puertos`],
      ['Mapa', '01–26 → TR-01–TR-26'], ['Enlace a switch', 'Latiguillos de panel a switch']],
    'RTR-01': [['LAN', 'SW-01/28 · troncal 802.1Q'], ['WAN', 'ONT-01'], ['Función prevista', 'Gateway, DHCP, enrutamiento entre VLAN y filtrado'],
      ['Gateways', trunkVlans.map(vlan => vlans[vlan].gateway).join(' · ')]],
    'ONT-01': [['Salida Ethernet', 'WAN de RTR-01'], ['Equipo y servicio', 'Según el proveedor']],
    'RACK-01': [['Equipos', 'PP-01, SW-01, RTR-01 y ONT-01'], ['Servidor', 'SRV-01 en repisa independiente']],
  };
  if (!(id in fields)) return;
  return { name: equipmentNames[id], fields: fields[id],
    ports: id === 'SRV-01' ? { switch: 27 } : id === 'RTR-01' ? { switch: 28 } : {} };
}
