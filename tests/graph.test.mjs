import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertWall, nodeDegree } from '../www/js/geometry/graph.js';

test('T-junction divide la arista pasante', () => {
  let g = insertWall({ nodes: {}, walls: {} }, { x: 0, y: 0 }, { x: 10, y: 0 }).graph;
  assert.equal(Object.keys(g.walls).length, 1);
  g = insertWall(g, { x: 5, y: 0 }, { x: 5, y: 5 }).graph;
  const horizontals = Object.values(g.walls).filter((w) => {
    const a = g.nodes[w.a], b = g.nodes[w.b];
    return a.y === 0 && b.y === 0;
  });
  assert.equal(horizontals.length, 2);
  assert.equal(Object.keys(g.nodes).length, 4);
});

test('cruce en X crea nodo y 4 aristas', () => {
  let g = insertWall({ nodes: {}, walls: {} }, { x: -5, y: 0 }, { x: 5, y: 0 }).graph;
  g = insertWall(g, { x: 0, y: -5 }, { x: 0, y: 5 }).graph;
  assert.equal(Object.keys(g.nodes).length, 5);
  assert.equal(Object.keys(g.walls).length, 4);
  const center = Object.values(g.nodes).find((n) => n.x === 0 && n.y === 0);
  assert.ok(center);
  assert.equal(nodeDegree(g, center.id), 4);
});

test('rechazo de muros demasiado cortos', () => {
  assert.throws(
    () => insertWall({ nodes: {}, walls: {} }, { x: 0, y: 0 }, { x: 0.01, y: 0 }),
    /demasiado corto/,
  );
});
