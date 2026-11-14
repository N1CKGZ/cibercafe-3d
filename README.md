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

Node.js 24 recomendado para ejecutar la misma versión que usa GitHub Actions. Construido con Three.js 0.187.0, TypeScript 7 y Vite 8.

```sh
# Instalar dependencias
npm ci

# Servidor de desarrollo
npm run dev

# Pruebas automatizadas (34 pruebas)
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

El visor muestra el mapa de tomas y los metrajes estimados por tramo. La revisión constructiva siguiente indica los supuestos del trazado.

## Revisión constructiva del trazado bajo piso · M3D-02

La propuesta mantiene los 320.21 m de Cat6 y los 62.93 m de canalización de R02 A2. Prevé ductos cerrados y accesibles, protección mecánica y pasamuros con bordes protegidos. En el visor, la proyección sobre el piso identifica el recorrido enterrado.

Los registros de paso se proponen en la entrada de la troncal desde el rack y en las derivaciones de las cinco filas y de recepción. Sus centros están sobre x = 5.09 m, con z = 0.43, 1.70, 2.21, 3.99, 5.77, 7.55 y 9.42 m. En el cuarto se prevé acceso en la base del rack, x = 9.35 m, z = 1.70 m. Los registros dentro del corredor requieren tapas enrasadas y resistentes al tránsito, con acceso de mantenimiento. Las cajas de salida van bajo el mueble, con la subida fijada al escritorio y alivio de tensión para el latiguillo. El modelo comprueba una envolvente preliminar de 65 × 45 mm dentro de cada mesa y libre de sillas en los tres estados.

Los giros de 90° son vértices del esquema. Como referencia de anteproyecto, cuatro veces el diámetro supuesto de 6.5 mm equivalen a 26 mm de radio. Verificar en ficha el radio en reposo y durante el tendido, el espacio útil de cada codo o registro y el acceso para guiar los haces. Una sección nominal de 25 × 16 mm no demuestra que una curva quepa en el accesorio. La propuesta bajo piso queda pendiente de validación constructiva, incluida la profundidad disponible y la separación de instalaciones.

En «Equipos y VLAN», pulsa «Ampliar cuarto técnico» para inspeccionar las caras del gabinete y el servidor en su repisa independiente. La vista de detalle oculta el tabique frontal del cuarto y su hoja para facilitar la selección. El panel y el switch muestran su mapa de 48 puertos y permiten resaltar la correspondencia física. «Vista VLAN» colorea la asignación lógica. Los trazos ámbar representan latiguillos físicos. Las fichas describen el diseño de N-01 y S-01, con DHCP para clientes y servicios de servidor previstos.

## MQ-02 · Maqueta y materiales

Abre «Maqueta y materiales» y selecciona una pieza en la escena o en el catálogo. Las fichas muestran las medidas del modelo en metros y de la pieza en milímetros. La vista usa A2, con 40 × 40 cm de local y una base centrada de 50 × 50 cm. Las envolventes HVAC son aproximaciones físicas para recortar cartón. Las condensadoras indican las caras exteriores previstas en T-01.

El cálculo de hilo suma los 26 recorridos proyectados, incluidos los ascensos representados. La canaleta miniatura se computa una sola vez por tramo compartido. La longitud técnica de Cat6 y su reserva quedan fuera del material escolar. El inventario aplica un margen provisional de 15 % y considera paños completos para cortar los muros. Ajustar pestañas, uniones y soportes al montar el prototipo.

Para preparar futuras plantillas basta dibujar los rectángulos de las fichas en milímetros en un documento A4 o carta, imprimir al 100 % con «Ajustar a página» desactivado y medir una barra de comprobación de 100 mm antes de cortar. Las piezas de 400 mm requieren un trazo directo sobre el material o una plantilla en mosaico con solapes. Las funciones de impresión y compra se describen en el corte 2. La guía MQ-03 y el apartado de MQ-04 describen el registro desmontable.

## MQ-02 · Corte 2

En «Maqueta y materiales», abre «Plantilla de estación cliente» para imprimir el juego de PC-01 en una hoja. El prototipo actual contiene 21 piezas para monitor, teclado, mouse, gabinete, escritorio y silla. «Generar plantilla» abre cada componente por separado. Selecciona A4 o carta e imprime al 100 %, sin ajustar a página ni agregar encabezados del navegador. Mide la barra de 100 mm en el papel. Transfiere cada pieza a su material. Las líneas continuas indican corte y las discontinuas, doblez.

«Lista de materiales» propone formatos iniciales editables para cotizar en papelería. El acomodo por filas prueba ambos giros de 90° y deja 5 mm de borde y 2 mm entre cortes. Las piezas tabuladas ocupan el rectángulo que contiene sus pestañas. Un formato que no admite una pieza pide cambiar la presentación. La compra sugerida toma el mayor resultado entre las hojas o unidades del acomodo y las necesarias para la reserva del 15 %. El método no garantiza el mínimo absoluto de hojas. Los precios quedan vacíos al abrir el visor y se usan para calcular únicamente el presupuesto escolar. Exporta la cotización en CSV, el resumen de cantidades o la guía del componente seleccionado.

### Conciliación de cantidades del corte 2

Las cifras de cartulina de este apartado corresponden al inventario anterior a la incorporación del mouse. El apartado de lotes indica los totales vigentes.

- **25 escritorios de cliente y un mostrador administrativo.** Los tableros de cliente son de 40 × 20 mm y el de recepción de 66 × 26 mm. Se requieren 104 patas de 27.8 mm entre ambos grupos. Hay 26 monitores, teclados, gabinetes y sillas.
- **Cartón pluma.** Los seis paños completos suman 1,839.968 cm². Los 278.08 cm² de vanos dejan 1,561.888 cm² instalados. El margen sobre los paños completos agrega 275.9952 cm² y da 2,115.9632 cm² de referencia. El acomodo de compra usa los seis rectángulos completos.
- **317 recortes de cartulina.** Cada puesto lleva tres piezas de monitor, seis de gabinete, una de teclado y dos de silla. Se suman cuatro bandas de rack y una tapa de servidor. Las pestañas de 1.5 mm en el frente y reverso del gabinete añaden 31.356 cm² netos respecto al primer corte. El área pasa de 422.40 a 453.76 cm² y el rectángulo de corte por pieza lleva la referencia con margen a 529.89 cm².
- **60 tiras de canaleta y 26 hilos.** Las tiras suman 2.2202 m y 42.1304 cm² al usar el ancho de cada tramo. El hilo suma 10.6764 m de recorrido visible. La base de 500 × 500 mm, el piso de 400 × 400 mm y los soportes siguen sujetos al material disponible y al prototipo.

| Material | Neto | Formato inicial editable | Compra sugerida |
| --- | ---: | --- | ---: |
| Cartón pluma | 1,561.89 cm² | 500 × 700 mm | 1 hoja |
| Cartón para base de 5 mm | 2,500.00 cm² | 550 × 700 mm | 1 hoja |
| Cartón rígido | 1,952.03 cm² | 500 × 700 mm | 1 hoja |
| Cartón delgado de 1 mm | 130.04 cm² | 210 × 297 mm | 1 hoja |
| Cartulina | 453.76 cm² | 216 × 279 mm | 2 hojas |
| Acetato | 192.72 cm² | 216 × 279 mm | 1 hoja |
| Cartulina rígida para canaleta | 42.13 cm² | 216 × 279 mm | 1 hoja |
| Goma EVA | 72.32 cm² | 216 × 279 mm | 1 hoja |
| Papel para pantallas | 42.10 cm² | 210 × 297 mm | 1 hoja |
| Madera | 2.89 m | 150 mm por palito | 23 palitos |
| Hilo azul | 10.68 m | 10 m por rollo | 2 rollos |

Las hojas de cartulina y de cartulina rígida para canaleta se cotizan por separado. El inventario cubre los cortes modelados. Las tiras representan las canaletas, y los soportes de condensadoras y uniones de piso requieren una prueba de montaje. Las plantillas de vanos, puertas y mostrador quedan fuera de este corte.

### Preparación de lotes

«Plantilla de estación cliente» genera el prototipo actualizado de PC-01 con 21 piezas. Incluye un mouse plano de cartulina de 2.6 × 4.2 mm. En las plantillas que incluyen monitor puedes elegir el soporte original de 2.2 × 5.4 mm o el soporte didáctico de 5.2 × 5.4 mm. El soporte ancho conserva la longitud y los dobleces. Sustituye una pieza por otra. La lista de compra y la guía descargable usan la opción seleccionada.

«Impresión por lotes» separa los 25 clientes de ADM-01. Los lotes agrupan los cortes por material. El visor muestra el conteo de hojas y el significado de los códigos impresos. Cada corte lleva el ID de su puesto. A4 y carta usan 10 mm de margen, admiten giros de 90° y conservan las medidas de corte. Imprime al 100 % y mide la barra de 100 mm. Las hojas de madera son guías para transferir la longitud de las patas.

| Material | Clientes · piezas / hojas | Clientes · neto original / ancho | Administración · piezas / hojas |
| --- | ---: | ---: | ---: |
| Cartulina | 325 / 3 | 436.98 / 441.03 cm² | 13 / 1 |
| Cartón rígido | 50 / 1 | 208.84 cm² | 2 / 1 |
| Goma EVA | 25 / 1 | 69.54 cm² | 1 / 1 |
| Papel para pantallas | 25 / 1 | 40.48 cm² | 1 / 1 |
| Madera | 100 / 1 | 2.78 m | 4 / 1 |
| Total | 525 / 7 | | 21 / 5 |

Administración usa un monitor, teclado, mouse, gabinete y silla del mismo despiece. Su tablero es de 66 × 26 mm y sus cuatro patas miden 27.8 mm. Para todo el proyecto, los 26 mouse elevan los recortes de cartulina de 317 a 343. El área neta de cartulina pasa a 456.60 cm² con el soporte original o 460.81 cm² con el ancho. Se conservan las 60 tiras de canaleta. El conteo de impresión corresponde a plantillas y el de compra a formatos comerciales configurados. Confirma el soporte, el corte del mouse y el grosor de los materiales con un prototipo físico antes de imprimir la serie.

## MQ-03 · Guía de construcción

En «Maqueta y materiales», abre «Guía de construcción». Usa el selector o «Anterior» y «Siguiente» para recorrer las seis fases. La misma escena pasa del trazado de A2 a la maqueta completa. Las fichas y las plantillas de MQ-02 siguen disponibles. En la fase de estaciones puedes abrir PC-01 y los lotes directamente.

Marca cada tarea cuando la completes. «Lista de preparación» distingue materiales pendientes de compra, pendientes de medir y adquiridos. También registra los conjuntos por fabricar y construidos. Los datos se guardan en el navegador y se pueden exportar en JSON o reiniciar. La prueba física de PC-01 comienza pendiente y su registro depende del usuario.

En la fase de piso, «Abrir registro» muestra una tapa propuesta de 26 × 35.6 mm sobre la troncal, entre las filas 3 y 4. Marca su centro a 203.6 mm desde la izquierda y 195.2 mm desde el fondo del piso. Reutiliza el recorte como tapa, añade pestañas inferiores y una muesca lateral. El detalle admite proyectar los recorridos fuera de la abertura y muestra dentro la profundidad del ducto. Las líneas azules en la abertura ilustran el haz. Los 26 enlaces conservan sus recorridos y metrajes.

En la propuesta anterior a MQ-04, los 8 mm hasta la parte inferior del ducto y los 4.8 mm de piso dejan 3.2 mm de cámara mínima geométrica. Con la base de 5 mm, el piso terminado queda a 13 mm de la mesa como referencia mínima. Antes de pegar, mide cartón, hilo, pestañas y separadores, y verifica el desplazamiento de la tapa con las mesas colocadas. Mide muros y mobiliario desde el nivel del piso terminado. Los separadores y las pestañas se dimensionan tras la prueba en seco.

## MQ-04 · Corte 1 · Piso técnico y servicios

En «Maqueta y materiales», elige **Piso cerrado**, **Mostrar infraestructura oculta** o **Vista inferior**. Activa Ethernet y electricidad por separado. El celeste indica canaletas de datos, el azul representa el hilo Ethernet, el naranja indica canaletas de electricidad y el negro representa el hilo de alimentación. Los puntos al final de las derivaciones se pueden seleccionar. «Retirar tapa lateral» libera el costado derecho. «Abrir registro superior» conserva el acceso de MQ-03. El acercamiento a las conexiones aísla el puesto y oculta su silla para explicar el montaje.

La base estructural sigue en 500 × 500 × 5 mm. Entre la base y el piso superior de 400 × 400 × 4.8 mm se propone una cámara libre de 12 mm. La superficie terminada queda a 21.8 mm de la mesa. La tapa lateral de 220 × 12 mm se extrae hacia el margen de 50 mm de la base mediante lengüeta. El visor de acetato frontal mide 100 × 12 mm. Ensaya la rigidez del marco, los seis apoyos, el juego de la tapa y la extracción con la maqueta apoyada. La tapa superior reutiliza el recorte de 26 × 35.6 mm del piso.

TE-01 se coloca en el paño posterior del cuarto técnico, separado del rack. E-01/E-02 orientan las etiquetas: CE-01 a CE-05 para filas, CE-06 para administración y CE-07 para la toma dedicada PE-UPS. CE-08 aparece rotulado como alumbrado previsto. Se representa la alimentación del switch, router, ONT y servidor desde UPS-01. El panel de parcheo es pasivo. La electricidad se construye con cartón e hilo, sin clavijas, tomas funcionales ni alimentación real.

Hay 26 cajas bajo las mesas, con una toma dúplex y un RJ45 por puesto, más la toma dedicada del UPS. En las fichas se puede seguir cada TR hasta su Cat6, puerto del panel y puerto del switch. Los cordones entre placa y gabinete, monitor, teclado y mouse pasan bajo el tablero o por detrás de los equipos. La guía mantiene las seis fases y conserva el progreso guardado.

### Cantidades a escala

| Material | Neto | Alcance |
| --- | ---: | --- |
| Hilo azul | 12.10 m | 11.25 m de los 26 enlaces a escala, 0.60 m de cordones y remates de puesto, 0.25 m de puentes del rack |
| Hilo oscuro | 6.12 m | 101 cortes para los circuitos y cordones eléctricos decorativos |
| Hilo gris claro | 2.25 m | 52 conexiones de teclado y mouse |
| Cartulina para canaleta de datos | 45.34 cm² | 60 tiras, 2.52 m lineales |
| Cartulina naranja | 99.18 cm² | 88 tiras, 2.75 m lineales |
| Cartón rígido adicional | 338.78 cm² | 25 piezas para apoyos y tapa lateral |
| Cartón delgado adicional | 82.48 cm² | 194 piezas para TE-01, UPS-01, cajas de servicio y sus soportes |
| Acetato adicional | 12 cm² | 1 ventana frontal |
| Cartulina blanca y papel adicionales | 23.06 cm² | 86 recortes para placas, símbolos y circuitos, más 2 rótulos |

La lista de compra aplica el 15 % sobre los cortes modelados. Para estos tendidos, las presentaciones iniciales estiman dos rollos azules de 10 m, un rollo oscuro y uno gris claro de 10 m, y una hoja por color de canaleta. Las longitudes de MQ-02 se calcularon sobre la proyección visible. MQ-04 usa el trazado bajo piso a escala y suma los cordones nuevos. El cálculo técnico de Cat6 conserva sus recorridos y sus reservas.

Los ejes bajo el piso quedan a 7.2 mm para datos y 12.4 mm para electricidad. Las holguras son geométricas y dependen del espesor del cartón y del hilo de papelería. Prueba un cruce, un apoyo, el registro y una placa de PC-01 antes de cortar el lote. Usa sobrantes para guías, lengüeta, pestañas y uniones. El siguiente apartado describe la fabricación de climatización del corte 2.


## MQ-04 · Corte 2 · Climatización de la maqueta

En «Maqueta y materiales», selecciona un HVAC o CX en el catálogo o sobre la escena. «Acercar equipo» encuadra la cara de trabajo. «Ver par y tuberías» abre un corte del muro para seguir los dos cordones decorativos. Las capacidades de referencia son 24,000 BTU/h para HVAC-01 y HVAC-02, y 12,000 BTU/h para HVAC-03. Las dimensiones y los pasos de muro son provisionales.

CX-02 se centra a 3.70 m y CX-03 a 6.55 m del extremo posterior del muro izquierdo, 0.30 y 0.45 m hacia atrás respecto al corte anterior (12 y 18 mm en maqueta). Conservan sus sectores y alturas. Sus ménsulas y el descenso de las líneas quedan en paños sólidos. En CX-02 el descenso se acerca 1.4 mm a la caja a escala para dejar holgura junto a V5. La planta A2, sus vanos y los circuitos siguen vigentes.

«Generar plantilla» ofrece A4 y carta para los seis equipos. Imprime al 100 %, sin ajuste ni encabezados. Mide la barra de 100 mm antes de transferir el despiece. Usa cartón delgado blanco, marca los dobleces y pega las pestañas de 1.5 mm. La salida de aire y el conjunto de ventilador, cinco aspas y rejilla van impresos sobre sus respectivos frentes. Dobla a 90° dos ménsulas de cartón de 1 mm por condensadora. Cada tira mide 4.8 mm de ancho. Pega al muro la placa de 12 mm y al fondo de la caja el brazo de 13.6 mm (CX-01 y CX-02) o 12.8 mm (CX-03). Alinea ambos brazos antes de pegar la caja. Las tiras impresas de tubería son guías de longitud para el cordón.

| Material de los seis equipos | Cantidad neta | Despiece |
| --- | ---: | --- |
| Cartón delgado | 148.99 cm² | 6 bandas, 12 tapas con pestañas y 6 ménsulas |
| Papel blanco imprimible | 32.76 cm² | 6 frentes |
| Cordón fino flexible | 445.28 mm | 6 cortes, 512.07 mm con margen del 15 % |

Las cajas sustituyen el despiece inicial de seis caras. La lista de compra usa las mismas hojas de cartón y papel de la maqueta y añade una presentación de cordón de 1 m. Para la primera prueba física, presenta un par en seco, comprueba la rigidez de las ménsulas, el pliegue de las pestañas con el cartón elegido y el diámetro del cordón antes de perforar el muro.
