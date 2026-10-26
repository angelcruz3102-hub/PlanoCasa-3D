// === www/js/geometry/joins.js ===
/**
 * Uniones e ingletes. Calcula, por muro y extremo, los puntos izquierdo y
 * derecho de la huella. Reglas:
 * - Grado 1: extremo recto.
 * - Grado 2: inglete con fórmula cerrada. `n1` y `n2` DEBEN apuntar al mismo
 *   lado del corner (ambos hacia el interior del miter). Para lograrlo,
 *   n1 = leftNormal(dirOut) y n2 = rightNormal(otherEdge.dir) — la segunda
 *   normal se invierte porque `otherEdge.dir` apunta LEJOS del nodo, mientras
 *   `dirOut` apunta desde el nodo hacia el otro extremo de este muro.
 * - Si 1+n1·n2 < ε o el miter excede miterLimit·h, se usa bisel de dos puntos.
 * - Grado ≥ 3: se busca un par antiparalelo (muro pasante) y los demás
 *   terminan rectos; si no hay par, cada muro termina prolongado t_max/2.
 *
 * El punto `right` se calcula por reflexión del `left` a través del nodo:
 * right = 2·N − left. Esto es exacto cuando n1·n2 = (−n1)·(−n2), es decir,
 * siempre, y evita duplicar la fórmula.
 */
import { EPS } from '../core/constants.js';
import { add, mul, norm, sub, dot, leftNormal, rightNormal } from './vec2.js';
import { incidentEdges } from './graph.js';

const MITER_LIMIT = 2.0;

export function computeWallFootprints(graph) {
  const result = {};
  for (const wall of Object.values(graph.walls)) {
    const a = graph.nodes[wall.a];
    const b = graph.nodes[wall.b];
    if (!a || !b) continue;
    const dir = norm(sub(b, a));
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const h = wall.thickness / 2;
    result[wall.id] = {
      start: endpointsAtNode(graph, wall, a, b, dir, h),
      end: endpointsAtNode(graph, wall, b, a, mul(dir, -1), h),
      axis: { origin: { ...a }, dir, length: len },
    };
  }
  return result;
}

function endpointsAtNode(graph, wall, node, other, dirOut, h) {
  const edges = incidentEdges(graph, node.id);
  const degree = edges.length;

  if (degree <= 1) return straightEnd(node, dirOut, h);

  if (degree === 2) {
    const otherEdge = edges.find((e) => e.wall.id !== wall.id);
    if (!otherEdge) return straightEnd(node, dirOut, h);
    const n1 = leftNormal(dirOut);
    // FLIP: la otra arista apunta LEJOS del nodo, así que su "derecha"
    // coincide con la "izquierda" de este muro respecto al interior del
    // corner. Sin esta inversión el miter sale en el cuadrante opuesto.
    const n2 = rightNormal(otherEdge.dir);
    const hOther = otherEdge.wall.thickness / 2;
    return miterOrBevel(node, n1, n2, h, hOther);
  }

  // Grado ≥ 3: buscar muro pasante (par antiparalelo).
  const passThrough = edges.find(
    (e) => e.wall.id !== wall.id && dot(dirOut, e.dir) < -1 + 1e-3,
  );
  if (passThrough) {
    const n1 = leftNormal(dirOut);
    const n2 = rightNormal(passThrough.dir);
    const hOther = passThrough.wall.thickness / 2;
    return miterOrBevel(node, n1, n2, h, hOther);
  }

  // Unión en Y: prolongar recto hasta t_max/2.
  const maxT = Math.max(...edges.map((e) => e.wall.thickness / 2));
  const ext = maxT / 2;
  return {
    left: add(node, add(mul(dirOut, -ext), mul(leftNormal(dirOut), h))),
    right: add(node, add(mul(dirOut, -ext), mul(leftNormal(dirOut), -h))),
  };
}

function straightEnd(node, dir, h) {
  const n = leftNormal(dir);
  return {
    left: add(node, mul(n, h)),
    right: add(node, mul(n, -h)),
  };
}

function miterOrBevel(node, n1, n2, h1, h2) {
  const denom = 1 + dot(n1, n2);
  if (Math.abs(denom) < 1e-3) {
    return bevel(node, n1, n2, h1, h2);
  }
  // Punto interior del inglete (n1 y n2 apuntan al mismo lado).
  const offset = add(mul(n1, h1), mul(n2, h2));
  const left = { x: node.x + offset.x / denom, y: node.y + offset.y / denom };
  const hAvg = (h1 + h2) / 2;
  if (Math.hypot(left.x - node.x, left.y - node.y) > MITER_LIMIT * hAvg) {
    return bevel(node, n1, n2, h1, h2);
  }
  // Reflejo exacto del punto izquierdo a través del nodo.
  const right = { x: 2 * node.x - left.x, y: 2 * node.y - left.y };
  return { left, right };
}

function bevel(node, n1, n2, h1, h2) {
  return {
    left: add(node, mul(n1, h1)),
    right: add(node, mul(n2, -h2)),
  };
}

/** Volumen firmado de un conjunto de triángulos (para pruebas de muros). */
export function signedMeshVolume(positions, indices) {
  let vol = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    vol += (
      ax * (by * cz - bz * cy)
      + ay * (bz * cx - bx * cz)
      + az * (bx * cy - by * cx)
    ) / 6;
  }
  return vol;
}
