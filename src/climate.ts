import { room } from './model.ts';
import { pathLength } from './infrastructure.ts';

export const climatePairs = [
  { key: '01', wall: 'Posterior', axis: 'x', capacity: 24000,
    indoorAt: 4.20, outdoorAt: 4.20, pipeSideGap: 0.07, indoor: [0.90, 0.30, 0.22], outdoor: [0.85, 0.55, 0.32] },
  { key: '02', wall: 'Izquierdo', axis: 'z', capacity: 24000,
    indoorAt: 4.00, outdoorAt: 3.70, pipeSideGap: 0.035, indoor: [0.90, 0.30, 0.22], outdoor: [0.85, 0.55, 0.32] },
  { key: '03', wall: 'Izquierdo', axis: 'z', capacity: 12000,
    indoorAt: 7.00, outdoorAt: 6.55, pipeSideGap: 0.07, indoor: [0.75, 0.27, 0.20], outdoor: [0.74, 0.50, 0.30] },
] as const;
export type ClimatePair = typeof climatePairs[number];
export const climateFit = {
  indoorBottom: 2.23, outdoorBottom: 0.90, outdoorGap: 0.045,
  bracketDrop: 0.30, bracketWidth: 0.12, bracketThickness: 0.025, bracketOffset: 0.31, armInset: 0.025,
  grilleOffset: 0.032, grilleTubeRatio: 0.027,
  fanCenterX: -0.10, fanRadius: 0.37, blades: 5,
  outletWidth: 0.86, outletHeight: 0.22,
  pipeRadius: 0.012, pipePitch: 0.039,
};

export function wallPoint(pair: ClimatePair, along: number, y: number, normal: number) {
  return pair.axis === 'x' ? { x: along, y, z: normal } : { x: normal, y, z: along };
}
export function climateUnits(pair: ClimatePair) {
  const [iw, ih, id] = pair.indoor;
  const [ow, oh, od] = pair.outdoor;
  return {
    indoor: { id: `HVAC-${pair.key}`, kind: 'minisplit' as const, along: pair.indoorAt,
      w: iw, h: ih, d: id, bottom: climateFit.indoorBottom, normal: room.wall + id / 2 },
    outdoor: { id: `CX-${pair.key}`, kind: 'condenser' as const, along: pair.outdoorAt,
      w: ow, h: oh, d: od, bottom: climateFit.outdoorBottom, normal: -climateFit.outdoorGap - od / 2 },
  };
}

export function climatePipes(pair: ClimatePair) {
  const { indoor, outdoor } = climateUnits(pair);
  return [0, climateFit.pipePitch].map(offset => {
    const through = indoor.along + indoor.w * 0.38 + offset;
    const drop = outdoor.along + outdoor.w / 2 + pair.pipeSideGap + offset;
    const high = indoor.bottom + 0.11 + offset * 0.55;
    const low = outdoor.bottom + 0.13 + offset * 0.65;
    // First segment passes through solid wall above the windows. The exterior
    // drop follows the equipment's pier and ends on the side of the cabinet.
    return [
      wallPoint(pair, through, high, room.wall + indoor.d * 0.28),
      wallPoint(pair, through, high, -0.048 - offset * 0.6),
      wallPoint(pair, drop, high, -0.048 - offset * 0.6),
      wallPoint(pair, drop, low, -0.048 - offset * 0.6),
      wallPoint(pair, outdoor.along + outdoor.w / 2, low, -0.048 - offset * 0.6),
    ];
  });
}
export const climatePipeLengths = (pair: ClimatePair) => climatePipes(pair).map(pathLength);

export function condenserMount(unit: ReturnType<typeof climateUnits>['outdoor']) {
  const { bracketDrop: wallLeg, bracketWidth: width, bracketThickness: thickness, bracketOffset, armInset } = climateFit;
  // Cabinet space: +z faces out, and y=0 is the cabinet center. The arm's
  // upper face meets the cabinet bottom. The wall leg starts at its underside.
  const wall = -unit.d / 2 - climateFit.outdoorGap;
  const bottom = -unit.h / 2;
  const arm = climateFit.outdoorGap + unit.d - armInset;
  const centers = [-unit.w * bracketOffset, unit.w * bracketOffset];
  return {
    width, wallLeg, arm, centers,
    armBox: { y: bottom - thickness / 2, z: wall + arm / 2, h: thickness, d: arm },
    wallBox: { y: bottom - (wallLeg + thickness) / 2, z: wall + thickness / 2,
      h: wallLeg - thickness, d: thickness },
  };
}
