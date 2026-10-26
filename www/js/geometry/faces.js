// === www/js/geometry/faces.js ===
/**
 * Detección de caras (ambientes) en un grafo planar usando semiaristas.
 * En cada nodo se toma la siguiente semiarista en sentido horario respecto
 * a la dirección de RETORNO. El anillo exterior se descarta comparando su
 * área con el área del perímetro conocido (perimeterLoop); si no hay
 * perímetro disponible, cae a descartar la cara de mayor área.
 */
import { EPS } from '../core/constants.js';
import { area2 } from './polygon.js';

export function detectFaces(graph) {
  const nodes = Object.values(graph.nodes ?? {});
  const walls = Object.values(graph.walls ?? {});
  if (nodes.length === 0 || walls.length === 0) return [];

  const perimeterLoop = graph.perimeterLoop ?? null;

  // Semiaristas y lista de salida por nodo ordenada por ángulo.
  const halfEdges = [];
  for (const w of walls) {
    halfEdges.push({ from: w.a, to: w.b });
    halfEdges.push({ from: w.b, to: w.a });
  }
  const outgoing = new Map();
  for (const he of halfEdges) {
    const a = graph.nodes[he.from];
    const b = graph.nodes[he.to];
    if (!a || !b) continue;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    if (!outgoing.has(he.from)) outgoing.set(he.from, []);
    outgoing.get(he.from).push({ he, angle });
  }
  for (const list of outgoing.values()) list.sort((x, y) => x.angle - y.angle);

  function nextHalfEdge(cur) {
    const list = outgoing.get(cur.to);
    if (!list || list.length === 0) return null;
    let idx = -1;
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].he.to === cur.from) { idx = i; break; }
    }
    if (idx < 0) return null;
    const nextIdx = (idx - 1 + list.length) % list.length;
    return list[nextIdx].he;
  }

  const visited = new Set();
  const faces = [];
  for (const start of halfEdges) {
    const key = `${start.from}->${start.to}`;
    if (visited.has(key)) continue;
    const pts = [];
    let cur = start;
    let guard = 0;
    while (guard++ < halfEdges.length * 2 + 10) {
      const k = `${cur.from}->${cur.to}`;
      if (visited.has(k) && pts.length > 0) break;
      visited.add(k);
      pts.push(cur.from);
      const next = nextHalfEdge(cur);
      if (!next) break;
      if (next.from === start.from && next.to === start.to) break;
      cur = next;
    }
    if (pts.length >= 3) {
      const polygon = pts.map((id) => graph.nodes[id]).filter(Boolean);
      if (polygon.length < 3) continue;
      const a2 = area2(polygon);
      if (Math.abs(a2) < 1e-9) continue;
      faces.push({
        nodeIds: pts.slice(),
        points: polygon,
        area: Math.abs(a2) / 2,
        orientation: Math.sign(a2),
      });
    }
  }

  if (faces.length <= 1) return [];

  // Descartar la cara exterior comparando con el área del perímetro.
  if (perimeterLoop && perimeterLoop.length >= 3) {
    const loop = perimeterLoop.map((id) => graph.nodes[id]).filter(Boolean);
    if (loop.length >= 3) {
      const outerArea = Math.abs(area2(loop)) / 2;
      const filtered = faces.filter((f) => Math.abs(f.area - outerArea) > 0.01);
      if (filtered.length > 0 && filtered.length < faces.length) return filtered;
    }
  }

  // Fallback: descartar la mayor.
  faces.sort((a, b) => b.area - a.area);
  return faces.slice(1);
}
