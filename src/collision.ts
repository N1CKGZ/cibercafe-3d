import { entrance, leaves, leafThickness, leafTip, room, techDoor, technical, waiting, wallParts, walls } from './model.ts';
import type { Model, Point, Rect } from './model.ts';
import { maxX, maxZ, minX, minZ } from './geometry.ts';

export type Obstacle = Rect & { id: string };

export function createObstacles(model: Model, techDoorOpen = true): Obstacle[] {
  const list: Obstacle[] = [];

  // 1. Client stations: desks and chairs
  for (const s of model.stations) {
    list.push({ id: `desk-${s.id}`, ...s.desk });
    list.push({ id: `chair-${s.id}`, ...s.chair });
  }

  // 2. Administration station (reception): desk and chair
  list.push({ id: 'reception-desk', ...model.admin.desk });
  list.push({ id: 'reception-chair', ...model.admin.chair });

  // 3. Waiting furniture
  list.push({ id: 'waiting', ...waiting });

  // 4. Technical room equipment (rack)
  list.push({ id: 'rack', ...technical.rack });

  // 5. Solid walls (ground level parts)
  for (const w of walls) {
    for (const p of wallParts(w)) {
      if (p.bottom === 0) {
        list.push({ id: `wall-${w.id}`, ...p.rect });
      }
    }
  }

  // 6. Door leaves
  for (const leaf of leaves) {
    if (leaf.door === entrance.id) {
      // Main entrance leaves modeled open at 90 deg
      const tip = leafTip(leaf, Math.PI / 2);
      list.push({
        id: leaf.id,
        x: leaf.hinge.x,
        z: (tip.z + leaf.hinge.z) / 2,
        w: leafThickness,
        d: leaf.width,
      });
    } else if (leaf.door === techDoor.id) {
      if (techDoorOpen) {
        // Technical door open at 90 deg
        const tip = leafTip(leaf, Math.PI / 2);
        list.push({
          id: leaf.id,
          x: leaf.hinge.x,
          z: (tip.z + leaf.hinge.z) / 2,
          w: leafThickness,
          d: leaf.width,
        });
      } else {
        // Technical door closed: spans across doorway from techDoor.start to techDoor.end at z = technical.z
        list.push({
          id: leaf.id,
          x: (techDoor.start + techDoor.end) / 2,
          z: technical.z,
          w: techDoor.end - techDoor.start,
          d: leafThickness,
        });
      }
    }
  }

  return list;
}

export function checkCollision(px: number, pz: number, radius = 0.22, obstacles: Obstacle[]): boolean {
  // Outdoor boundary / apron check in front of entrance
  // Front wall is at z = room.d - room.wall / 2 = 9.93. Entrance opening is from 4.35 to 6.05.
  if (pz > room.d - room.wall / 2) {
    // Visitor is outside in front of entrance: must stay on entry apron
    if (px < entrance.start + radius || px > entrance.end - radius || pz > 11.2) {
      return true;
    }
  }

  // Check against all physical obstacles
  for (const obs of obstacles) {
    const cx = Math.max(minX(obs), Math.min(px, maxX(obs)));
    const cz = Math.max(minZ(obs), Math.min(pz, maxZ(obs)));
    const dx = px - cx;
    const dz = pz - cz;
    if (dx * dx + dz * dz < radius * radius - 1e-6) {
      return true;
    }
  }

  return false;
}

export function stepMovement(current: Point, delta: Point, radius: number, obstacles: Obstacle[]): Point {
  const dist = Math.hypot(delta.x, delta.z);
  if (dist < 1e-8) return { x: current.x, z: current.z };

  // Sub-stepping to prevent tunneling and ensure buttery-smooth wall sliding
  const maxSubStep = 0.05; // 5 cm max sub-step
  const steps = Math.max(1, Math.ceil(dist / maxSubStep));
  const subX = delta.x / steps;
  const subZ = delta.z / steps;

  let x = current.x;
  let z = current.z;

  for (let i = 0; i < steps; i++) {
    // Axis-independent resolution allows effortless sliding along walls and desks
    if (!checkCollision(x + subX, z, radius, obstacles)) {
      x += subX;
    }
    if (!checkCollision(x, z + subZ, radius, obstacles)) {
      z += subZ;
    }
  }

  return { x, z };
}

export function isNearTechDoor(position: Point, threshold = 2.0): boolean {
  const doorCenterX = (techDoor.start + techDoor.end) / 2;
  const doorCenterZ = technical.z;
  return Math.hypot(position.x - doorCenterX, position.z - doorCenterZ) <= threshold;
}

export function getZoneName(px: number, pz: number): string {
  if (pz > room.d - room.wall / 2) return 'Entrada principal';
  if (px >= technical.x - 0.05 && pz <= technical.z + 0.05) {
    if (px >= 8.8 && pz <= 2.2) return 'Cuarto técnico · RACK-01 y Servidor Mac mini';
    return 'Cuarto técnico';
  }
  if (px <= 2.2 && pz >= 8.4) return 'Recepción · ADM-01';
  if (px >= 7.0 && pz >= 8.4) return 'Área de espera';
  if (px >= 4.4 && px <= 5.8) {
    if (pz <= 1.5) return 'Corredor central (Fila 1)';
    if (pz <= 3.3) return 'Corredor central · Acceso a cuarto técnico';
    if (pz <= 5.5) return 'Corredor central (Filas 3-4)';
    return 'Corredor central (Fila 5)';
  }
  if (px < 4.4) return 'Estaciones cliente (Bloque izquierdo)';
  return 'Estaciones cliente (Bloque derecho)';
}
