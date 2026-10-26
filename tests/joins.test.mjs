import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeWallFootprints, signedMeshVolume } from '../www/js/geometry/joins.js';
import { buildWalls } from '../www/js/geometry/wall-builder.js';

test('inglete a 90° con espesores iguales', () => {
  const graph = {
    nodes: {
      a: { id: 'a', x: 0, y: 0 },
      b: { id: 'b', x: 10, y: 0 },
      c: { id: 'c', x: 0, y: 10 },
    },
    walls: {
      w1: { id: 'w1', a: 'a', b: 'b', thickness: 0.2, height: 2.7, kind: 'exterior' },
      w2: { id: 'w2', a: 'a', b: 'c', thickness: 0.2, height: 2.7, kind: 'exterior' },
    },
  };
  const fp = computeWallFootprints(graph);
  const left = fp.w1.start.left;
  assert.ok(Math.abs(left.x - 0.1) < 1e-9, `left.x=${left.x}`);
  assert.ok(Math.abs(left.y - 0.1) < 1e-9, `left.y=${left.y}`);
  // El punto derecho debe ser la reflexión respecto al nodo.
  const right = fp.w1.start.right;
  assert.ok(Math.abs(right.x - -0.1) < 1e-9, `right.x=${right.x}`);
  assert.ok(Math.abs(right.y - -0.1) < 1e-9, `right.y=${right.y}`);
});

test('volumen del anillo 10×8 con puerta y ventana', () => {
  const level = {
    nodes: {
      n1: { id: 'n1', x: 0, y: 0 }, n2: { id: 'n2', x: 10, y: 0 },
      n3: { id: 'n3', x: 10, y: 8 }, n4: { id: 'n4', x: 0, y: 8 },
    },
    walls: {
      w1: { id: 'w1', a: 'n1', b: 'n2', kind: 'exterior', thickness: 0.2, height: 2.7 },
      w2: { id: 'w2', a: 'n2', b: 'n3', kind: 'exterior', thickness: 0.2, height: 2.7 },
      w3: { id: 'w3', a: 'n3', b: 'n4', kind: 'exterior', thickness: 0.2, height: 2.7 },
      w4: { id: 'w4', a: 'n4', b: 'n1', kind: 'exterior', thickness: 0.2, height: 2.7 },
    },
    openings: {
      d1: { id: 'd1', wallId: 'w1', type: 'door', s: 5, width: 0.9, height: 2.1, sill: 0 },
      win1: { id: 'win1', wallId: 'w2', type: 'window', s: 4, width: 1.2, height: 1.2, sill: 0.9 },
    },
    perimeterLoop: ['n1', 'n2', 'n3', 'n4'],
  };
  const project = { settings: { wallHeight: 2.7, slabThickness: 0.2 } };
  const { builder } = buildWalls(project, level, 0);
  const geo = builder.build({
    BufferGeometry: class { setAttribute(k, v) { this[k] = v; } setIndex(v) { this.index = v; } computeBoundingSphere() {} },
    BufferAttribute: class { constructor(array) { this.array = array; } },
  });
  const vol = Math.abs(signedMeshVolume(geo.position.array, geo.index.array));
  // 19.44 (anillo) − 0.378 (puerta 0.9×2.1×0.2) − 0.288 (ventana 1.2×1.2×0.2) = 18.774
  // Tolerancia 1e-4 por acumulación de punto flotante en ~96 triángulos.
  assert.ok(Math.abs(vol - 18.774) < 1e-4, `volumen=${vol}, esperado 18.774`);
});
