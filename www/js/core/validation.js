// === www/js/core/validation.js ===
/**
 * Validaciones puras de proyecto y geometría. Cada issue tiene la forma
 * `{code, severity, phase, message, target:{levelId,kind,id}}`. No importa DOM.
 */
import { EPS, MIN_WALL_LENGTH, MIN_OPENING_EDGE_OFFSET } from './constants.js';
import { area2, isSimplePolygon, pointInPolygon, polygonSelfIntersects } from '../geometry/polygon.js';

function issue(code, severity, phase, message, target = {}) {
  return { code, severity, phase, message, target };
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function validateClosedPolygon(points, { phase, label = 'polígono' } = {}) {
  const errors = [];
  if (!Array.isArray(points) || points.length < 3) {
    errors.push(issue('polygon.tooFewPoints', 'error', phase, `El ${label} necesita al menos 3 puntos`));
    return { ok: false, errors, warnings: [] };
  }
  if (polygonSelfIntersects(points)) {
    errors.push(issue('polygon.selfIntersection', 'error', phase, `El ${label} se autointersecta`));
  }
  if (Math.abs(area2(points)) < EPS) {
    errors.push(issue('polygon.zeroArea', 'error', phase, `El ${label} tiene área cero`));
  }
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (dist(a, b) < 0.30 - EPS) {
      errors.push(issue('polygon.edgeTooShort', 'error', phase, `Un lado del ${label} mide menos de 0.30 m`));
      break;
    }
  }
  if (!isSimplePolygon(points)) {
    errors.push(issue('polygon.notSimple', 'error', phase, `El ${label} no es simple`));
  }
  return { ok: errors.length === 0, errors, warnings: [] };
}

export function validateSite(project) {
  const errors = [];
  const warnings = [];
  const site = project.site ?? {};
  const { lot, street, gallery } = site;

  if (!lot) {
    errors.push(issue('site.lot.missing', 'error', 'SITE', 'Falta el límite del lote'));
  } else {
    const r = validateClosedPolygon(lot, { phase: 'SITE', label: 'lote' });
    errors.push(...r.errors);
    if (r.ok) {
      const area = Math.abs(area2(lot)) / 2;
      if (area <= 0) errors.push(issue('site.lot.zeroArea', 'error', 'SITE', 'El lote no tiene área'));
    }
  }

  if (street) {
    if (!Array.isArray(street.polyline) || street.polyline.length < 2) {
      errors.push(issue('site.street.tooFewPoints', 'error', 'SITE', 'La calle necesita al menos 2 puntos'));
    }
    if (!(street.width > 0)) {
      errors.push(issue('site.street.invalidWidth', 'error', 'SITE', 'El ancho de la calle debe ser positivo'));
    }
  }

  if (gallery) {
    const r = validateClosedPolygon(gallery.polygon, { phase: 'SITE', label: 'galería' });
    errors.push(...r.errors);
    if (r.ok && lot && !gallery.polygon.every((p) => pointInPolygon(p, lot))) {
      warnings.push(issue('site.gallery.outsideLot', 'warning', 'SITE', 'La galería sobresale del lote'));
    }
  }

  return { SITE: { ok: errors.length === 0, errors, warnings } };
}

export function validatePerimeter(project) {
  const errors = [];
  const warnings = [];
  const level = project.levels[0];
  if (!level) return { PERIMETER: { ok: false, errors: [issue('perimeter.noLevel', 'error', 'PERIMETER', 'No hay planta baja')], warnings } };

  const loop = level.perimeterLoop.map((id) => level.nodes[id]).filter(Boolean);
  if (loop.length < 3) {
    errors.push(issue('perimeter.missing', 'error', 'PERIMETER', 'Falta el perímetro cerrado de la casa'));
    return { PERIMETER: { ok: false, errors, warnings } };
  }

  const r = validateClosedPolygon(loop, { phase: 'PERIMETER', label: 'perímetro' });
  errors.push(...r.errors);

  const lot = project.site?.lot;
  if (lot && r.ok) {
    for (const p of loop) {
      if (!pointInPolygon(p, lot)) {
        errors.push(issue('perimeter.outsideLot', 'error', 'PERIMETER', 'El perímetro no está íntegramente dentro del lote'));
        break;
      }
    }
  }

  const gallery = project.site?.gallery;
  if (gallery && r.ok) {
    const overlaps = loop.some((p) => pointInPolygon(p, gallery.polygon));
    if (overlaps) warnings.push(issue('perimeter.overlapsGallery', 'warning', 'PERIMETER', 'El perímetro se solapa con la galería'));
  }

  return { PERIMETER: { ok: errors.length === 0, errors, warnings } };
}

export function validateLevel(project, levelId) {
  const errors = [];
  const warnings = [];
  const level = project.levels.find((l) => l.id === levelId);
  if (!level) return { errors: [issue('level.missing', 'error', null, `Nivel ${levelId} no existe`)], warnings };

  for (const wall of Object.values(level.walls)) {
    const a = level.nodes[wall.a];
    const b = level.nodes[wall.b];
    if (!a || !b) {
      errors.push(issue('wall.missingNode', 'error', null, 'Muro con nodo inexistente', { levelId, kind: 'wall', id: wall.id }));
      continue;
    }
    const len = dist(a, b);
    if (len < MIN_WALL_LENGTH - EPS) {
      errors.push(issue('wall.tooShort', 'error', null, `Muro más corto que ${MIN_WALL_LENGTH} m`, { levelId, kind: 'wall', id: wall.id }));
    }
    if (!(wall.thickness > 0) || !(wall.height > 0)) {
      errors.push(issue('wall.invalidDimensions', 'error', null, 'Espesor o altura de muro inválidos', { levelId, kind: 'wall', id: wall.id }));
    }
  }

  for (const opening of Object.values(level.openings)) {
    const wall = level.walls[opening.wallId];
    if (!wall) {
      errors.push(issue('opening.missingWall', 'error', null, 'Abertura sin muro', { levelId, kind: 'opening', id: opening.id }));
      continue;
    }
    const a = level.nodes[wall.a];
    const b = level.nodes[wall.b];
    if (!a || !b) continue;
    const len = dist(a, b);
    const halfW = opening.width / 2;
    if (opening.width <= EPS) {
      errors.push(issue('opening.zeroWidth', 'error', null, 'Abertura con ancho cero', { levelId, kind: 'opening', id: opening.id }));
    }
    if (opening.s - halfW < MIN_OPENING_EDGE_OFFSET - EPS || opening.s + halfW > len - MIN_OPENING_EDGE_OFFSET + EPS) {
      errors.push(issue('opening.outOfWall', 'error', null, `Abertura demasiado cerca del extremo del muro (mínimo ${MIN_OPENING_EDGE_OFFSET} m)`, { levelId, kind: 'opening', id: opening.id }));
    }
    if (opening.sill + opening.height > wall.height + EPS) {
      errors.push(issue('opening.tooTall', 'error', null, 'La abertura supera la altura del muro', { levelId, kind: 'opening', id: opening.id }));
    }
  }

  const byWall = new Map();
  for (const o of Object.values(level.openings)) {
    const arr = byWall.get(o.wallId) ?? [];
    arr.push(o);
    byWall.set(o.wallId, arr);
  }
  for (const [wallId, list] of byWall) {
    list.sort((x, y) => x.s - y.s);
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1];
      const curr = list[i];
      if (prev.s + prev.width / 2 > curr.s - curr.width / 2 + EPS) {
        errors.push(issue('opening.overlap', 'error', null, `Aberturas solapadas en el muro ${wallId}`, { levelId, kind: 'opening', id: curr.id }));
      }
    }
  }

  return { errors, warnings };
}

export function validateLevel2(project) {
  const errors = [];
  const warnings = [];
  const l2 = project.levels[1];
  if (!l2) {
    errors.push(issue('level2.missing', 'error', 'LEVEL_2', 'No existe la segunda planta'));
    return { errors, warnings };
  }

  const loop = l2.perimeterLoop.map((id) => l2.nodes[id]).filter(Boolean);
  if (loop.length < 3) {
    errors.push(issue('level2.perimeter.missing', 'error', 'LEVEL_2', 'Falta el perímetro de la segunda planta'));
  } else {
    const r = validateClosedPolygon(loop, { phase: 'LEVEL_2', label: 'perímetro de L2' });
    errors.push(...r.errors);
  }

  const stairs = project.stairs.filter((s) => s.toLevelId === l2.id);
  if (stairs.length === 0) {
    errors.push(issue('level2.stair.missing', 'error', 'LEVEL_2', 'Falta la escalera hacia la segunda planta'));
  }
  for (const stair of stairs) {
    const hole = stair.holePolygon ?? [];
    if (hole.length >= 3 && loop.length >= 3) {
      const inner = offsetPolygonInward(loop, 0.05);
      for (const p of hole) {
        if (!pointInPolygon(p, inner)) {
          errors.push(issue('level2.stair.outsideInner', 'error', 'LEVEL_2', 'El hueco de escalera no está dentro del anillo interior de L2', { levelId: l2.id, kind: 'stair', id: stair.id }));
          break;
        }
      }
    }
  }

  if (!l2.labels.some((l) => l.type === 'pasillo')) {
    errors.push(issue('level2.corridor.missing', 'error', 'LEVEL_2', 'Falta al menos un ambiente tipo pasillo'));
  }

  if (l2.labels.length === 0) {
    warnings.push(issue('level2.labels.empty', 'warning', 'LEVEL_2', 'La segunda planta no tiene etiquetas de ambiente'));
  }

  return { errors, warnings };
}

function offsetPolygonInward(points, d) {
  const n = points.length;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const e0 = norm({ x: p1.x - p0.x, y: p1.y - p0.y });
    const e1 = norm({ x: p2.x - p1.x, y: p2.y - p1.y });
    const n0 = { x: -e0.y, y: e0.x };
    const n1 = { x: -e1.y, y: e1.x };
    const a0 = { x: p1.x + n0.x * d, y: p1.y + n0.y * d };
    const a1 = { x: p1.x + n1.x * d, y: p1.y + n1.y * d };
    const dir0 = { x: e0.x, y: e0.y };
    const dir1 = { x: e1.x, y: e1.y };
    const den = dir0.x * dir1.y - dir0.y * dir1.x;
    if (Math.abs(den) < EPS) {
      out.push({ x: (a0.x + a1.x) / 2, y: (a0.y + a1.y) / 2 });
    } else {
      const t = ((a1.x - a0.x) * dir1.y - (a1.y - a0.y) * dir1.x) / den;
      out.push({ x: a0.x + dir0.x * t, y: a0.y + dir0.y * t });
    }
  }
  return out;
}

function norm(v) {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}
