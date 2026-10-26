import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStairMetrics, stairHolePolygon } from '../www/js/geometry/stair-builder.js';
import { isSimplePolygon } from '../www/js/geometry/polygon.js';

test('métricas con defaults: n=17, riser≈0.170588, run=4.00', () => {
  const project = { settings: { wallHeight: 2.7, slabThickness: 0.2 } };
  const stair = { targetRiser: 0.18, tread: 0.25 };
  const m = computeStairMetrics(project, stair);
  // 2.7 + 0.2 en IEEE 754 es 2.9000000000000004, no exactamente 2.9.
  assert.ok(Math.abs(m.rise - 2.9) < 1e-12, `rise=${m.rise}`);
  assert.equal(m.n, 17);
  assert.ok(Math.abs(m.riser - 2.9 / 17) < 1e-12);
  assert.ok(Math.abs(m.run - 4) < 1e-12, `run=${m.run}`);
});

test('polígono de hueco simple', () => {
  const project = { settings: { wallHeight: 2.7, slabThickness: 0.2 } };
  const stair = {
    kind: 'straight', x: 10, y: 10, angleDeg: 0, width: 0.9,
    tread: 0.25, targetRiser: 0.18, landing: 0.9,
  };
  const m = computeStairMetrics(project, stair);
  const hole = stairHolePolygon(stair, m);
  assert.equal(hole.length, 4);
  assert.equal(isSimplePolygon(hole), true);
});
