// === www/js/geometry/faces.js ===
/**
 * Detección de caras (ambientes) en un grafo planar usando semiaristas.
 * En cada nodo se toma la siguiente semiarista en sentido horario respecto
 * a la dirección de RETORNO (backDir = dirección desde el nodo hacia el
 * origen del half-edge). Esa convención produce caras interiores con área
 * positiva (CCW); la cara exterior se descarta por tener el área de mayor
 * magnitud (o signo opuesto).
 */
import { EPS } from '../core/constants.js';
import { area2 } from './polygon.js';

export function detectFaces(graph) {
  const halfEdges = buildHalfEdges(graph);
  const visited = new Set();
  const faces = [];

  for (const he of halfEdges) {
    const key = `${he.from}->${he.to}`;
    if (visited.has(key)) continue;
    const face = walkFace(graph, halfEdges, he, visited);
    if (face.length >= 3) {
      const pts = face
        .map((id) => graph.nodes[id])
        .filter(Boolean)
        .map((n) => ({ x: n.x, y: n.y }));
      const a2 = area2(pts);
      if (Math.abs(a2) > EPS) {
        faces.push({
          nodeIds: face,
          points: pts,
          area: Math.abs(a2) / 2,
          orientation: Math.sign(a2),
        });
      }
    }
  }

  if (faces.length > 1) {
    faces.sort((a, b) => b.area - a.area);
    return faces.filter((_, i) => i !== 0);
  }
  return faces;
}

function buildHalfEdges(graph) {
  const out = [];
  for (const wall of Object.values(graph.walls)) {
    out.push({ from: wall.a, to: wall.b, wallId: wall.id });
    out.push({ from: wall.b, to: wall.a, wallId: wall.id });
  }
  return out;
}

function walkFace(graph, halfEdges, start, visited) {
  const face = [start.from];
  let current = start;
  let guard = 0;
  while (guard < halfEdges.length * 2 + 4) {
    guard += 1;
    const key = `${current.from}->${current.to}`;
    visited.add(key);
    face.push(current.to);
    const next = nextHalfEdge(graph, halfEdges, current);
    if (!next) break;
    if (next.from === start.from && next.to === start.to) break;
    current = next;
  }
  if (face.length > 1 && face[0] === face[face.length - 1]) face.pop();
  return face;
}

function nextHalfEdge(graph, halfEdges, current) {
  const from = graph.nodes[current.from];
  const to = graph.nodes[current.to];
  if (!from || !to) return null;

  // Dirección "de vuelta": desde el nodo actual hacia el origen del half-edge.
  const backDir = Math.atan2(from.y - to.y, from.x - to.x);

  const candidates = halfEdges.filter((he) => he.from === current.to);
  if (candidates.length === 0) return null;

  let best = null;
  let bestDelta = Infinity;
  for (const he of candidates) {
    const target = graph.nodes[he.to];
    if (!target) continue;
    const ang = Math.atan2(target.y - to.y, target.x - to.x);
    // Ángulo CW desde backDir hasta la salida, normalizado a (0, 2π].
    let delta = backDir - ang;
    while (delta <= 0) delta += 2 * Math.PI;
    while (delta > 2 * Math.PI) delta -= 2 * Math.PI;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = he;
    }
  }
  return best;
}
