# Ajuste geométrico de la planta

A2 mantiene las cinco filas, sus 25 puestos y la geometría del local. Cada fila se divide en bloques de tres y dos mesas y deja un corredor central de 1.30 m. El mostrador se mueve 0.07 m hacia la fachada para mejorar la aproximación a PC-21. Los accesos, la sala de espera y el cuarto técnico conservan su posición.

## Cotas y prueba de circulación

Las mesas cliente miden 1.00 × 0.50 m y tienen 0.75 m de alto. El paso entre ejes de fila es 1.78 m, con 1.28 m de borde a borde. La envolvente en planta de cada silla tiene 0.53 m de ancho y sobresale del borde de mesa 0.30 m recogida, 0.55 m ocupada y 0.65 m retirada de la mesa. «Retirada» representa el gesto de desplazar la silla hacia el pasillo para sentarse o levantarse. Esa posición consume 0.10 m más de paso que la ocupada. Las envolventes son supuestos de uso que deben cotejarse con el mobiliario elegido.

| Medición en metros | A, recogidas / ocupadas / retiradas | A2, recogidas / ocupadas / retiradas |
| --- | --- | --- |
| Cota libre entre filas | 0.98 / 0.73 / 0.63 | 0.98 / 0.73 / 0.63 |
| Ruta principal desde el umbral hasta el sector de la segunda fila | 0.95 / 0.70 / 0.60 | 1.275 / 1.275 / 1.275 |
| Mínimo entre las mejores rutas a los 25 puestos | 0.75 / 0.70 / 0.60 | 0.75 / 0.70 / 0.60 |
| Ruta a recepción | 0.75 / 0.70 / 0.60 | 0.775 / 0.725 / 0.625 |
| Ruta al cuarto técnico | 0.75 / 0.70 / 0.60 | 0.75 / 0.70 / 0.625 |
| Ruta al área de servicio del rack | 0.75 / 0.70 / 0.60 | 0.75 / 0.70 / 0.625 |
| Puestos con ruta de al menos 0.60 m | 25 / 25 / 25 | 25 / 25 / 25 |

La ruta principal de A va del umbral al sector lateral izquierdo a la altura de la segunda fila. La de A2 llega por el centro al mismo sector longitudinal. Para cada destino, el visor busca la ruta que admite el cuadrado más ancho en una malla de 0.025 m. El resultado se cuantiza hacia abajo en pasos de 0.025 m. Las rutas se pueden recorrer en ambos sentidos con las puertas abiertas a 90° y terminan en la zona de aproximación del puesto. El modelo usa rectángulos en planta y verifica el barrido de las hojas por separado. El criterio de 0.60 m permite comparar escenarios. La comodidad, el uso simultáneo, los espacios de giro y la conformidad para uso comercial requieren otra validación.

## Puntos críticos y decisiones

Coordenadas en metros desde la esquina exterior posterior izquierda, con x hacia la derecha y z hacia la entrada. El visor marca un punto de anchura mínima de la ruta elegida. Cuando varios pasos empatan, muestra uno de ellos.

- **Corredor principal A.** Con sillas ocupadas, el punto marcado está en x = 1.25, z = 6.95, cerca de la esquina de PC-21 y del giro para rodear las filas.
- **Corredor principal A2.** El punto marcado está en x = 5.10, z = 2.20, junto a PC-09. La franja continua queda entre x = 4.44 y x = 5.74.
- **Acceso a los puestos A2.** Ejemplo con silla retirada en x = 1.70, z = 1.65, entre la silla de PC-01 y la mesa de PC-06. El mínimo estimado de 0.60 m queda justo en el umbral de ensayo.
- **Recepción y cuarto A2.** Con sillas retiradas, sus rutas se estrechan cerca del extremo de PC-11 (x = 0.90, z = 3.43) y de PC-15 (x = 8.18, z = 3.43), respectivamente. La separación de 0.07 m entre las mesas del bloque derecho y el tabique es espacio residual. La ruta técnica llega a la puerta por delante del cuarto.
- **Puertas y colisiones.** El vano principal de 1.70 m deja aproximadamente 1.66 m con ambas hojas abiertas. El vano técnico de 0.80 m deja unos 0.78 m con la hoja abierta. En A y A2 no se detectaron solapes de mobiliario, interferencias con el área de servicio ni cruces con el barrido modelado de las hojas en los tres estados. Queda por confirmar la luz con herrajes y el espacio de maniobra del rack con su equipo real.

A2 es la distribución principal aprobada y la referencia para la maqueta. A 1:25, el corredor central mide **52 mm** y el espacio libre nominal entre filas con sillas ocupadas, **29.2 mm**. Probar primero una fila de cada bloque, el mostrador y las dos puertas con piezas móviles. Comprobar el fondo útil para monitor, teclado y brazos, el desplazamiento de la silla y los giros en recepción y cuarto. Ampliar también los accesos individuales exigiría revisar el fondo de mesa, la envolvente de silla o la organización de filas. Separar todas las filas sin despejar la entrada ya produjo interferencias en la variante B.
