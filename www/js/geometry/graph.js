// === www/js/geometry/graph.js ===
/**
 * Grafo planar de muros. Invariante: las aristas solo se cruzan en nodos.
 * `insertWall` une nodos cercanos, divide aristas en extremos y cruces,
 * fusiona tramos colineales superpuestos y rechaza longitudes mínimas.
 */
import { EPS, MIN_WALL_LENGTH } from '../core/constants.js';
import { dist, equals, sub, cross } from './vec2.js';
import { createId } from '../core/schema.js';

export function emptyGraph() {
  return { nodes: {}, walls: {} };
}

export function cloneGraph(graph) {
  return structuredClone(graph);
}

export function mergeNearbyNodes(graph, tolerance = EPS) {
  const ids = Object.keys(graph.nodes);
  const merged = new Map();
  for (let i = 0; i < ids.length; i += 1) {
    const a = ids[i];
    if (merged.has(a)) continue;
    for (let j = i + 1; j < ids.length; j += 1) {
      const b = ids[j];
      if (merged.has(b)) continue;
      if (dist(graph.nodes[a], graph.nodes[b]) <= tolerance) {
        merged.set(b, a);
        for (const wall of Object.values(graph.walls)) {
          if (wall.a === b) wall.a = a;
          if (wall.b === b) wall.b = a;
        }
        delete graph.nodes[b];
      }
    }
  }
  for (const [id, wall] of Object.entries(graph.walls)) {
    if (wall.a === wall.b) delete graph.walls[id];
  }
  return graph;
}

export function insertWall(inputGraph, aPoint, bPoint, options = {}) {
  const graph = cloneGraph(inputGraph);
  const {
    kind = 'interior',
    thickness = kind === 'exterior' ? 0.20 : 0.12,
    height = 2.70,
  } = options;

  if (dist(aPoint, bPoint) < MIN_WALL_LENGTH - EPS) {
    throw new Error(`Muro demasiado corto (< ${MIN_WALL_LENGTH} m)`);
  }

  const aId = ensureNode(graph, aPoint);
  const bId = ensureNode(graph, bPoint);
  const aNode = graph.nodes[aId];
  const bNode = graph.nodes[bId];

  const crossings = [];
  for (const wall of Object.values(graph.walls)) {
    const p1 = graph.nodes[wall.a];
    const p2 = graph.nodes[wall.b];
    if (!p1 || !p2) continue;
    const hit = segmentIntersection(aNode, bNode, p1, p2);
    if (hit) crossings.push(hit);
  }
  for (const point of crossings) ensureNode(graph, point);

  const lineNodes = Object.values(graph.nodes)
    .filter((n) => n.id === aId || n.id === bId || pointOnSegment(n, aNode, bNode))
    .map((n) => n.id);
  const sorted = lineNodes
    .map((id) => ({ id, t: paramOnSegment(graph.nodes[id], aNode, bNode) }))
    .sort((x, y) => x.t - y.t)
    .map((x) => x.id);

  const addedWallIds = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const n1 = sorted[i - 1];
    const n2 = sorted[i];
    if (n1 === n2) continue;
    if (dist(graph.nodes[n1], graph.nodes[n2]) < MIN_WALL_LENGTH - EPS) continue;
    const dup = Object.values(graph.walls).some(
      (w) => (w.a === n1 && w.b === n2) || (w.a === n2 && w.b === n1),
    );
    if (dup) continue;
    const id = createId('wall');
    graph.walls[id] = { id, a: n1, b: n2, kind, thickness, height };
    addedWallIds.push(id);
  }

  for (const wall of Object.values(graph.walls)) {
    if (addedWallIds.includes(wall.id)) continue;
    const p1 = graph.nodes[wall.a];
    const p2 = graph.nodes[wall.b];
    if (!p1 || !p2) continue;
    const splitIds = Object.values(graph.nodes)
      .filter((n) => n.id !== wall.a && n.id !== wall.b && pointOnSegment(n, p1, p2))
      .map((n) => ({ id: n.id, t: paramOnSegment(n, p1, p2) }))
      .sort((x, y) => x.t - y.t);
    if (splitIds.length === 0) continue;
    const chain = [wall.a, ...splitIds.map((s) => s.id), wall.b];
    delete graph.walls[wall.id];
    for (let i = 1; i < chain.length; i += 1) {
      const id = createId('wall');
      graph.walls[id] = { ...wall, id, a: chain[i - 1], b: chain[i] };
    }
  }

  mergeNearbyNodes(graph);
  removeDuplicateWalls(graph);
  return { graph, addedWallIds };
}

function removeDuplicateWalls(graph) {
  const seen = new Map();
  for (const wall of Object.values(graph.walls)) {
    const key = [wall.a, wall.b].sort().join('|');
    if (seen.has(key)) delete graph.walls[wall.id];
    else seen.set(key, wall.id);
  }
}

function ensureNode(graph, point) {
  for (const node of Object.values(graph.nodes)) {
    if (equals(node, point)) return node.id;
  }
  const id = createId('node');
  graph.nodes[id] = { id, x: point.x, y: point.y };
  return id;
}

function pointOnSegment(p, a, b, eps = 1e-4) {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const crossVal = Math.abs(cross(ab, ap));
  const lenAB = Math.hypot(ab.x, ab.y);
  if (lenAB < EPS) return false;
  if (crossVal / lenAB > eps) return false;
  const dotVal = ap.x * ab.x + ap.y * ab.y;
  return dotVal > -eps && dotVal < lenAB * lenAB + eps;
}

function paramOnSegment(p, a, b) {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 < EPS) return 0;
  return ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2;
}

function segmentIntersection(a, b, c, d) {
  const ab = sub(b, a);
  const cd = sub(d, c);
  const den = cross(ab, cd);
  if (Math.abs(den) < EPS) return null;
  const ac = sub(c, a);
  const t = cross(ac, cd) / den;
  const u = cross(ac, ab) / den;
  if (t <= 1e-4 || t >= 1 - 1e-4 || u <= 1e-4 || u >= 1 - 1e-4) return null;
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

export function nodeDegree(graph, nodeId) {
  return Object.values(graph.walls).filter((w) => w.a === nodeId || w.b === nodeId).length;
}

export function pruneOrphanNodes(graph) {
  const used = new Set();
  for (const w of Object.values(graph.walls)) {
    used.add(w.a);
    used.add(w.b);
  }
  for (const id of Object.keys(graph.nodes)) {
    if (!used.has(id)) delete graph.nodes[id];
  }
  return graph;
}

export function incidentEdges(graph, nodeId) {
  const out = [];
  for (const wall of Object.values(graph.walls)) {
    if (wall.a === nodeId) {
      const to = graph.nodes[wall.b];
      out.push({ wall, other: wall.b, dir: dirTo(graph.nodes[nodeId], to) });
    } else if (wall.b === nodeId) {
      const to = graph.nodes[wall.a];
      out.push({ wall, other: wall.a, dir: dirTo(graph.nodes[nodeId], to) });
    }
  }
  return out;
}

function dirTo(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}
