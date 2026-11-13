import assert from 'node:assert/strict';
import test from 'node:test';
import { chairStates, createModel, entrance, leaves, leafThickness, room, techDoor, technical, waiting, wallParts, walls } from '../src/model.ts';
import { checkCollision, createObstacles, getZoneName, isNearTechDoor, stepMovement } from '../src/collision.ts';

const VISITOR_RADIUS = 0.22; // Physical collision radius in meters
const EYE_HEIGHT = 1.65; // Camera eye height in meters

test('el volumen de colisión y los obstáculos físicos incluyen todos los elementos requeridos', () => {
  const model = createModel('compactA2', 'occupied');
  const obstacles = createObstacles(model, true);

  // 25 escritorios + 25 sillas + recepción (mostrador + silla) + espera + rack + muros + hojas de puerta
  assert.equal(obstacles.filter(o => o.id.startsWith('desk-PC-')).length, 25);
  assert.equal(obstacles.filter(o => o.id.startsWith('chair-PC-')).length, 25);
  assert.ok(obstacles.some(o => o.id === 'reception-desk'));
  assert.ok(obstacles.some(o => o.id === 'reception-chair'));
  assert.ok(obstacles.some(o => o.id === 'waiting'));
  assert.ok(obstacles.some(o => o.id === 'rack'));
  assert.ok(obstacles.some(o => o.id.startsWith('wall-')));
  assert.ok(obstacles.length >= 80, `Cantidad de obstáculos insuficiente: ${obstacles.length}`);
});

test('la puerta técnica cerrada impide el paso y abierta permite el ingreso', () => {
  const model = createModel('compactA2', 'occupied');
  const openObstacles = createObstacles(model, true);
  const closedObstacles = createObstacles(model, false);

  const doorCenter = { x: (techDoor.start + techDoor.end) / 2, z: technical.z };

  // Puerta cerrada debe colisionar con el volumen del visitante
  assert.equal(checkCollision(doorCenter.x, doorCenter.z, VISITOR_RADIUS, closedObstacles), true,
    'La puerta técnica cerrada debe bloquear el paso');

  // Puerta abierta debe permitir el paso sin colisión
  assert.equal(checkCollision(doorCenter.x, doorCenter.z, VISITOR_RADIUS, openObstacles), false,
    'La puerta técnica abierta debe permitir el paso');
});

test('los muros y el mobiliario impiden ser atravesados', () => {
  const model = createModel('compactA2', 'occupied');
  const obstacles = createObstacles(model, true);

  // Dentro del muro posterior
  assert.equal(checkCollision(5.0, 0.07, VISITOR_RADIUS, obstacles), true);
  // Dentro del mostrador de recepción
  assert.equal(checkCollision(model.admin.desk.x, model.admin.desk.z, VISITOR_RADIUS, obstacles), true);
  // Dentro del rack
  assert.equal(checkCollision(technical.rack.x, technical.rack.z, VISITOR_RADIUS, obstacles), true);
  // Dentro del mobiliario de espera
  assert.equal(checkCollision(waiting.x, waiting.z, VISITOR_RADIUS, obstacles), true);
  // Dentro de un escritorio de estación cliente
  assert.equal(checkCollision(model.stations[0].desk.x, model.stations[0].desk.z, VISITOR_RADIUS, obstacles), true);
});

test('el visitante navega las 9 etapas del recorrido sin bloqueos artificiales', () => {
  const model = createModel('compactA2', 'occupied');
  const obstacles = createObstacles(model, true);

  // 1. Comenzar frente a la entrada principal (altura de cámara 1.65 m)
  assert.equal(EYE_HEIGHT, 1.65);
  const startPos = { x: (entrance.start + entrance.end) / 2, z: 10.80 };
  assert.equal(checkCollision(startPos.x, startPos.z, VISITOR_RADIUS, obstacles), false,
    'El punto de inicio frente a la entrada principal debe estar libre');

  // 2. Entrar al cibercafé cruzando la fachada
  const insideEntry = stepMovement(startPos, { x: 0, z: -1.8 }, VISITOR_RADIUS, obstacles);
  assert.ok(insideEntry.z <= 9.10, 'El visitante debe cruzar el vano de entrada hacia el interior');

  // 3. Caminar por el corredor central
  const waypoints = [
    { x: 5.09, z: 8.5 },
    { x: 5.09, z: 6.5 },
    { x: 5.09, z: 4.5 },
    { x: 5.09, z: 3.38 },
  ];
  for (const wp of waypoints) {
    assert.equal(checkCollision(wp.x, wp.y ?? wp.z, VISITOR_RADIUS, obstacles), false,
      `Punto del corredor central (${wp.x}, ${wp.z}) debe ser transitable`);
  }

  // 4. Acercarse a computadoras (lado izquierdo y derecho en pasillo)
  assert.equal(checkCollision(4.45, 5.0, VISITOR_RADIUS, obstacles), false);
  assert.equal(checkCollision(5.70, 5.0, VISITOR_RADIUS, obstacles), false);

  // 5. Llegar al cuarto técnico a través del pasillo libre z = 3.38
  for (let x = 5.09; x <= 8.75; x += 0.5) {
    assert.equal(checkCollision(x, 3.38, VISITOR_RADIUS, obstacles), false,
      `Punto hacia el cuarto técnico en x=${x} debe ser transitable`);
  }

  // 6. Proximidad a la puerta técnica
  const beforeDoor = { x: 8.75, z: 3.38 };
  assert.ok(isNearTechDoor(beforeDoor), 'Debe detectarse proximidad a la puerta técnica');

  // 7. Entrar al cuarto técnico con la puerta abierta
  const inDoorway = { x: 8.75, z: 3.00 };
  assert.equal(checkCollision(inDoorway.x, inDoorway.z, VISITOR_RADIUS, obstacles), false);
  const insideTechRoom = { x: 8.65, z: 1.70 };
  assert.equal(checkCollision(insideTechRoom.x, insideTechRoom.z, VISITOR_RADIUS, obstacles), false,
    'El área de observación del rack debe ser transitable');

  // 8. Observar el servidor y el rack desde el punto de observación
  const distToRack = Math.hypot(insideTechRoom.x - technical.rack.x, insideTechRoom.z - technical.rack.z);
  assert.ok(distToRack > VISITOR_RADIUS && distToRack < 1.5,
    'El visitante debe estar a distancia visual adecuada del rack');
});

test('la determinación de zonas activas identifica correctamente los espacios sin etiquetas flotantes', () => {
  // Entrada principal
  assert.equal(getZoneName(5.2, 10.8), 'Entrada principal');
  // Corredor central y derivaciones
  assert.equal(getZoneName(5.1, 8.5), 'Corredor central (Fila 5)');
  assert.equal(getZoneName(5.1, 5.0), 'Corredor central (Filas 3-4)');
  assert.equal(getZoneName(5.1, 3.2), 'Corredor central · Acceso a cuarto técnico');
  assert.equal(getZoneName(5.1, 1.0), 'Corredor central (Fila 1)');
  // Recepción
  assert.equal(getZoneName(1.1, 9.2), 'Recepción · ADM-01');
  // Espera
  assert.equal(getZoneName(8.5, 9.2), 'Área de espera');
  // Cuarto técnico y rack
  assert.equal(getZoneName(8.5, 2.8), 'Cuarto técnico');
  assert.equal(getZoneName(9.0, 1.7), 'Cuarto técnico · RACK-01 y Servidor Mac mini');
  // Bloques de mesas
  assert.equal(getZoneName(2.5, 4.0), 'Estaciones cliente (Bloque izquierdo)');
  assert.equal(getZoneName(6.8, 4.0), 'Estaciones cliente (Bloque derecho)');
});
