// === www/js/geometry/site-builder.js ===
import { SITE_ELEVATIONS } from '../core/constants.js';
import { GeometryBuilder } from './geometry-builder.js';

export function buildSite(project) {
  const builder = new GeometryBuilder();
  const { site } = project;

  const S = SITE_ELEVATIONS.basePlaneSize;
  const yT = SITE_ELEVATIONS.terrain;
  builder.addQuad(
    { x: -S / 2, y: yT, z: -S / 2 }, { x: S / 2, y: yT, z: -S / 2 },
    { x: S / 2, y: yT, z: S / 2 }, { x: -S / 2, y: yT, z: S / 2 },
    { x: 0, y: 1, z: 0 },
  );

  if (site?.lot) addLotEdge(builder, site.lot, site.lotEdgeStyle ?? 'line');
  if (site?.street?.polyline?.length >= 2) addStreet(builder, site.street);
  if (site?.gallery?.polygon?.length >= 3) addGallery(builder, site.gallery);

  return builder;
}

function addLotEdge(builder, lot, style) {
  const y0 = SITE_ELEVATIONS.terrain;
  const height = style === 'lowWall' ? SITE_ELEVATIONS.lotWallLow
    : style === 'fence' ? SITE_ELEVATIONS.lotFenceHigh : 0;
  const thickness = SITE_ELEVATIONS.lotWallThickness;
  for (let i = 0; i < lot.length; i += 1) {
    const a = lot[i];
    const b = lot[(i + 1) % lot.length];
    if (style === 'line') addThinBox(builder, a, b, y0, y0 + 0.02, thickness * 0.2);
    else addThinBox(builder, a, b, y0, y0 + height, thickness);
  }
}

function addStreet(builder, street) {
  const y = SITE_ELEVATIONS.street;
  const w = street.width;
  const pts = street.polyline;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const p0 = { x: a.x + nx * w / 2, z: a.y + ny * w / 2 };
    const p1 = { x: b.x + nx * w / 2, z: b.y + ny * w / 2 };
    const p2 = { x: b.x - nx * w / 2, z: b.y - ny * w / 2 };
    const p3 = { x: a.x - nx * w / 2, z: a.y - ny * w / 2 };
    builder.addQuad(
      { x: p0.x, y, z: p0.z }, { x: p1.x, y, z: p1.z },
      { x: p2.x, y, z: p2.z }, { x: p3.x, y, z: p3.z },
      { x: 0, y: 1, z: 0 },
    );
    if (street.sidewalk?.enabled) {
      const sw = street.sidewalk.width;
      const sy = SITE_ELEVATIONS.sidewalk;
      for (const sign of [1, -1]) {
        const q0 = { x: a.x + nx * sign * (w / 2 + sw), z: a.y + ny * sign * (w / 2 + sw) };
        const q1 = { x: b.x + nx * sign * (w / 2 + sw), z: b.y + ny * sign * (w / 2 + sw) };
        const q2 = { x: b.x + nx * sign * w / 2, z: b.y + ny * sign * w / 2 };
        const q3 = { x: a.x + nx * sign * w / 2, z: a.y + ny * sign * w / 2 };
        builder.addQuad(
          { x: q0.x, y: sy, z: q0.z }, { x: q1.x, y: sy, z: q1.z },
          { x: q2.x, y: sy, z: q2.z }, { x: q3.x, y: sy, z: q3.z },
          { x: 0, y: 1, z: 0 },
        );
      }
    }
  }
}

function addGallery(builder, gallery) {
  const yTop = SITE_ELEVATIONS.gallerySlabTop;
  const th = SITE_ELEVATIONS.gallerySlabThickness;
  const pts = gallery.polygon;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const a = pts[0], b = pts[i], c = pts[i + 1];
    builder.addTriangle(
      { x: a.x, y: yTop, z: a.y }, { x: b.x, y: yTop, z: b.y },
      { x: c.x, y: yTop, z: c.y }, { x: 0, y: 1, z: 0 },
    );
  }
  if (gallery.columns) {
    for (const p of pts) {
      addThinBox(builder, { x: p.x - 0.10, y: p.y - 0.10 }, { x: p.x + 0.10, y: p.y + 0.10 }, yTop - th, yTop, 0.20);
    }
  }
}

function addThinBox(builder, a, b, y0, y1, thickness) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * thickness / 2;
  const ny = (dx / l) * thickness / 2;
  const p0 = { x: a.x + nx, z: a.y + ny };
  const p1 = { x: b.x + nx, z: b.y + ny };
  const p2 = { x: b.x - nx, z: b.y - ny };
  const p3 = { x: a.x - nx, z: a.y - ny };
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
  for (const [q0, q1, n] of sides) {
    const ll = Math.hypot(n.x, n.z) || 1;
    const nn = { x: n.x / ll, y: 0, z: n.z / ll };
    builder.addQuad(
      { x: q0.x, y: y0, z: q0.z }, { x: q1.x, y: y0, z: q1.z },
      { x: q1.x, y: y1, z: q1.z }, { x: q0.x, y: y1, z: q0.z }, nn,
    );
  }
}
