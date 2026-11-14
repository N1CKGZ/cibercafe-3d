import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { condenserMount, climateFit, climatePairs, climatePipes, climateUnits, wallPoint } from './climate.ts';
import { room } from './model.ts';
import type { ComponentKind } from './maquette.ts';

const f = climateFit;
const body = 0xf3f3ef;
const trim = 0xb6bcbf;
const dark = 0x252e34;
const gray = 0x727f84;
const bracketGray = 0x516168;

export function climateView() {
  const materials = new Map<number, T.MeshStandardMaterial>();
  const box = new T.BoxGeometry(1, 1, 1);
  const disk = new T.CylinderGeometry(1, 1, 1, 32);
  const rings = [0.63, 0.93].map(radius => new T.TorusGeometry(radius, f.grilleTubeRatio, 6, 32));
  const pipeGeometry = new T.CylinderGeometry(f.pipeRadius, f.pipeRadius, 1, 8);
  const upright = new T.Vector3(0, 1, 0);
  function mesh(parent: T.Group, geometry: T.BufferGeometry, color: number) {
    let material = materials.get(color);
    if (!material) {
      material = new T.MeshStandardMaterial({ color, roughness: 0.85 });
      materials.set(color, material);
    }
    const part = new T.Mesh(geometry, material);
    Object.assign(part.userData, parent.userData);
    part.castShadow = part.receiveShadow = true;
    parent.add(part);
    return part;
  }
  function block(parent: T.Group, w: number, h: number, d: number, x: number, y: number, z: number, color: number) {
    const part = mesh(parent, box, color);
    part.scale.set(w, h, d);
    part.position.set(x, y, z);
    return part;
  }
  const groups = climatePairs.map(pair => {
    const group = new T.Group();
    group.userData.climatePair = pair.key;
    const { indoor, outdoor } = climateUnits(pair);
    function cabinet(unit: typeof indoor | typeof outdoor, exterior: boolean) {
      const fixture = new T.Group();
      fixture.userData = { materialKind: unit.kind satisfies ComponentKind, materialId: unit.id, keepMaterial: true };
      const { x, y, z } = wallPoint(pair, unit.along, unit.bottom + unit.h / 2, unit.normal);
      fixture.position.set(x, y, z);
      fixture.rotation.y = (pair.axis === 'z' ? Math.PI / 2 : 0) + (exterior ? Math.PI : 0);
      group.add(fixture);
      const geometry = new RoundedBoxGeometry(unit.w, unit.h, unit.d, 1, exterior ? 0.009 : 0.035);
      mesh(fixture, geometry, body);
      return fixture;
    }
    const a = cabinet(indoor, false);
    const front = indoor.d / 2;
    block(a, indoor.w * f.outletWidth, indoor.h * f.outletHeight, 0.012,
      0, -indoor.h * 0.30, front - 0.001, gray);
    block(a, indoor.w * 0.79, 0.013, 0.009, 0, -indoor.h * 0.31, front + 0.008, dark);
    block(a, indoor.w * 0.91, 0.065, 0.014, 0, -indoor.h / 2 - 0.014, -indoor.d / 2 + 0.007, trim);

    const b = cabinet(outdoor, true);
    const r = outdoor.h * f.fanRadius;
    const fanX = outdoor.w * f.fanCenterX;
    const face = outdoor.d / 2;
    const circle = (radius: number, thickness: number, z: number, color: number) => {
      const part = mesh(b, disk, color);
      part.rotation.x = Math.PI / 2;
      part.scale.set(radius, thickness, radius);
      part.position.set(fanX, 0, z);
    };
    block(b, outdoor.w * 0.96, outdoor.h * 0.94, 0.010, 0, 0, face + 0.002, 0xe0e5e5);
    circle(r, 0.012, face + 0.012, dark);
    for (let i = 0; i < f.blades; i++) {
      const angle = i * Math.PI * 2 / f.blades;
      const blade = block(b, r * 0.23, r * 0.62, 0.008,
        fanX + Math.sin(angle) * r * 0.47, Math.cos(angle) * r * 0.47, face + 0.023, 0xa0adb1);
      blade.rotation.z = -angle + 0.43;
    }
    circle(r * 0.22, 0.011, face + 0.028, trim);
    for (const geometry of rings) {
      const grille = mesh(b, geometry, 0x63767b);
      grille.scale.setScalar(r);
      grille.position.set(fanX, 0, face + f.grilleOffset);
    }
    const mount = condenserMount(outdoor);
    for (const x of mount.centers) {
      for (const part of [mount.armBox, mount.wallBox]) {
        block(b, mount.width, part.h, part.d, x, part.y, part.z, bracketGray);
      }
    }
    const pipes = new T.Group();
    pipes.userData = b.userData;
    group.add(pipes);
    for (const [index, points] of climatePipes(pair).entries()) {
      const color = index === 0 ? 0xa9734e : 0x687d86;
      for (const [i, point] of points.slice(1).entries()) {
        const from = new T.Vector3().copy(points[i]);
        const to = new T.Vector3().copy(point);
        const delta = to.clone().sub(from);
        const part = mesh(pipes, pipeGeometry, color);
        part.position.copy(from).lerp(to, 0.5);
        part.scale.y = delta.length() + f.pipeRadius * 0.35;
        part.quaternion.setFromUnitVectors(upright, delta.normalize());
      }
    }
    return group;
  });
  return groups;
}

export function climateCamera(key: string, mode: 'minisplit' | 'condenser' | 'pair') {
  const pair = climatePairs.find(pair => pair.key === key)!;
  const units = climateUnits(pair);
  const unit = mode === 'minisplit' ? units.indoor : units.outdoor;
  const both = mode === 'pair';
  const target = wallPoint(pair, both ? (units.indoor.along + units.outdoor.along) / 2 : unit.along,
    both ? 1.65 : unit.bottom + unit.h / 2 - (mode === 'condenser' ? 0.13 : 0), both ? room.wall / 2 : unit.normal);
  const offset = wallPoint(pair, both ? -8 : mode === 'condenser' ? 7 : 3.5, both ? 6 : mode === 'condenser' ? 1.5 : 3.6, mode === 'minisplit' ? 12 : both ? -9 : -12);
  return { target, offset, wall: pair.wall, pair: pair.key, cutaway: both,
    halfHeight: both ? 1.20 : mode === 'condenser' ? 0.56 : 0.46 };
}
