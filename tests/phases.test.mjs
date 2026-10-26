import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evaluateGuards, canAdvance } from '../www/js/core/phases.js';
import { createProject } from '../www/js/core/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, 'fixtures', 'sample-house.json');

test('proyecto vacío bloquea todas las fases', () => {
  const p = createProject();
  const g = evaluateGuards(p);
  assert.equal(g.SITE.ok, false);
  assert.equal(g.PERIMETER.ok, false);
  assert.equal(g.LEVEL_1.ok, false);
  assert.equal(g.LEVEL_2.ok, false);
  assert.equal(g.VIEW_3D.ok, false);
  assert.equal(canAdvance(p, 'SITE', 'PERIMETER'), false);
});

test('casa de ejemplo permite SITE→PERIMETER→LEVEL_1→LEVEL_2→VIEW_3D', async () => {
  const raw = JSON.parse(await readFile(fixturePath, 'utf8'));
  const p = structuredClone(raw);
  const g = evaluateGuards(p);
  assert.equal(g.SITE.ok, true, JSON.stringify(g.SITE.errors));
  assert.equal(g.PERIMETER.ok, true, JSON.stringify(g.PERIMETER.errors));
  assert.equal(g.LEVEL_1.ok, true, JSON.stringify(g.LEVEL_1.errors));
  assert.equal(g.LEVEL_2.ok, true, JSON.stringify(g.LEVEL_2.errors));
  assert.equal(g.VIEW_3D.ok, true, JSON.stringify(g.VIEW_3D.errors));
  assert.equal(canAdvance(p, 'SITE', 'PERIMETER'), true);
  assert.equal(canAdvance(p, 'PERIMETER', 'LEVEL_1'), true);
  assert.equal(canAdvance(p, 'LEVEL_1', 'LEVEL_2'), true);
  assert.equal(canAdvance(p, 'LEVEL_2', 'VIEW_3D'), true);
});
