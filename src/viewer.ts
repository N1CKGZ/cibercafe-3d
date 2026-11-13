import * as T from 'three';
import { displayBase, hvacPieces, models, projectedY, scale } from './maquette.ts';
import type { ComponentKind } from './maquette.ts';
import { floorRegister } from './construction.ts';
import type { PhaseId } from './construction.ts';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { entrance, furniture, leafThickness, leaves, leafTip, rackHeight, room, server, study, techDoor, technical, waiting, wallParts, walls } from './model.ts';
import type { Model, Point, Rect } from './model.ts';
import { maxX, maxZ, meters, minX, minZ, service } from './geometry.ts';
import type { Passage } from './geometry.ts';
import { devicePorts, rackDevices, sectionSize, serverPosition } from './network.ts';
import type { Network, NetworkPoint } from './network.ts';
import { portMap, trunkColor, vlans } from './network-design.ts';
import type { PortPair } from './network-design.ts';
import { createObstacles, getZoneName, isNearTechDoor, stepMovement } from './collision.ts';
import type { Obstacle } from './collision.ts';

type CameraView = 'iso' | 'top' | 'rack';
type Inspection = ReturnType<typeof import('./geometry.ts').inspect>;
type Label = { element: HTMLSpanElement; point: T.Vector3 };
type NetworkView = { enabled: boolean; ducts: boolean; cables: boolean; outlets: boolean; showAll: boolean;
  logical: boolean; equipmentLabels: boolean; equipment: string; ports: PortPair; selected?: string };
const colors = {
  wall: 0xe5eaf0, glass: 0x83b8c7, floor: 0xe6e0d2, base: 0x41546a,
  table: 0xb58555, legs: 0x5b5b61, seat: 0x374c64, screen: 0x345d7f,
  pc: 0x243145, deskMark: 0x5083b9, chairMark: 0x9b60c1, pass: 0x329d81,
  warn: 0xce8d42, route: 0x08665b, blocked: 0xaa3f33, door: 0xb88048, service: 0x3c899b,
};

function resolveEquipmentId(obj: T.Object3D | null): string | null {
  let cur: T.Object3D | null = obj;
  while (cur && cur.type !== 'Scene') {
    if (cur.name && (
      cur.name.startsWith('PC-') ||
      cur.name === 'ADM-01' ||
      cur.name === 'SRV-01' ||
      cur.name === 'RACK-01' ||
      cur.name === 'PP-01' ||
      cur.name === 'SW-01' ||
      cur.name === 'RTR-01' ||
      cur.name === 'ONT-01'
    )) {
      return cur.name;
    }
    cur = cur.parent;
  }
  return null;
}

export function createViewer(
  container: HTMLElement,
  labelLayer: HTMLElement,
  onPassage: (id: string) => void,
  onEquipment: (id: string, port?: number) => void,
  onTourState?: (active: boolean, locked: boolean) => void,
  onDoorState?: (open: boolean) => void,
  onZoneState?: (zone: string) => void,
  onInspectTarget?: (target: string | null) => void,
  onOpenFicha?: (targetId: string) => void,
) {
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xdce6ef);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.setAttribute('aria-label', 'Modelo 3D del cibercafé');

  // Wrap requestPointerLock so sandboxed environments without pointer-lock permissions do not trigger unhandled promise rejections
  const origRequestPointerLock = renderer.domElement.requestPointerLock?.bind(renderer.domElement);
  if (origRequestPointerLock) {
    renderer.domElement.requestPointerLock = function (options?: PointerLockOptions): Promise<void> {
      try {
        const res = origRequestPointerLock(options);
        if (res && typeof res.catch === 'function') {
          return res.catch(() => {});
        }
        return Promise.resolve();
      } catch {
        return Promise.resolve();
      }
    };
  }

  container.prepend(renderer.domElement);

  const scene = new T.Scene();
  const architecture = new T.Group();
  const objects = new T.Group();
  const zones = new T.Group();
  const annotations = new T.Group();
  const highlight = new T.Group();
  const networkGroup = new T.Group();
  const maquetteExtras = new T.Group();
  const guideExtras = new T.Group();
  scene.add(guideExtras);
  let guidePhase: PhaseId | null = null;
  let registerOpen = false;
  const guideVisibility = new Map<T.Object3D, boolean>();
  let guideNetwork: Network | undefined;
  maquetteExtras.visible = false;
  let isMaquette = false;
  let onMaterial: ((kind: ComponentKind, id: string) => void) | undefined;
  const technicalMaterials = new Map<T.Mesh, T.Material | T.Material[]>();
  const networkLayer = container.querySelector('#network-labels')!;
  scene.add(architecture, objects, zones, annotations, highlight, networkGroup, maquetteExtras);

  const camera = new T.OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minZoom = 0.58;
  controls.maxZoom = 4;
  controls.maxPolarAngle = Math.PI / 2 - 0.09;
  let view: CameraView = 'iso';

  // First-person walkthrough camera & controls (70 deg FOV, eye height 1.65m)
  const eyeHeight = 1.65;
  const fpCamera = new T.PerspectiveCamera(70, 1, 0.1, 50);
  const fpControls = new PointerLockControls(fpCamera, renderer.domElement);
  const startPosition = new T.Vector3((entrance.start + entrance.end) / 2, eyeHeight, 10.80);
  const startLookTarget = new T.Vector3(startPosition.x, eyeHeight, 5.0);

  let isTour = false;
  let currentLookTarget: string | null = null;
  let techDoorOpen = true;
  let currentModel: Model | undefined;
  let activeObstacles: Obstacle[] = [];
  let userDimensions = true;
  let userCirculation = true;

  const moveKeys = { forward: false, backward: false, left: false, right: false, shift: false };
  function onKeyDown(e: KeyboardEvent) {
    if (!isTour) return;
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        moveKeys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        moveKeys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        moveKeys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        moveKeys.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        moveKeys.shift = true;
        break;
      case 'KeyE':
        if (isNearTechDoor({ x: fpCamera.position.x, z: fpCamera.position.z }, 2.5)) {
          toggleTechDoor();
        }
        break;
      case 'KeyF':
        if (currentLookTarget) {
          onOpenFicha?.(currentLookTarget);
        }
        break;
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        moveKeys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        moveKeys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        moveKeys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        moveKeys.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        moveKeys.shift = false;
        break;
    }
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  fpControls.addEventListener('lock', () => {
    onTourState?.(true, true);
  });
  fpControls.addEventListener('unlock', () => {
    if (isTour) {
      onTourState?.(true, false);
    }
  });

  let labels: Label[] = [];
  let networkLabels: Label[] = [];
  let picks: T.Mesh[] = [];
  const upperWalls: T.Mesh[] = [];
  const ghostWalls: T.Mesh[] = [];
  const rackForeground: T.Mesh[] = [];

  const sunlight = new T.DirectionalLight(0xfff4dc, 2.25);
  sunlight.position.set(-3, 15, 4);
  sunlight.target.position.set(room.w / 2, 0, room.d / 2);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1536, 1536);
  Object.assign(sunlight.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 35 });
  sunlight.shadow.normalBias = 0.025;
  scene.add(sunlight, sunlight.target, new T.HemisphereLight(0xf5f9ff, 0x68798a, 1.85));

  const unitBox = new T.BoxGeometry();
  const unitPlane = new T.PlaneGeometry();
  const selectedCable = new T.MeshBasicMaterial({ color: 0x006ee6 });
  const solids = new Map<number, T.MeshStandardMaterial>();
  function solid(color: number) {
    if (!solids.has(color)) solids.set(color, new T.MeshStandardMaterial({ color, roughness: 0.83 }));
    return solids.get(color)!;
  }
  function box(group: T.Group, r: Rect, bottom: number, h: number, color: number, material?: T.Material) {
    const mesh = new T.Mesh(unitBox, material ?? solid(color));
    mesh.position.set(r.x, bottom + h / 2, r.z);
    mesh.scale.set(r.w, h, r.d);
    mesh.castShadow = !material;
    mesh.receiveShadow = !material;
    group.add(mesh);
    return mesh;
  }

  const paperColors: Record<ComponentKind, number> = {
    computer: 0x26262d, monitor: 0x22232b, tower: 0x252633, keyboard: 0x3b3d45, mouse: 0x3b3d45,
    desk: 0xbf9259, counter: 0xbf9259, chair: 0x46574f, wall: 0xf3ebdd, window: 0xa3ccdb, door: 0xa8764c,
    rack: 0x4a4140, server: 0xbec0bd, cable: 0x205aca, duct: 0xc2915c,
    minisplit: 0xf1e5d0, condenser: 0xd6ba9d,
  };
  const paperGlass = new T.MeshStandardMaterial({ color: paperColors.window, transparent: true, opacity: 0.45, depthWrite: false });
  const paperCutaway = new T.MeshStandardMaterial({ color: paperColors.wall, transparent: true, opacity: 0.30, depthWrite: false });
  function applyPaper(mesh: T.Mesh) {
    const kind = mesh.userData.materialKind as ComponentKind;
    if (!isMaquette || !kind) return;
    if (!technicalMaterials.has(mesh)) technicalMaterials.set(mesh, mesh.material);
    mesh.material = kind === 'window' ? paperGlass
      : kind === 'wall' && ghostWalls.includes(mesh) && view !== 'top' ? paperCutaway
      : solid(mesh.userData.paperColor ?? paperColors[kind]);
  }
  function tag(mesh: T.Mesh, kind: ComponentKind, id: string, paperColor?: number) {
    Object.assign(mesh.userData, { materialKind: kind, materialId: id, paperColor });
    applyPaper(mesh);
    return mesh;
  }
  function restoreMaterials() {
    for (const [mesh, material] of technicalMaterials) mesh.material = material;
    technicalMaterials.clear();
  }

  const footprint = { x: room.w / 2, z: room.d / 2, w: room.w, d: room.d };
  // BoxGeometry orders the faces +X, -X, +Y, -Y, +Z, -Z. The floor
  // is the slab's top face, with no second surface at the same depth.
  const base = solid(colors.base);
  const slab = new T.Mesh(unitBox, [base, base, solid(colors.floor), base, base, base]);
  slab.position.set(footprint.x, -room.slab / 2, footprint.z);
  slab.scale.set(footprint.w, room.slab, footprint.d);
  slab.castShadow = slab.receiveShadow = true;
  architecture.add(slab);
  const displaySlab = box(maquetteExtras, { ...footprint, w: displayBase.width * scale, d: displayBase.depth * scale },
    -room.slab - displayBase.thickness * scale, displayBase.thickness * scale, 0xab8054);
  for (const piece of hvacPieces) {
    tag(box(maquetteExtras, piece, piece.y, piece.h, paperColors[piece.kind]), piece.kind, piece.id);
  }
  const grid = new T.GridHelper(28, 28, 0xa9bbca, 0xbfcddb);
  grid.position.set(room.w / 2, -room.slab - 0.005, room.d / 2);
  architecture.add(grid);
  const glass = new T.MeshStandardMaterial({ color: colors.glass, transparent: true, opacity: 0.36, depthWrite: false });
  const ghost = new T.MeshStandardMaterial({ color: colors.wall, transparent: true, opacity: 0.30, depthWrite: false });
  for (const wall of walls) {
    for (const part of wallParts(wall)) {
      const near = ['Frente', 'Derecho', 'Cuarto lateral', 'Cuarto frontal'].includes(wall.id);
      const rect = part.glass ? { ...part.rect, [wall.axis === 'x' ? 'd' : 'w']: 0.035 } : part.rect;
      const mesh = box(architecture, rect, part.bottom, part.top - part.bottom, colors.wall, part.glass ? glass : undefined);
      if (near && !part.glass) ghostWalls.push(mesh);
      const window = part.glass && wall.openings.find(o => (o.start + o.end) / 2 === (wall.axis === 'x' ? rect.x : rect.z));
      tag(mesh, window ? 'window' : 'wall', window ? window.id : wall.id);
      if (part.bottom > 0) upperWalls.push(mesh);
      if (wall.id === 'Cuarto frontal') rackForeground.push(mesh);
    }
  }
  const techDoorPivot = new T.Group();
  techDoorPivot.position.set(techDoor.start, 0, technical.z);
  architecture.add(techDoorPivot);
  const techDoorMeshes: T.Mesh[] = [];

  for (const leaf of leaves) {
    const material = leaf.door === entrance.id ? glass : ghost;
    if (leaf.door === techDoor.id) {
      const localRect: Rect = { x: leaf.width / 2, z: 0, w: leaf.width, d: leafThickness };
      const pane = box(techDoorPivot, localRect, 0, leaf.height, colors.door, material);
      const rail = box(techDoorPivot, localRect, 0, 0.045, colors.door);
      tag(pane, 'door', leaf.id);
      tag(rail, 'door', leaf.id);
      rackForeground.push(pane, rail);
      techDoorMeshes.push(pane, rail);
      pane.userData.isTechDoor = true;
      rail.userData.isTechDoor = true;
    } else {
      const tip = leafTip(leaf, Math.PI / 2);
      const rect = { x: leaf.hinge.x, z: (tip.z + leaf.hinge.z) / 2, w: leafThickness, d: leaf.width };
      tag(box(architecture, rect, 0, leaf.height, colors.door, material), 'door', leaf.id);
      tag(box(architecture, rect, 0, 0.045, colors.door), 'door', leaf.id);
    }
  }
  // Initialize open at 90 deg (matching baseline anteproyecto)
  techDoorPivot.rotation.y = Math.PI / 2;

  function setTechDoor(open: boolean) {
    techDoorOpen = open;
    techDoorPivot.rotation.y = open ? Math.PI / 2 : 0;
    if (currentModel) {
      activeObstacles = createObstacles(currentModel, techDoorOpen);
    }
    renderer.shadowMap.needsUpdate = true;
    onDoorState?.(techDoorOpen);
  }

  function toggleTechDoor() {
    setTechDoor(!techDoorOpen);
    return techDoorOpen;
  }
  box(architecture, waiting, 0.13, 0.34, colors.seat);
  box(architecture, { ...waiting, z: maxZ(waiting) - 0.07, d: 0.14 }, 0.44, 0.40, colors.seat);
  const rack = technical.rack;
  const rackMeshes = [box(architecture, rack, 0, rackHeight, colors.pc)];
  rackMeshes[0].name = 'RACK-01';
  tag(rackMeshes[0], 'rack', 'RACK-01');
  for (const [key, device] of Object.entries(rackDevices)) {
    const { x, y, z } = device.point;
    const color = { panel: 0x59687b, switch: 0x2c5261, router: 0x4b4c69, ont: 0xadb9c4 }[key]!;
    const face = box(architecture, { x, z, w: device.w, d: 0.015 }, y - device.h / 2, device.h, color);
    face.name = device.id;
    tag(face, 'rack', 'RACK-01', color);
    rackMeshes.push(face);
    for (const [index, port] of devicePorts(device).entries()) {
      const jack = box(architecture, { ...port, w: 0.011, d: 0.002 }, port.y - 0.004, 0.008, 0x102234);
      jack.name = device.id;
      jack.userData.port = index + 1;
      rackMeshes.push(jack);
    }
  }
  box(architecture, { ...serverPosition, w: 0.24, d: 0.20 }, serverPosition.y - 0.025, 0.025, 0x64738a);
  const wallX = room.w - room.wall;
  box(architecture, { x: (wallX + serverPosition.x) / 2, z: serverPosition.z,
    w: wallX - serverPosition.x, d: 0.07 }, serverPosition.y - 0.065, 0.04, 0x64738a);
  const mac = box(architecture, { ...serverPosition, w: server.w, d: server.d }, serverPosition.y, server.height, 0xc9d3dc);
  mac.name = server.id;
  tag(mac, 'server', server.id);
  rackMeshes.push(mac);

  const overlayMaterials = new Map<string, T.MeshBasicMaterial>();
  function plane(group: T.Group, r: Rect, y: number, color: number, opacity: number) {
    const key = `${color}:${opacity}`;
    if (!overlayMaterials.has(key)) overlayMaterials.set(key, new T.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, side: T.DoubleSide,
    }));
    const mesh = new T.Mesh(unitPlane, overlayMaterials.get(key));
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(r.w, r.d, 1);
    mesh.position.set(r.x, y, r.z);
    mesh.renderOrder = 2;
    group.add(mesh);
    return mesh;
  }

  function line(group: T.Group, points: T.Vector3[], color: number, loop = false) {
    const geometry = new T.BufferGeometry().setFromPoints(points);
    const material = new T.LineBasicMaterial({ color });
    const object = loop ? new T.LineLoop(geometry, material) : new T.Line(geometry, material);
    group.add(object);
  }

  function outline(group: T.Group, r: Rect, y: number, color: number) {
    line(group, [
      new T.Vector3(minX(r), y, minZ(r)), new T.Vector3(maxX(r), y, minZ(r)),
      new T.Vector3(maxX(r), y, maxZ(r)), new T.Vector3(minX(r), y, maxZ(r)),
    ], color, true);
  }

  function label(text: string, point: T.Vector3, selected = false) {
    const element = document.createElement('span');
    element.className = selected ? 'model-label selected' : 'model-label';
    element.textContent = text;
    labelLayer.append(element);
    labels.push({ element, point });
  }

  function showNetwork(network: Network, options: NetworkView) {
    guideNetwork = network;
    clear(networkGroup);
    networkLayer.replaceChildren();
    networkLabels = [];
    const addNetworkLabel = (id: string, point: T.Vector3, active = false) => {
      const element = document.createElement('span');
      element.className = active ? 'model-label network selected' : 'model-label network';
      element.textContent = id;
      networkLayer.append(element);
      networkLabels.push({ element, point });
    };
    if (options.equipmentLabels) {
      for (const item of Object.values(rackDevices)) {
        addNetworkLabel(item.id, new T.Vector3(item.point.x + item.w / 2 + 0.09, item.point.y, item.point.z), options.equipment === item.id);
      }
      addNetworkLabel(server.id, new T.Vector3(serverPosition.x, serverPosition.y + 0.13, serverPosition.z), options.equipment === server.id);
      addNetworkLabel('RACK-01', new T.Vector3(rack.x, 0.10, maxZ(rack) + 0.015), options.equipment === 'RACK-01');
    }
    const ports = portMap(network).sw;
    for (const [key, device] of [['panel', rackDevices.panel], ['switch', rackDevices.switch]] as const) {
      for (const [i, p] of devicePorts(device).entries()) {
        const highlighted = options.ports[key] === i + 1;
        const assignment = ports[i];
        if (!highlighted && (!options.logical || key === 'panel' || assignment.mode === 'reserved')) continue;
        const color = highlighted ? 0xffcb45 : assignment.mode === 'trunk' ? trunkColor : vlans[assignment.vlans[0]].color;
        box(networkGroup, { ...p, w: highlighted ? 0.015 : 0.010, d: 0.004 },
          p.y - 0.004, 0.008, color, solid(color));
      }
    }
    if (!options.enabled) return;
    const selected = network.links.find(link => link.id === options.selected);
    const projected = (p: NetworkPoint) => new T.Vector3(p.x, Math.max(p.y, projectedY), p.z);
    const supportMaterial = solid(0x58869b);
    const cableMaterial = solid(0x1266b3);
    const cablePoint = (p: T.Vector3) => p.clone().add(new T.Vector3(0, 0.038, 0.047));
    const joints = new Map<string, { point: T.Vector3; count: number }>();
    function bar(a: T.Vector3, b: T.Vector3, width: number, depth: number, material: T.Material) {
      const delta = b.clone().sub(a);
      const length = delta.length();
      if (length < 1e-8) return;
      const mesh = new T.Mesh(unitBox, material);
      mesh.position.copy(a).lerp(b, 0.5);
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
      mesh.scale.set(width, length, depth);
      networkGroup.add(mesh);
      return mesh;
    }
    for (const duct of network.ducts) {
      const a = projected(duct.from);
      const b = projected(duct.to);
      const [width, depth] = sectionSize[duct.section];
      if (options.ducts) {
        const mesh = bar(a, b, width, depth, supportMaterial);
        if (mesh) {
          tag(mesh, 'duct', duct.id);
          mesh.userData.segment = duct.id;
        }
        for (const p of [a, b]) {
          const key = p.toArray().join(',');
          const joint = joints.get(key) ?? { point: p, count: 0 };
          joint.count++;
          joints.set(key, joint);
        }
      }
      if (options.cables && (options.showAll || selected?.segments.includes(duct))) {
        const thickness = selected ? 0.034 : 0.018;
        const mesh = bar(cablePoint(a), cablePoint(b), thickness, thickness, selected ? selectedCable : cableMaterial);
        if (mesh) {
          tag(mesh, 'cable', selected?.id ?? duct.cables[0]);
          mesh.userData.segment = duct.id;
        }
      }
    }
    for (const { point, count } of joints.values()) {
      if (count < 2) continue;
      box(networkGroup, { ...point, w: 0.092, d: 0.092 }, point.y - 0.025, 0.049,
        0x385970, solid(0x385970));
    }
    if (options.cables && !isMaquette) {
      const panel = devicePorts(rackDevices.panel);
      const ports = devicePorts(rackDevices.switch);
      const patchIndices = view === 'rack' || options.showAll ? network.links.map((_, i) => i)
        : selected ? [network.links.indexOf(selected)] : [];
      for (const index of patchIndices) {
        const a = panel[index];
        const b = ports[index];
        line(networkGroup, [a, { ...a, z: a.z + 0.025 }, { ...b, z: b.z + 0.025 }, b]
          .map(p => new T.Vector3(p.x, p.y, p.z)), 0xd28e37);
      }
      for (const patch of network.localPatches) {
        line(networkGroup, patch.points.map(p => new T.Vector3(p.x, p.y, p.z)), 0xf4ac42);
      }
    }
    for (const link of network.links) {
      const { x, y, z } = link.outletPoint;
      box(networkGroup, { x, z, w: 0.065, d: 0.045 }, y - 0.018, 0.045, 0x355374, solid(0x355374)).name = link.outlet;
      if (options.logical && view !== 'rack') {
        const color = vlans[link.equipment === 'ADM-01' ? 20 : 10].color;
        plane(networkGroup, { x, z, w: 0.32, d: 0.13 }, furniture.deskHeight + 0.008, color, 0.86);
      }
      if (!options.outlets && selected !== link) continue;
      addNetworkLabel(link.outlet, new T.Vector3(x, furniture.deskHeight + 0.42, z), selected === link);
    }
    applyGuide();
  }

  function station(group: T.Group, item: Model['admin'], admin: boolean) {
    const { desk, chair, orientation } = item;
    const isFront = orientation === 0;
    const furnitureGroup = new T.Group();
    furnitureGroup.name = item.id;
    group.add(furnitureGroup);
    const top = furniture.deskHeight;
    const slab = models.desktop.thickness;
    tag(box(furnitureGroup, desk, top - slab, slab, colors.table), admin ? 'counter' : 'desk', item.id);
    for (const x of [minX(desk) + 0.07, maxX(desk) - 0.07]) {
      for (const z of [minZ(desk) + 0.07, maxZ(desk) - 0.07]) {
        tag(box(furnitureGroup, { x, z, w: 0.045, d: 0.045 }, 0, top - slab, colors.legs), admin ? 'counter' : 'desk', item.id, 0x9f794e);
      }
    }
    const x = admin ? chair.x : desk.x;
    const towerSide = admin ? 1 : -1;
    const t = models.tower, m = models.monitor, k = models.keyboard, s = models.seat;
    tag(box(furnitureGroup, { x: x + towerSide * 0.31, z: desk.z, w: t.w, d: Math.min(desk.d - 0.10, t.maxD) },
      0.035, t.h, colors.pc), 'tower', item.id);
    const monitorZ = desk.z - Math.cos(orientation) * desk.d * 0.23;
    tag(box(furnitureGroup, { x, z: monitorZ, w: 0.17, d: m.d }, top, 0.018, colors.pc), 'monitor', item.id);
    tag(box(furnitureGroup, { x, z: monitorZ, w: 0.055, d: 0.04 }, top + 0.018, 0.095, colors.pc), 'monitor', item.id);
    tag(box(furnitureGroup, { x, z: monitorZ, w: m.w, d: m.screenD }, top + 0.104, m.screenH, colors.pc), 'monitor', item.id);
    tag(box(furnitureGroup, { x, z: monitorZ + Math.cos(orientation) * 0.019, w: 0.44, d: 0.005 }, top + 0.124, 0.23, colors.screen), 'monitor', item.id, 0x718b9b);
    tag(box(furnitureGroup, { x, z: desk.z + Math.cos(orientation) * desk.d * 0.2, w: k.w, d: k.d }, top, k.h, colors.pc), 'keyboard', item.id);
    if (isMaquette) {
      const mouse = models.mouse;
      tag(box(furnitureGroup, { ...mouse, x: x + 0.24,
        z: desk.z + Math.cos(orientation) * desk.d * 0.2 }, top, mouse.h, colors.pc), 'mouse', item.id);
    }
    const seat = { ...chair, w: s.w, d: Math.min(chair.d * 0.84, s.maxD) };
    tag(box(furnitureGroup, { ...seat, w: 0.065, d: 0.065 }, 0.03, 0.42, colors.legs), 'chair', item.id);
    tag(box(furnitureGroup, { ...seat, w: seat.w * 0.85, d: 0.065 }, 0.025, 0.04, colors.legs), 'chair', item.id);
    tag(box(furnitureGroup, { ...seat, w: 0.065, d: seat.d * 0.92 }, 0.025, 0.04, colors.legs), 'chair', item.id);
    tag(box(furnitureGroup, seat, 0.43, 0.065, colors.seat), 'chair', item.id);
    tag(box(furnitureGroup, { ...seat, z: (isFront ? maxZ(seat) : minZ(seat)), d: 0.055 }, 0.48, s.backH, colors.seat), 'chair', item.id);
    plane(zones, desk, 0.015, colors.deskMark, 0.35);
    outline(zones, desk, top + 0.006, colors.deskMark);
    plane(zones, chair, 0.021, colors.chairMark, 0.43);
    outline(zones, chair, 0.025, colors.chairMark);
  }

  function dimension(a: Point, b: Point, text: string, selected = false) {
    const color = selected ? 0x9b5b1f : 0x466b82;
    const y = 0.05;
    const a3 = new T.Vector3(a.x, y, a.z);
    const b3 = new T.Vector3(b.x, y, b.z);
    line(annotations, [a3, b3], color);
    const normal = new T.Vector3(b.z - a.z, 0, a.x - b.x).normalize().multiplyScalar(0.095);
    for (const p of [a3, b3]) line(annotations, [p.clone().sub(normal), p.clone().add(normal)], color);
    label(text, a3.clone().lerp(b3, 0.5), selected);
  }

  function showZones(model: Model, inspection: Inspection, selected: Passage, destination: string) {
    currentModel = model;
    activeObstacles = createObstacles(model, techDoorOpen);
    clear(zones);
    clear(objects);
    clear(annotations);
    clear(highlight);
    labelLayer.replaceChildren();
    labels = [];
    picks = [];
    model.stations.forEach(s => station(objects, s, false));
    station(objects, model.admin, true);
    for (const passage of inspection.passages) {
      const active = passage.id === selected.id;
      const color = passage.width < study.width - 1e-8 ? colors.warn : colors.pass;
      const mesh = plane(zones, passage.rect, active ? 0.03 : 0.025, color, active ? 0.69 : 0.34);
      mesh.userData.id = passage.id;
      picks.push(mesh);
      if (active) outline(zones, passage.rect, 0.033, color);
    }
    for (const leaf of leaves) {
      const points = Array.from({ length: 25 }, (_, i) => leafTip(leaf, i * Math.PI / 48));
      const shape = new T.Shape([leaf.hinge, ...points].map(p => new T.Vector2(p.x, -p.z)));
      const material = new T.MeshBasicMaterial({ color: colors.door, transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide });
      const mesh = new T.Mesh(new T.ShapeGeometry(shape), material);
      mesh.userData.dispose = true;
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.031;
      mesh.renderOrder = 3;
      zones.add(mesh);
      line(zones, [leaf.hinge, ...points, leaf.hinge].map(p => new T.Vector3(p.x, 0.036, p.z)), colors.door);
    }
    plane(zones, service, 0.028, colors.service, 0.32);
    outline(zones, service, 0.032, colors.service);
    const target = [inspection.mainRoute, ...inspection.targets].find(t => t.id === destination)!;
    const { path } = target;
    if (path.length > 1) {
      // Only draw changes of direction to keep the trace lightweight.
      const corners = path.filter((p, i) => i === 0 || i === path.length - 1 ||
        (path[i - 1].x !== path[i + 1].x && path[i - 1].z !== path[i + 1].z));
      line(zones, corners.map(p => new T.Vector3(p.x, 0.057, p.z)),
        target.width + 1e-8 >= study.width ? colors.route : colors.blocked);
    }
    const goal = path.at(-1) ?? target.point;
    plane(zones, { ...goal, w: 0.22, d: 0.22 }, 0.061, target.width + 1e-8 >= study.width ? colors.route : colors.blocked, 0.9);
    if (target.pinch) {
      const mark = { ...target.pinch.point, w: 0.18, d: 0.18 };
      plane(zones, mark, 0.066, colors.warn, 1);
      outline(zones, mark, 0.069, 0x724011);
    }
    const activeStation = [...model.stations, model.admin].find(s => s.id === destination);
    if (activeStation) outline(highlight, activeStation.desk, furniture.deskHeight + 0.012, colors.route);

    dimension({ x: 0, z: room.d + 0.40 }, { x: room.w, z: room.d + 0.40 }, meters(room.w));
    dimension({ x: -0.40, z: 0 }, { x: -0.40, z: room.d }, meters(room.d));
    const r = selected.rect;
    const at = selected.at ?? r;
    if (selected.direction === 'x') {
      dimension({ x: at.x, z: minZ(r) }, { x: at.x, z: maxZ(r) }, meters(selected.width), true);
    } else {
      dimension({ x: minX(r), z: at.z }, { x: maxX(r), z: at.z }, meters(selected.width), true);
    }
    label('Recepción', new T.Vector3(model.admin.desk.x, furniture.deskHeight + 0.2, model.admin.desk.z));
    label('Cuarto técnico', new T.Vector3(rack.x, serverPosition.y + 0.26, rack.z));
    label('Espera', new T.Vector3(waiting.x, 0.72, waiting.z));
    renderer.shadowMap.needsUpdate = true;
  }

  function clear(group: T.Group) {
    for (const object of group.children) {
      object.traverse(child => {
        guideVisibility.delete(child);
        if (child instanceof T.Mesh) technicalMaterials.delete(child);
      });
      if (object instanceof T.Line) {
        object.geometry.dispose();
        object.material.dispose();
      }
      if (object instanceof T.Mesh && object.userData.dispose) {
        object.geometry.dispose();
        object.material.dispose();
      }
    }
    group.clear();
  }

  function fit() {
    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;
    const ratio = w / h;
    const halfHeight = isMaquette ? Math.max(view === 'top' ? 7.05 : 8.65, 8.3 / ratio)
      : view === 'rack' ? Math.max(0.70, 0.82 / ratio)
        : Math.max(view === 'top' ? 5.85 : 6.95, 6.4 / ratio);
    camera.left = -halfHeight * ratio;
    camera.right = halfHeight * ratio;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();

    fpCamera.aspect = ratio;
    fpCamera.updateProjectionMatrix();

    renderer.setSize(w, h, false);
  }

  function setView(next: CameraView) {
    restoreGuideVisibility();
    if (isTour) {
      isTour = false;
      controls.enabled = true;
      if (fpControls.isLocked) fpControls.unlock();
      labelLayer.hidden = !userDimensions;
      (labelLayer as HTMLElement).style.display = userDimensions ? '' : 'none';
      (networkLayer as HTMLElement).style.display = '';
      annotations.visible = userDimensions;
      zones.visible = userCirculation;
      onTourState?.(false, false);
      onInspectTarget?.(null);
    }
    view = next;
    labelLayer.classList.toggle('rack-view', view === 'rack');
    controls.target.copy(view === 'rack' ? new T.Vector3(rack.x, 0.49, rack.z + 0.18)
      : new T.Vector3(room.w / 2, view === 'top' ? 0 : 0.42, room.d / 2));
    camera.zoom = 1;
    // Reset any damped orbit delta before switching presets.
    controls.enableDamping = false;
    controls.update();
    controls.enableRotate = view !== 'top';
    camera.position.copy(controls.target).add(view === 'top'
      ? new T.Vector3(0, 18, 0.00001) : view === 'rack' ? new T.Vector3(-0.12, 0.40, 1.85) : new T.Vector3(9, 13, 14));
    renderer.shadowMap.enabled = view !== 'top';
    for (const mesh of upperWalls) mesh.visible = view === 'iso';
    for (const mesh of rackForeground) mesh.visible = view !== 'rack' && (view === 'iso' || !upperWalls.includes(mesh));
    for (const mesh of ghostWalls) {
      mesh.material = view !== 'top' ? ghost : solids.get(colors.wall)!;
      technicalMaterials.delete(mesh);
      applyPaper(mesh);
      mesh.castShadow = view === 'top';
    }
    controls.update();
    controls.enableDamping = true;
    fit();
    applyGuide();
    renderer.shadowMap.needsUpdate = true;
  }

  function restoreGuideVisibility() {
    for (const [object, visible] of guideVisibility) object.visible = visible;
    guideVisibility.clear();
  }

  function applyGuide() {
    restoreGuideVisibility();
    clear(guideExtras);
    displaySlab.position.y = -room.slab - displayBase.thickness * scale / 2;
    if (!isMaquette || !guidePhase || guidePhase === 'finish' || !guideNetwork) {
      renderer.shadowMap.needsUpdate = true;
      return;
    }
    const phase = guidePhase;
    function keep(object: T.Object3D, visible: boolean) {
      guideVisibility.set(object, object.visible);
      object.visible = object.visible && visible;
    }
    keep(objects, phase === 'stations');
    keep(networkGroup, phase === 'floor');
    for (const child of architecture.children) {
      if (child === slab || child === grid) continue;
      const kind = child.userData.materialKind;
      const architectural = ['wall', 'window', 'door'].includes(kind) || child === techDoorPivot;
      keep(child, phase === 'walls' ? architectural : phase === 'equipment' && !architectural);
    }
    for (const child of maquetteExtras.children) {
      if (child !== displaySlab) keep(child, phase === 'equipment');
    }
    if (phase === 'base' && currentModel) {
      for (const wall of walls) {
        const length = wall.end - wall.start;
        const middle = (wall.start + wall.end) / 2;
        const trace = wall.axis === 'x'
          ? { x: middle, z: wall.fixed, w: length, d: room.wall }
          : { x: wall.fixed, z: middle, w: room.wall, d: length };
        outline(guideExtras, trace, 0.008, 0x9b642f);
      }
      for (const item of [...currentModel.stations, currentModel.admin]) outline(guideExtras, item.desk, 0.01, 0x46767a);
      outline(guideExtras, technical.rack, 0.01, 0x46767a);
    }
    if (phase === 'floor') {
      const hatch = floorRegister(guideNetwork);
      const gap = hatch.minimumGapMm * scale / 1000;
      displaySlab.position.y -= gap;
      outline(guideExtras, hatch, 0.016, 0xe07c18);
      if (registerOpen) {
        keep(slab, false);
        const floor = (x1: number, x2: number, z1: number, z2: number) =>
          box(guideExtras, { x: (x1 + x2) / 2, z: (z1 + z2) / 2, w: x2 - x1, d: z2 - z1 },
            -room.slab, room.slab, 0xf0e2c9);
        floor(0, room.w, 0, minZ(hatch));
        floor(0, room.w, maxZ(hatch), room.d);
        floor(0, minX(hatch), minZ(hatch), maxZ(hatch));
        floor(maxX(hatch), room.w, minZ(hatch), maxZ(hatch));
        const trunk = guideNetwork.ducts.find(duct => duct.id === hatch.trunk)!;
        for (const mesh of networkGroup.children) {
          if (mesh.userData.segment === hatch.trunk) keep(mesh, false);
        }
        for (const [start, end] of [[trunk.from.z, minZ(hatch)], [maxZ(hatch), trunk.to.z]]) {
          box(guideExtras, { x: hatch.x, z: (start + end) / 2, w: sectionSize['80×40'][0], d: end - start },
            projectedY, sectionSize['80×40'][1], 0xb38859);
          line(guideExtras, [new T.Vector3(hatch.x, projectedY + 0.043, start),
            new T.Vector3(hatch.x, projectedY + 0.043, end)], 0x205aca);
        }
        const bottom = -hatch.ductDepthMm * scale / 1000;
        box(guideExtras, { x: hatch.x, z: hatch.z, w: sectionSize['80×40'][0], d: hatch.d },
          bottom, sectionSize['80×40'][1], 0xb38859);
        for (const offset of [-0.019, 0, 0.019]) {
          line(guideExtras, [new T.Vector3(hatch.x + offset, hatch.ductY + 0.022, minZ(hatch)),
            new T.Vector3(hatch.x + offset, hatch.ductY + 0.022, maxZ(hatch))], 0x205aca);
        }
      }
    }
    renderer.shadowMap.needsUpdate = true;
  }

  function setConstructionPhase(phase: PhaseId | null, open: boolean) {
    guidePhase = phase;
    registerOpen = open;
    applyGuide();
  }

  function setMaquette(enabled: boolean, select?: (kind: ComponentKind, id: string) => void) {
    isMaquette = enabled;
    onMaterial = select;
    maquetteExtras.visible = enabled;
    if (enabled) scene.traverse(object => { if (object instanceof T.Mesh) applyPaper(object); });
    else restoreMaterials();
    const floorEdge = enabled ? solid(0xb69067) : base;
    slab.material = [floorEdge, floorEdge, solid(enabled ? 0xf0e2c9 : colors.floor), floorEdge, floorEdge, floorEdge];
    grid.position.y = -room.slab - (enabled ? displayBase.thickness * scale : 0) - 0.005;
    fit();
    renderer.shadowMap.needsUpdate = true;
  }

  const fwd = new T.Vector3();
  const rightVec = new T.Vector3();

  function updateFirstPerson(dt: number) {
    if (!isTour) return;

    fpCamera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    rightVec.crossVectors(fwd, fpCamera.up);

    let dirX = 0;
    let dirZ = 0;
    if (moveKeys.forward) { dirX += fwd.x; dirZ += fwd.z; }
    if (moveKeys.backward) { dirX -= fwd.x; dirZ -= fwd.z; }
    if (moveKeys.right) { dirX += rightVec.x; dirZ += rightVec.z; }
    if (moveKeys.left) { dirX -= rightVec.x; dirZ -= rightVec.z; }

    const len = Math.hypot(dirX, dirZ);
    if (len > 0) {
      const speed = moveKeys.shift ? 3.8 : 2.0;
      const stepDist = speed * dt;
      const deltaX = (dirX / len) * stepDist;
      const deltaZ = (dirZ / len) * stepDist;

      const currentPos = { x: fpCamera.position.x, z: fpCamera.position.z };
      const newPos = stepMovement(currentPos, { x: deltaX, z: deltaZ }, 0.22, activeObstacles);
      fpCamera.position.x = newPos.x;
      fpCamera.position.z = newPos.z;
    }
    fpCamera.position.y = eyeHeight;
  }

  function resetTourPosition() {
    fpCamera.position.copy(startPosition);
    fpCamera.lookAt(startLookTarget);
  }

  function startTour() {
    isTour = true;
    currentLookTarget = null;
    controls.enabled = false;
    resetTourPosition();
    for (const mesh of upperWalls) mesh.visible = true;
    for (const mesh of ghostWalls) mesh.material = solids.get(colors.wall)!;
    for (const mesh of rackForeground) mesh.visible = true;

    // Strict separation: completely hide all floating labels, 3D dimension geometry, and circulation overlays
    labelLayer.hidden = true;
    (labelLayer as HTMLElement).style.display = 'none';
    (networkLayer as HTMLElement).style.display = 'none';
    annotations.visible = false;
    zones.visible = false;

    fit();
    onTourState?.(true, false);
    onZoneState?.(getZoneName(fpCamera.position.x, fpCamera.position.z));
    fpControls.lock();
  }

  function exitTour() {
    if (!isTour) return;
    isTour = false;
    currentLookTarget = null;
    moveKeys.forward = false;
    moveKeys.backward = false;
    moveKeys.left = false;
    moveKeys.right = false;
    moveKeys.shift = false;
    if (fpControls.isLocked) {
      fpControls.unlock();
    }
    controls.enabled = true;

    // Restore label, dimension and circulation visibility according to user preferences
    labelLayer.hidden = !userDimensions;
    (labelLayer as HTMLElement).style.display = userDimensions ? '' : 'none';
    (networkLayer as HTMLElement).style.display = '';
    annotations.visible = userDimensions;
    zones.visible = userCirculation;

    onTourState?.(false, false);
    onInspectTarget?.(null);
    setView('iso');
  }

  new ResizeObserver(fit).observe(container);
  setView('iso');
  const raycaster = new T.Raycaster();
  let start: Point | undefined;
  let isDraggingLook = false;
  let prevPointer = { x: 0, y: 0 };
  const lookEuler = new T.Euler(0, 0, 0, 'YXZ');

  renderer.domElement.addEventListener('pointerdown', e => {
    start = { x: e.clientX, z: e.clientY };
    if (isTour && !fpControls.isLocked) {
      isDraggingLook = true;
      prevPointer = { x: e.clientX, y: e.clientY };
    }
  });

  window.addEventListener('pointermove', e => {
    if (isTour && !fpControls.isLocked && isDraggingLook) {
      const dx = e.clientX - prevPointer.x;
      const dy = e.clientY - prevPointer.y;
      prevPointer = { x: e.clientX, y: e.clientY };
      lookEuler.setFromQuaternion(fpCamera.quaternion);
      lookEuler.y -= dx * 0.003;
      lookEuler.x -= dy * 0.003;
      lookEuler.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, lookEuler.x));
      fpCamera.quaternion.setFromEuler(lookEuler);
    }
  });

  window.addEventListener('pointerup', () => {
    isDraggingLook = false;
  });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.z) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    const activeCamera = isTour ? fpCamera : camera;
    raycaster.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2), activeCamera);

    if (isTour) {
      const doorHit = raycaster.intersectObjects(techDoorMeshes)[0];
      if (doorHit && doorHit.distance < 3.0) {
        toggleTechDoor();
        return;
      }
      if (currentLookTarget) {
        onOpenFicha?.(currentLookTarget);
        return;
      }
      const equipHit = raycaster.intersectObjects([...rackMeshes, ...objects.children], true)[0];
      const clickedId = (equipHit && equipHit.distance < 4.5) ? resolveEquipmentId(equipHit.object) : null;
      if (clickedId) {
        onOpenFicha?.(clickedId);
        return;
      }
      if (!fpControls.isLocked) {
        fpControls.lock();
      }
      return;
    }

    if (isMaquette) {
      const hits = raycaster.intersectObjects([architecture, objects, networkGroup, maquetteExtras], true)
        .filter(({ object }) => {
          for (let parent: T.Object3D | null = object; parent; parent = parent.parent) {
            if (!parent.visible) return false;
          }
          return object.userData.materialKind;
        });
      const hit = hits.find(({ object }) => !(object instanceof T.Mesh) || object.material !== paperCutaway) ?? hits[0];
      if (hit) onMaterial?.(hit.object.userData.materialKind, hit.object.userData.materialId);
      return;
    }

    const first = zones.visible ? raycaster.intersectObjects(picks)[0] : undefined;
    const rackHit = raycaster.intersectObjects(rackMeshes)[0];
    if (rackHit && (!first || rackHit.distance < first.distance)) {
      onEquipment(rackHit.object.name, rackHit.object.userData.port);
      return;
    }
    if (networkGroup.children.length) {
      const equipment = raycaster.intersectObjects(objects.children, true)[0];
      if (equipment && (!first || equipment.distance < first.distance)) {
        onEquipment(equipment.object.parent!.name);
        return;
      }
    }
    if (first) onPassage(first.object.userData.id);
  });
  const projected = new T.Vector3();
  const centerReticle = new T.Vector2(0, 0);
  let lastTime = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    const activeCamera = isTour ? fpCamera : camera;

    if (isTour) {
      updateFirstPerson(dt);
      const currentZone = getZoneName(fpCamera.position.x, fpCamera.position.z);
      onZoneState?.(currentZone);

      raycaster.setFromCamera(centerReticle, fpCamera);
      const equipHit = raycaster.intersectObjects([...rackMeshes, ...objects.children], true)[0];
      const targetId = (equipHit && equipHit.distance < 4.0) ? resolveEquipmentId(equipHit.object) : null;
      if (targetId !== currentLookTarget) {
        currentLookTarget = targetId;
        onInspectTarget?.(targetId);
      }
    } else {
      controls.update();

      // Only project labels in isometric/top/rack views
      const showDimLabels = !labelLayer.hidden && view !== 'rack';
      for (const set of [showDimLabels ? labels : [], networkLabels]) {
        for (const { element, point } of set) {
          projected.copy(point).project(camera);
          element.style.display = '';
          element.style.left = `${(projected.x + 1) * 50}%`;
          element.style.top = `${(1 - projected.y) * 50}%`;
        }
      }
    }

    renderer.render(scene, activeCamera);
  });
  return {
    showZones, showNetwork, setView, setMaquette, setConstructionPhase, center: () => setView(view),
    zoom(factor: number) { camera.zoom = T.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom); camera.updateProjectionMatrix(); },
    layers(dimensions: boolean, circulation: boolean) {
      userDimensions = dimensions;
      userCirculation = circulation;
      if (!isTour) {
        labelLayer.hidden = !dimensions;
        (labelLayer as HTMLElement).style.display = dimensions ? '' : 'none';
        annotations.visible = dimensions;
        zones.visible = circulation;
      }
    },
    startTour,
    exitTour,
    resetTourPosition,
    toggleTechDoor,
    isTourActive: () => isTour,
    requestPointerLock: () => { if (isTour) fpControls.lock(); },
    unlockPointer: () => { if (fpControls.isLocked) fpControls.unlock(); },
    getCurrentLookTarget: () => currentLookTarget,
  };
}
