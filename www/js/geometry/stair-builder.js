// === www/js/geometry/stair-builder.js ===
import { GeometryBuilder } from './geometry-builder.js';

export function computeStairMetrics(project, stair) {
  const rise = project.settings.wallHeight + project.settings.slabThickness;
  const n = Math.max(2, Math.ceil(rise / stair.targetRiser));
  const riser = rise / n;
  const treads = n - 1;
  const run = treads * stair.tread;
  return { rise, n, riser, treads, run };
}

export function stairFootprint(stair, metrics) {
  const { run } = metrics;
  const w = stair.width;
  const angle = (stair.angleDeg * Math.PI) / 180;
  const cx = stair.x, cy = stair.y;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const perp = { x: -dir.y, y: dir.x };
  return [
    { x: cx - dir.x * run / 2 - perp.x * w / 2, y: cy - dir.y * run / 2 - perp.y * w / 2 },
    { x: cx + dir.x * run / 2 - perp.x * w / 2, y: cy + dir.y * run / 2 - perp.y * w / 2 },
    { x: cx + dir.x * run / 2 + perp.x * w / 2, y: cy + dir.y * run / 2 + perp.y * w / 2 },
    { x: cx - dir.x * run / 2 + perp.x * w / 2, y: cy - dir.y * run / 2 + perp.y * w / 2 },
  ];
}

export function stairHolePolygon(stair, metrics) {
  if (stair.kind === 'straight') return stairFootprint(stair, metrics);
  const w = stair.width;
  const run = metrics.run;
  const landing = stair.landing;
  const total = run + landing;
  const angle = (stair.angleDeg * Math.PI) / 180;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const perp = { x: -dir.y, y: dir.x };
  const cx = stair.x, cy = stair.y;
  const half = total / 2;
  return [
    { x: cx - dir.x * half - perp.x * w / 2, y: cy - dir.y * half - perp.y * w / 2 },
    { x: cx + dir.x * half - perp.x * w / 2, y: cy + dir.y * half - perp.y * w / 2 },
    { x: cx + dir.x * half + perp.x * w / 2, y: cy + dir.y * half + perp.y * w / 2 },
    { x: cx - dir.x * half + perp.x * w / 2, y: cy - dir.y * half + perp.y * w / 2 },
  ];
}

export function buildStairGeometry(stair, metrics, baseElevation = 0) {
  const builder = new GeometryBuilder();
  const { n, riser, tread } = metrics;
  const w = stair.width;
  const angle = (stair.angleDeg * Math.PI) / 180;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const perp = { x: -dir.y, y: dir.x };
  const origin = { x: stair.x - dir.x * (tread * (n - 1)) / 2, y: stair.y - dir.y * (tread * (n - 1)) / 2 };

  for (let i = 1; i < n; i += 1) {
    const y0 = baseElevation + (i - 1) * riser;
    const y1 = baseElevation + i * riser;
    const x0 = origin.x + dir.x * (i - 1) * tread;
    const y0p = origin.y + dir.y * (i - 1) * tread;
    const x1 = origin.x + dir.x * i * tread;
    const y1p = origin.y + dir.y * i * tread;
    const p0 = { x: x0 - perp.x * w / 2, z: y0p - perp.y * w / 2 };
    const p1 = { x: x1 - perp.x * w / 2, z: y1p - perp.y * w / 2 };
    const p2 = { x: x1 + perp.x * w / 2, z: y1p + perp.y * w / 2 };
    const p3 = { x: x0 + perp.x * w / 2, z: y0p + perp.y * w / 2 };
    const bottom = stair.style === 'solid' ? baseElevation : y0;
    addBox(builder, p0, p1, p2, p3, bottom, y1);
  }
  return builder;
}

function addBox(builder, p0, p1, p2, p3, y0, y1) {
  const nTop = { x: 0, y: 1, z: 0 };
  const nBottom = { x: 0, y: -1, z: 0 };
  builder.addQuad(
    { x: p0.x, y: y1, z: p0.z }, { x: p1.x, y: y1, z: p1.z },
    { x: p2.x, y: y1, z: p2.z }, { x: p3.x, y: y1, z: p3.z }, nTop,
  );
  builder.addQuad(
    { x: p0.x, y: y0, z: p0.z }, { x: p3.x, y: y0, z: p3.z },
    { x: p2.x, y: y0, z: p2.z }, { x: p1.x, y: y0, z: p1.z }, nBottom,
  );
  const sides = [
    [p0, p1, { x: p1.z - p0.z, y: 0, z: -(p1.x - p0.x) }],
    [p1, p2, { x: p2.z - p1.z, y: 0, z: -(p2.x - p1.x) }],
    [p2, p3, { x: p3.z - p2.z, y: 0, z: -(p3.x - p2.x) }],
    [p3, p0, { x: p0.z - p3.z, y: 0, z: -(p0.x - p3.x) }],
  ];
  for (const [a, b, n] of sides) {
    const l = Math.hypot(n.x, n.z) || 1;
    const nn = { x: n.x / l, y: 0, z: n.z / l };
    builder.addQuad(
      { x: a.x, y: y0, z: a.z }, { x: b.x, y: y0, z: b.z },
      { x: b.x, y: y1, z: b.z }, { x: a.x, y: y1, z: a.z }, nn,
    );
  }
}
