import { test } from 'node:test';
import assert from 'node:assert/strict';
import { area2, area, ensureCounterClockwise, pointInPolygon, polygonSelfIntersects, isSimplePolygon } from '../www/js/geometry/polygon.js';

const square = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 },
];

test('área con signo y área absoluta', () => {
  assert.equal(area2(square), 160);
  assert.equal(area(square), 80);
});

test('normalización antihoraria', () => {
  const cw = [...square].reverse();
  const ccw = ensureCounterClockwise(cw);
  assert.ok(area2(ccw) > 0);
  assert.equal(area(ccw), 80);
});

test('punto dentro y fuera', () => {
  assert.equal(pointInPolygon({ x: 5, y: 4 }, square), true);
  assert.equal(pointInPolygon({ x: 12, y: 4 }, square), false);
});

test('autointersección detectada', () => {
  const bowtie = [
    { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 },
  ];
  assert.equal(polygonSelfIntersects(bowtie), true);
  assert.equal(isSimplePolygon(bowtie), false);
});
