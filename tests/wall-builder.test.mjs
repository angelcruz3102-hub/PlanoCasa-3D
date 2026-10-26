import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWalls, levelElevation } from '../www/js/geometry/wall-builder.js';

function fakeThree() {
  return {
    BufferGeometry: class { setAttribute(k, v) { this[k] = v; } setIndex(v) { this.index = v; } computeBoundingSphere() {} },
    BufferAttribute: class { constructor(array) { this.array = array; } },
  };
}

test('elevación por nivel', () => {
  const project = { settings: { wallHeight: 2.7, slabThickness: 0.2 } };
  assert.equal(levelElevation(project, 0), 0);
  assert.ok(Math.abs(levelElevation(project, 1) - 2.9) < 1e-9);
});

test('dintel y antepecho generan prismas', () => {
  const level = {
    nodes: { a: { id: 'a', x: 0, y: 0 }, b: { id: 'b', x: 10, y: 0 } },
    walls: { w: { id: 'w', a: 'a', b: 'b', kind: 'exterior', thickness: 0.2, height: 2.7 } },
    openings: { win: { id: 'win', wallId: 'w', type: 'window', s: 5, width: 1.2, height: 1.2, sill: 0.9 } },
    perimeterLoop: ['a', 'b'],
  };
  const project = { settings: { wallHeight: 2.7, slabThickness: 0.2 } };
  const { builder } = buildWalls(project, level, 0);
  const geo = builder.build(fakeThree());
  assert.ok(geo.position.array.length > 0);
  // Cada prisma cerrado tiene 6 caras × 2 triángulos × 3 vértices = 36 vértices.
  // Un muro con una ventana genera 4 prismas: tramo macizo, antepecho, dintel, tramo macizo.
  const VERTEX_FLOATS = 36 * 3;
  const prismCount = geo.position.array.length / VERTEX_FLOATS;
  assert.equal(prismCount, 4, `prismas=${prismCount}, esperado 4`);
});
