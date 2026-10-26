// === www/js/geometry/slab-builder.js ===
/**
 * Losas con huecos trianguladas con ShapeUtils.triangulateShape. El contorno
 * sale del anillo exterior de ingletes; los huecos son los polígonos de
 * escalera del nivel superior. Se usa Vector2 importado de three (API pública
 * de ShapeUtils), no el wrapper TS que producía error de sintaxis.
 */
import { ShapeUtils, Vector2 } from 'three';
import { GeometryBuilder } from './geometry-builder.js';
import { computeWallFootprints } from './joins.js';
import { ensureCounterClockwise } from './polygon.js';

export function buildSlab(level, y0, y1, holes = []) {
  const builder = new GeometryBuilder();
  const loop = level.perimeterLoop.map((id) => level.nodes[id]).filter(Boolean);
  if (loop.length < 3) return builder;

  const footprints = computeWallFootprints(level);
  const outer = outerRingFromJoins(level, footprints, loop);
  const contour = ensureCounterClockwise(outer);

  const holePolys = holes
    .filter((h) => h.length >= 3)
    .map((h) => ensureCounterClockwise(h));

  const contourV2 = contour.map((p) => new Vector2(p.x, p.y));
  const holesV2 = holePolys.map((h) => h.map((p) => new Vector2(p.x, p.y)));
  const faces = ShapeUtils.triangulateShape(contourV2, holesV2);

  const all = [...contour, ...holePolys.flat()];
  for (const tri of faces) {
    const p0 = all[tri[0]];
    const p1 = all[tri[1]];
    const p2 = all[tri[2]];
    if (!p0 || !p1 || !p2) continue;
    builder.addTriangle(
      { x: p0.x, y: y1, z: p0.y },
      { x: p1.x, y: y1, z: p1.y },
      { x: p2.x, y: y1, z: p2.y },
      { x: 0, y: 1, z: 0 },
    );
    builder.addTriangle(
      { x: p0.x, y: y0, z: p0.y },
      { x: p2.x, y: y0, z: p2.y },
      { x: p1.x, y: y0, z: p1.y },
      { x: 0, y: -1, z: 0 },
    );
  }

  for (let i = 0; i < contour.length; i += 1) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    const n = { x: b.y - a.y, y: 0, z: -(b.x - a.x) };
    const l = Math.hypot(n.x, n.z) || 1;
    const nn = { x: n.x / l, y: 0, z: n.z / l };
    builder.addQuad(
      { x: a.x, y: y0, z: a.y },
      { x: b.x, y: y0, z: b.y },
      { x: b.x, y: y1, z: b.y },
      { x: a.x, y: y1, z: a.y },
      nn,
    );
  }

  return builder;
}

function outerRingFromJoins(level, footprints, loop) {
  const pts = [];
  for (const node of loop) {
    const walls = Object.values(level.walls).filter(
      (w) => w.a === node.id || w.b === node.id,
    );
    const fp = walls.map((w) => footprints[w.id]).find(Boolean);
    if (fp) pts.push(fp.start.left, fp.end.left, fp.end.right, fp.start.right);
    else pts.push({ x: node.x, y: node.y });
  }
  const out = [];
  for (const p of pts) {
    if (!out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1e-4)) out.push(p);
  }
  return out;
}
