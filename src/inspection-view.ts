import * as T from 'three';
import type { InfrastructureOptions, InspectionLayer } from './inspection.ts';

type Roots = {
  architecture: T.Group; objects: T.Group; infrastructure: T.Group; extras: T.Group;
  network: T.Group; zones: T.Group; annotations: T.Group; guide: T.Group;
  floor: T.Mesh; grid: T.GridHelper; base: T.Mesh; rackMeshes: T.Mesh[]; door: T.Group;
};

export function infrastructureInspection(roots: Roots) {
  const visibility = new Map<T.Object3D, boolean>();
  const originals = new Map<T.Mesh, { material: T.Material | T.Material[]; shadow: boolean }>();
  const palette = new Map<string, T.Material>();
  const surfaces = new Map<string, T.Material>();

  function restore() {
    for (const [object, value] of visibility) object.visible = value;
    for (const [object, value] of originals) {
      object.material = value.material;
      object.castShadow = value.shadow;
    }
    visibility.clear();
    originals.clear();
  }
  function visible(object: T.Object3D, value: boolean) {
    if (!visibility.has(object)) visibility.set(object, object.visible);
    object.visible = value;
  }
  function tint(object: T.Mesh, color: number, opacity: number, unlit = false) {
    if (!originals.has(object)) originals.set(object, { material: object.material, shadow: object.castShadow });
    const key = `${color}:${opacity}`;
    const cache = unlit ? palette : surfaces;
    if (!cache.has(key)) {
      const parameters = { color, opacity, transparent: opacity < 1, depthWrite: opacity >= 1 };
      cache.set(key, unlit ? new T.MeshBasicMaterial(parameters) : new T.MeshStandardMaterial(parameters));
    }
    object.material = cache.get(key)!;
    object.castShadow = opacity >= 1;
  }
  function apply(options: InfrastructureOptions | null) {
    restore();
    if (!options) return;
    const { layers, selection, style } = options;
    const enabled = (key: InspectionLayer) => layers[key];
    for (const group of [roots.architecture, roots.objects, roots.infrastructure, roots.extras]) visible(group, true);
    for (const group of [roots.network, roots.zones, roots.annotations, roots.guide]) visible(group, false);
    visible(roots.base, false);
    visible(roots.grid, false);
    const transparent = style === 'transparent';
    for (const object of roots.architecture.children) {
      if (object === roots.grid) continue;
      const architecture = object === roots.door || object.userData.wallId;
      visible(object, object === roots.floor ? enabled('floor') : architecture ? enabled('walls') : true);
      if (object === roots.floor) tint(roots.floor, 0xe1d6be, transparent ? .08 : 1);
      else if (architecture) {
        object.traverse(child => {
          if (child instanceof T.Mesh) tint(child, 0xa9bdc8, transparent ? .09 : 1);
        });
      } else if (object instanceof T.Mesh) {
        visible(object, roots.rackMeshes.includes(object) || ['rack', 'server'].includes(object.userData.materialKind));
        if (object.visible) {
          object.visible = enabled('rack');
          if (object.name === 'RACK-01') tint(object, 0x455363, .36);
          if (selection && object.userData.port &&
              ((object.name === 'PP-01' && object.userData.port === Number(selection.link.panelPort.split('/')[1])) ||
               (object.name === 'SW-01' && object.userData.port === Number(selection.link.switchPort.split('/')[1]))))
            tint(object, 0xffcf40, 1, true);
        }
      }
    }
    for (const group of roots.objects.children) {
      visible(group, true);
      group.traverse(child => {
        if (!(child instanceof T.Mesh)) return;
        const layer = ['desk', 'counter', 'chair'].includes(child.userData.materialKind) ? 'furniture' : 'computers';
        visible(child, enabled(layer));
        if (selection?.id === group.name) {
          const material = child.material as T.MeshStandardMaterial;
          const color = material.color?.clone().lerp(new T.Color(0xffd75b), .40).getHex() ?? 0xf5cd56;
          tint(child, color, 1);
        }
      });
    }
    const selectedData = new Set(selection?.dataSegments);
    const selectedPower = new Set(selection?.powerSegments);
    roots.infrastructure.traverse(object => {
      if (object instanceof T.Group) visible(object, true);
      if (!(object instanceof T.Mesh)) return;
      const kind = object.userData.materialKind;
      const id = object.userData.materialId;
      let layer: InspectionLayer | undefined = object.userData.inspectionLayer;
      if (!layer) {
        if (kind === 'serviceBox') layer = 'boxes';
        else if (kind === 'jack' || kind === 'socket') layer = 'sockets';
        else if (kind === 'panel') layer = 'panel';
        else if (kind === 'ups') layer = 'rack';
        else if (kind === 'dataLead' || kind === 'rackPatch') layer = 'ethernet';
        else if (kind === 'powerWire') layer = 'electricity';
        else if (kind === 'peripheral') layer = 'computers';
      }
      visible(object, Boolean(layer && enabled(layer)));
      if (!layer) return;
      const route = ['ethernet', 'electricity', 'dataDuct', 'powerDuct'].includes(layer);
      if (!route) {
        if (selection && (id === selection.service.labels.box ||
          id === selection.service.labels.jack || id === selection.service.labels.power)) {
          if (!object.userData.keepMaterial || kind !== 'serviceBox') tint(object, kind === 'jack' ? 0x1688ef : 0xffe2a1, 1);
        }
        return;
      }
      const active = !selection || (object.userData.dataSegment
        ? selectedData.has(object.userData.dataSegment)
        : object.userData.powerSegment ? selectedPower.has(object.userData.powerSegment)
          : object.userData.station ? object.userData.station === selection.id
            : kind === 'rackPatch' ? id === selection.link.id : id === selection.circuit.id);
      const duct = layer === 'dataDuct' || layer === 'powerDuct';
      const color = layer === 'ethernet' ? 0x087ee0 : layer === 'electricity' ? 0xd16c14
        : layer === 'dataDuct' ? 0x7f9eaf : 0xc6b9a1;
      tint(object, color, duct ? active ? .23 : .07 : active ? 1 : .15, !duct);
    });
  }
  return { apply, restore };
}
