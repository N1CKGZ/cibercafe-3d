# Cibercafé 3D · Visor 3D Interactivo y Recorrido Virtual

Visor interactivo en Three.js de la planta arquitectónica y técnica de 10 × 10 m para un cibercafé con 25 puestos cliente, administración (ADM-01), servidor Mac mini M4 (SRV-01), cuarto técnico con rack de telecomunicaciones, cableado estructurado Cat6 y asignación de VLANs.

**Demo en línea (GitHub Pages):** [https://n1ckgz.github.io/cibercafe-3d/](https://n1ckgz.github.io/cibercafe-3d/)

---

## Características

- **Distribución A2 validada**: Corredor central de 1.30 m, accesibilidad a los 25 puestos cliente y recepción sin interferencias de evacuación.
- **Vistas de cámara**: Isométrica, Superior (planta con cotas), Detalle de rack y Recorrido en primera persona.
- **Recorrido en primera persona (Walkthrough)**:
  - Navegación realista con altura de ojos a 1.65 m.
  - Desplazamiento con teclado <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> y orientación con ratón (`PointerLockControls`).
  - Carrera con <kbd>Shift</kbd>.
  - Sistema de colisiones por volumen cilíndrico ($r = 0.22\text{ m}$) contra muros, mesas, sillas, rack y puerta técnica.
  - Puerta técnica interactiva (abrir/cerrar con tecla <kbd>E</kbd> o clic).
  - Apertura directa de ficha técnica (<kbd>F</kbd> o clic) al apuntar hacia cualquier equipo cliente o técnico.
  - Detección en tiempo real de zonas del local en el HUD superior.
- **Red y cableado estructurado**:
  - 26 enlaces Cat6 bajo piso con cálculo de tramos horizontales, verticales y reserva.
  - Mapeo de 48 puertos en patch panel y switch administrable.
  - Separación lógica en VLAN 10 (Clientes), VLAN 20 (Administración) y VLAN 30 (Servidor y gestión).
- **Fichas técnicas interactivas**:
  - Especificaciones de hardware, tomas RJ45, puertos de patch panel/switch, IP y asignación de VLAN.

---

## Ejecutar localmente

Node.js 20+ recomendado. Construido con Three.js 0.187.0, TypeScript 7 y Vite 8.

```sh
# Instalar dependencias
npm ci

# Servidor de desarrollo
npm run dev

# Pruebas automatizadas (17 pruebas)
npm test

# Compilación para producción
npm run build

# Vista previa de producción
npm run preview
```

---

## Arquitectura técnica

- `src/model.ts`: Modelo paramétrico del local, cotas y mobiliario en distribución A2.
- `src/geometry.ts`: Algoritmos de inspección geométrica, cálculo de rutas y holguras.
- `src/collision.ts`: Motor de detección de obstáculos, colisiones cilíndricas y zonas de navegación.
- `src/network.ts`: Modelado tridimensional de ductos bajo piso, tomas y tendido de cable Cat6.
- `src/network-design.ts`: Diseño lógico de red, mapa de puertos 1–48 y fichas técnicas.
- `src/viewer.ts`: Renderizado WebGL Three.js, iluminación, sombras, cámaras y controles PointerLock.
- `src/main.ts`: Controlador de interfaz de usuario, eventos, panel de inspección y modal interactivo.


## Evaluación inicial de geometría

| Distribución | Paso entre filas con sillas recogidas / ocupadas / retiradas | Puestos con ruta en esos estados | Observación |
| --- | --- | --- | --- |
| Original | 0.73 / 0.45 / 0.30 m | 24 / 3 / 1 de 25 | Hueco entre mesas de 1.05 m. Solape de sillas PC-21 y ADM-01 en estados ocupado y retirado. Cuarto técnico accesible con sillas recogidas u ocupadas, según este ensayo. |
| A · Mobiliario compacto | 0.98 / 0.73 / 0.63 m | 25 / 25 / 25 de 25 | Mesa de 0.50 m de fondo, paso entre ejes de 1.78 m, recepción más angosta hacia la izquierda. El ensayo alcanza también recepción, espera, cuarto y área de servicio del rack en los tres estados. |
| B · Filas más separadas | 0.94 / 0.66 / 0.51 m | 1 / 1 / 1 de 25 | Con mesa de 0.60 m y paso entre ejes de 1.86 m, la quinta fila restringe la conexión con el resto del local. Al retirar sillas, PC-23 y PC-24 interfieren con el giro de la entrada. |

En A, la separación entre módulos contiguos es 0.15 m y la separación junto al tabique lateral del cuarto es 0.73 m. En A2, el espacio residual junto al tabique es 0.07 m y el acceso al cuarto llega por delante. La puerta técnica abierta deja aproximadamente 0.78 m. Las caras exteriores definen el contorno de 10 × 10 m y el espesor de muro supuesto es 0.14 m. Las dimensiones de vanos, mobiliario, barrido y espacio de servicio son de anteproyecto.

La prueba de rutas usa un cuadrado de 0.60 m por lado y una malla de 2.5 cm. Las puertas están abiertas a 90° para la ruta. El barrido de cada hoja se comprueba por separado. El destino de un puesto es una zona de aproximación detrás de su silla. El umbral de 0.60 m es un criterio comparativo del visor. La prueba no acredita accesibilidad, evacuación ni espacio de maniobra real.

Antes de fijar la maqueta, comprobar en A2 el fondo útil para monitor, teclado y brazos, la envolvente real de la silla, la luz con herrajes y la maniobra frente al rack. La ruta más estrecha a un puesto con la silla retirada de la mesa queda justo en 0.60 m. El ensayo geométrico no certifica accesibilidad ni cumplimiento normativo.

El piso y la base se dibujan como una sola losa con un material claro en la cara superior. Esto elimina las superficies coplanares que causaban parpadeo durante la órbita. A2 queda como referencia para M3D-02, donde se cotejará la planta con el trazado preliminar R-02.

## Capturas

`capturas/` contiene vistas reales del visor, capturadas con Chrome.

## Cableado de A2 · M3D-02

Selecciona una computadora con un clic en el modelo o desde «Cableado estructurado». El visor resalta su enlace y muestra el metraje con reserva. «Mostrar todos» agrupa los cables que comparten tramos. Las capas de canalización, Cat6 y etiquetas se pueden alternar. Los recorridos están disponibles en A2, que es la planta usada para el cálculo. Las líneas horizontales proyectadas representan ductos bajo piso.

La [memoria de cálculo actualizada](../02_DOCUMENTACION_MODELO/R02_A2_ACTUALIZADO.md) incluye el mapa de tomas, metrajes por tramo y los supuestos constructivos.

## Revisión constructiva del trazado bajo piso · M3D-02

La propuesta mantiene los 320.21 m de Cat6 y los 62.93 m de canalización de R02 A2. Prevé ductos cerrados y accesibles, protección mecánica y pasamuros con bordes protegidos. En el visor, la proyección sobre el piso identifica el recorrido enterrado.

Los registros de paso se proponen en la entrada de la troncal desde el rack y en las derivaciones de las cinco filas y de recepción. Sus centros están sobre x = 5.09 m, con z = 0.43, 1.70, 2.21, 3.99, 5.77, 7.55 y 9.42 m. En el cuarto se prevé acceso en la base del rack, x = 9.35 m, z = 1.70 m. Los registros dentro del corredor requieren tapas enrasadas y resistentes al tránsito, con acceso de mantenimiento. Las cajas de salida van bajo el mueble, con la subida fijada al escritorio y alivio de tensión para el latiguillo. El modelo comprueba una envolvente preliminar de 65 × 45 mm dentro de cada mesa y libre de sillas en los tres estados.

Los giros de 90° son vértices del esquema. Como referencia de anteproyecto, cuatro veces el diámetro supuesto de 6.5 mm equivalen a 26 mm de radio. Verificar en ficha el radio en reposo y durante el tendido, el espacio útil de cada codo o registro y el acceso para guiar los haces. Una sección nominal de 25 × 16 mm no demuestra que una curva quepa en el accesorio. La propuesta bajo piso queda pendiente de validación constructiva, incluida la profundidad disponible y la separación de instalaciones.

En «Equipos y VLAN», pulsa «Ampliar cuarto técnico» para inspeccionar las caras del gabinete y el servidor en su repisa independiente. La vista de detalle oculta el tabique frontal del cuarto y su hoja para facilitar la selección. El panel y el switch muestran su mapa de 48 puertos y permiten resaltar la correspondencia física. «Vista VLAN» colorea la asignación lógica. Los trazos ámbar representan latiguillos físicos. Las fichas describen el diseño de N-01 y S-01, con DHCP para clientes y servicios de servidor previstos.
