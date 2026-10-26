// === www/js/geometry/wall-builder.js ===
/**
 * Muros con huecos mediante descomposición en prismas cerrados, sin CSG.
 */
import { EPS } from '../core/constants.js';
import { mul } from './vec2.js';
import { computeWallFootprints } from './joins.js';
import { GeometryBuilder } from './geometry-builder.js';

export function levelElevation(project, levelIndex) {
  let e = 0;
  for (let i = 0; i < levelIndex; i += 1) {
    e += project.settings.wallHeight + project.settings.slabThickness;
  }
  return e;
}

export function buildWalls(project, level, elevation = 0) {
  const builder = new GeometryBuilder();
  const openingsBuilder = new GeometryBuilder();
  const footprints = computeWallFootprints(level);

  for (const wall of Object.values(level.walls)) {
    const fp = footprints[wall.id];
    if (!fp) continue;
    const openings = Object.values(level.openings)
      .filter((o) => o.wallId === wall.id)
      .sort((a, b) => a.s - b.s);

    const axis = fp.axis;
    const dir = axis.dir;
    const normal = { x: -dir.y, y: dir.x };

    const cuts = [0];
    for (const o of openings) {
      cuts.push(Math.max(0, o.s - o.width / 2));
      cuts.push(Math.min(axis.length, o.s + o.width / 2));
    }
    cuts.push(axis.length);
    const unique = [...new Set(cuts.map((c) => Math.round(c * 1e6) / 1e6))].sort((a, b) => a - b);

    for (let i = 1; i < unique.length; i += 1) {
      const s0 = unique[i - 1];
      const s1 = unique[i];
      if (s1 - s0 < EPS) continue;
      const mid = (s0 + s1) / 2;
      const covering = openings.find((o) => mid > o.s - o.width / 2 + EPS && mid < o.s + o.width / 2 - EPS);
      if (covering) {
        if (covering.sill > EPS) {
          addPrism(builder, fp, wall, elevation, s0, s1, 0, covering.sill, normal, dir);
        }
        const top = covering.sill + covering.height;
        if (top < wall.height - EPS) {
          addPrism(builder, fp, wall, elevation, s0, s1, top, wall.height, normal, dir);
        }
        addOpeningFill(openingsBuilder, fp, wall, covering, elevation);
      } else {
        addPrism(builder, fp, wall, elevation, s0, s1, 0, wall.height, normal, dir);
      }
    }
  }

  return { builder, openingsBuilder };
}

function addPrism(builder, fp, wall, elevation, s0, s1, y0, y1, normal, dir) {
  const { start, end } = fp;
  const leftAt = (s) => lerpPoint(start.left, end.left, s / fp.axis.length);
  const rightAt = (s) => lerpPoint(start.right, end.right, s / fp.axis.length);

  const L0 = leftAt(s0), L1 = leftAt(s1);
  const R0 = rightAt(s0), R1 = rightAt(s1);
  const Y0 = elevation + y0;
  const Y1 = elevation + y1;

  const p = {
    L0B: { x: L0.x, y: Y0, z: L0.y },
    L1B: { x: L1.x, y: Y0, z: L1.y },
    R0B: { x: R0.x, y: Y0, z: R0.y },
    R1B: { x: R1.x, y: Y0, z: R1.y },
    L0T: { x: L0.x, y: Y1, z: L0.y },
    L1T: { x: L1.x, y: Y1, z: L1.y },
    R0T: { x: R0.x, y: Y1, z: R0.y },
    R1T: { x: R1.x, y: Y1, z: R1.y },
  };

  const nLeft = { x: -normal.x, y: 0, z: -normal.y };
  const nRight = { x: normal.x, y: 0, z: normal.y };
  const nFront = { x: -dir.x, y: 0, z: -dir.y };
  const nBack = { x: dir.x, y: 0, z: dir.y };
  const nTop = { x: 0, y: 1, z: 0 };
  const nBottom = { x: 0, y: -1, z: 0 };

  builder.addQuad(p.L0B, p.L1B, p.L1T, p.L0T, nLeft);
  builder.addQuad(p.R1B, p.R0B, p.R0T, p.R1T, nRight);
  builder.addQuad(p.R0B, p.L0B, p.L0T, p.R0T, nFront);
  builder.addQuad(p.L1B, p.R1B, p.R1T, p.L1T, nBack);
  builder.addQuad(p.L0T, p.L1T, p.R1T, p.R0T, nTop);
  builder.addQuad(p.R0B, p.R1B, p.L1B, p.L0B, nBottom);
}

function addOpeningFill(builder, fp, wall, opening, elevation) {
  const axis = fp.axis;
  const s0 = opening.s - opening.width / 2;
  const s1 = opening.s + opening.width / 2;
  const y0 = elevation + opening.sill;
  const y1 = elevation + opening.sill + opening.height;
  const leftAt = (s) => lerpPoint(fp.start.left, fp.end.left, s / axis.length);
  const rightAt = (s) => lerpPoint(fp.start.right, fp.end.right, s / axis.length);
  const inset = 0.04;
  const L0 = leftAt(s0), L1 = leftAt(s1), R0 = rightAt(s0), R1 = rightAt(s1);
  const dir = axis.dir;
  const normal = { x: -dir.y, y: dir.x };
  const off = mul(normal, inset);
  const p0 = { x: L0.x + off.x, y: y0, z: L0.y + off.y };
  const p1 = { x: L1.x + off.x, y: y0, z: L1.y + off.y };
  const p2 = { x: L1.x + off.x, y: y1, z: L1.y + off.y };
  const p3 = { x: L0.x + off.x, y: y1, z: L0.y + off.y };
  if (opening.type === 'door') {
    builder.addQuad(p0, p1, p2, p3, { x: normal.x, y: 0, z: normal.y });
  } else {
    builder.addQuad(p0, p1, p2, p3, { x: normal.x, y: 0, z: normal.y });
    builder.addQuad(p0, p3, p2, p1, { x: -normal.x, y: 0, z: -normal.y });
  }
}

function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
