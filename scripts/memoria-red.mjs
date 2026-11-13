import { writeFileSync } from 'node:fs';
import { buildNetwork, networkSpec, sectionSize } from '../src/network.ts';

const { links, ducts, spineX } = buildNetwork();
const sum = (items, field) => items.reduce((total, item) => total + item[field], 0);
const fmt = n => n.toFixed(2);
const delta = n => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;
const horizontal = sum(links, 'horizontal');
const vertical = sum(links, 'vertical');
const reserve = sum(links, 'reserve');
const total = sum(links, 'total');
const ductTotal = sum(ducts, 'length');
const cableArea = Math.PI * (networkSpec.cableDiameter / 2) ** 2;
const rows = links.map(l =>
  `| ${l.id} | ${l.equipment} | ${l.panelPort} | ${l.outlet} | ${fmt(l.outletPoint.x)}, ${fmt(l.outletPoint.z)} | ${fmt(l.horizontal)} | ${fmt(l.vertical)} | ${fmt(l.reserve)} | ${fmt(l.total)} |`);
const sections = Object.entries(sectionSize).map(([size, [width, depth]]) => {
  const segments = ducts.filter(d => d.section === size);
  const peak = Math.max(...segments.map(d => d.cables.length));
  return `| ${size} | ${segments.length} | ${fmt(sum(segments, 'length'))} | ${peak} | ${fmt(100 * peak * cableArea / (width * depth))}% |`;
});

const markdown = `# R-02 actualizado para A2

Memoria de cálculo de M3D-02, ciclo 1. La red física parte de la planta A2 aprobada y del mapa de conexiones de M-01. R-01 y R-02 Rev. 02 aportan el esquema de estrella y las referencias históricas. Las cantidades se calculan sobre los ejes del modelo A2 en metros.

## Trazado protegido

El origen es la esquina exterior posterior izquierda de A2. En Three.js, x avanza a la derecha, z hacia la entrada e y indica altura. Los 26 tendidos parten de las terminaciones traseras de PP-01 dentro de RACK-01. El colector baja a y = ${fmt(networkSpec.underfloorY)} m, cruza bajo la partición técnica y conecta con la troncal en x = ${fmt(spineX)} m. De ahí salen ramales bajo piso hacia los bloques de tres y dos puestos y hacia ADM-01. Las subidas van dentro de la huella de cada mueble y terminan a y = ${fmt(networkSpec.outletY)} m. Los tendidos del bloque izquierdo cruzan el corredor central por debajo del piso, dentro del sistema protegido. En el visor los tramos enterrados se proyectan sobre el piso para hacerlos visibles. Los anchos y trazos superpuestos son esquemáticos. La cota de enterramiento queda en los datos y en el cálculo.

Cada enlace se mide por sus segmentos horizontales y verticales más ${fmt(networkSpec.reserve)} m de reserva total por enlace para los extremos. Cada cable contabiliza su recorrido por los tramos compartidos. El cómputo de canalización suma una sola vez cada tramo físico, aunque lo usen varios cables. Los puntos de paso por un ramal compartido son derivaciones protegidas. El enlace termina únicamente en su propia toma.

## Enlaces permanentes Cat6

Todas las medidas están en metros. La última columna incluye reserva de instalación.

| Cable | Equipo | Puerto | Toma | Toma x, z | Horizontal | Vertical | Reserva | Total |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
${rows.join('\n')}
| **Total** | **26 puestos** | | | | **${fmt(horizontal)}** | **${fmt(vertical)}** | **${fmt(reserve)}** | **${fmt(total)}** |

## Canalización neta por sección nominal

| Sección (mm) | Tramos únicos | Longitud (m) | Máx. cables simultáneos | Ocupación nominal máxima |
| --- | ---: | ---: | ---: | ---: |
${sections.join('\n')}
| **Total** | **${ducts.length}** | **${fmt(ductTotal)}** | | |

La ocupación es una comprobación preliminar con diámetro supuesto de 6.5 mm y sección rectangular nominal. Confirmar sección útil, radios de curvatura, capacidad de accesorios y forma real de instalación. Las secciones representan ductos protegidos de anteproyecto. La selección comercial del sistema bajo piso y de las salidas de mobiliario queda pendiente.

## Comparación y materiales

| Magnitud | R-02 histórico | A2 | Diferencia |
| --- | ---: | ---: | ---: |
| Cable permanente con reserva | 309.55 m | ${fmt(total)} m | ${delta(total - 309.55)} m |
| Canalización neta | 72.05 m | ${fmt(ductTotal)} m | ${delta(ductTotal - 72.05)} m |

El cambio de trayectoria y la profundidad bajo piso modifican las longitudes. Con un margen adicional de compra del 10%, el cable daría ${fmt(total * 1.1)} m, o ${Math.ceil(total * 1.1)} m redondeados hacia arriba. Confirmar presentación comercial y plan de corte. Los metrajes de la tabla de canalización son netos y excluyen merma, accesorios y longitudes de producto comercial.

- 1 gabinete RACK-01, 1 panel Cat6 de 48 posiciones, 1 switch administrable de 48 puertos, 1 router/firewall, 1 ONT según ISP y 1 Mac mini M4.
- 26 tomas y 52 terminaciones IDC entre panel y tomas. Prever cajas o placas de salida y etiquetas en ambos extremos.
- 26 latiguillos de panel a switch y 26 de toma a estación. SRV-01 y RTR-01 LAN van directamente a SW-01/27 y /28. ONT-01 conecta al puerto WAN del router. Estos latiguillos quedan fuera del cable permanente. En el visor se dibujan los latiguillos del cuarto técnico.
- Prever una bajada del rack, 26 subidas protegidas, tees, codos, reducciones, registros accesibles, fijaciones y un paso protegido bajo la partición técnica. Dimensionar accesorios y registros después de confirmar el sistema constructivo.

## Límites constructivos

La ruta presupone un sistema protegido bajo piso con acceso de mantenimiento. La profundidad representada no autoriza cortar la losa ni define una obra civil. Confirmar la sección constructiva, registros, protección mecánica, separación respecto de energía y compatibilidad de cajas de salida con las mesas. Las subidas deben quedar dentro del mobiliario, fuera de las zonas de paso. Verificar curvas, holguras y el tendido real antes de fijar un metraje de compra. El ensayo de circulación de A2 no certifica accesibilidad ni cumplimiento normativo. El cableado es un anteproyecto sin instalación ni certificación Cat6.

Para regenerar esta memoria, desde M3D-01 ejecutar \`node scripts/memoria-red.mjs\` con Node.js 24. La geometría y los identificadores se toman del mismo módulo que usa el visor.
`;
writeFileSync(new URL('../../02_DOCUMENTACION_MODELO/R02_A2_ACTUALIZADO.md', import.meta.url), markdown);
