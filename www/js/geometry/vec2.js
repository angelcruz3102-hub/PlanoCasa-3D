// === www/js/geometry/vec2.js ===
/** Operaciones 2D puras sobre `{x, y}`. No dependen de three ni del DOM. */
import { EPS } from '../core/constants.js';

export const v = (x, y) => ({ x, y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const distSq = (a, b) => (b.x - a.x) ** 2 + (b.y - a.y) ** 2;

export function norm(a) {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

export function leftNormal(dir) {
  return { x: -dir.y, y: dir.x };
}

export function rightNormal(dir) {
  return { x: dir.y, y: -dir.x };
}

export function projectOnLine(p, a, dir) {
  return dot(sub(p, a), dir);
}

export function closestPointOnSegment(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 < EPS ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return { point: add(a, mul(ab, t)), t };
}

export function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function equals(a, b, eps = EPS) {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}
