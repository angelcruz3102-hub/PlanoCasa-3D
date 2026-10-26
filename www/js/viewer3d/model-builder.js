// === www/js/viewer3d/model-builder.js ===
/**
 * Construye el Group raíz con subgrupos site / level-L1 / level-L2 / stairs /
 * roof. Cada nivel es independiente para que view-modes.js pueda ocultarlo.
 * `disposeGroup` libera solo geometrías: los materiales son compartidos y se
 * liberan en `SceneManager.dispose` para no romper mallas hermanas.
 */
import * as THREE from 'three';
import { buildWalls, levelElevation } from '../geometry/wall-builder.js';
import { buildSlab } from '../geometry/slab-builder.js';
import { buildStairGeometry, computeStairMetrics } from '../geometry/stair-builder.js';
import { buildSite } from '../geometry/site-builder.js';
import { detectFaces } from '../geometry/faces.js';
import { pointInPolygon } from '../geometry/polygon.js';

export class ModelBuilder {
  constructor(materials) {
    this.materials = materials;
    this.revs = new Map();
  }

  build(project) {
    const root = new THREE.Group();
    root.name = 'model';
    root.add(this.#buildSite(project));
    for (const level of project.levels) {
      root.add(this.#buildLevel(project, level));
      this.revs.set(level.id, level.rev);
    }
    root.add(this.#buildStairs(project));
    root.add(this.#buildRoof(project));
    return root;
  }

  update(project, root) {
    for (const level of project.levels) {
      if (this.revs.get(level.id) === level.rev) continue;
      const old = root.getObjectByName(`level-${level.id}`);
      if (old) { root.remove(old); disposeGroup(old); }
      root.add(this.#buildLevel(project, level));
      this.revs.set(level.id, level.rev);
    }
    for (const name of ['stairs', 'roof']) {
      const old = root.getObjectByName(name);
      if (old) { root.remove(old); disposeGroup(old); }
    }
    root.add(this.#buildStairs(project));
    root.add(this.#buildRoof(project));
  }

  #buildSite(project) {
    const group = new THREE.Group();
    group.name = 'site';
    const builder = buildSite(project);
    if (!builder.isEmpty) {
      const mesh = new THREE.Mesh(builder.build(THREE), this.materials.terrain);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  #buildLevel(project, level) {
    const group = new THREE.Group();
    group.name = `level-${level.id}`;
    group.userData.levelId = level.id;
    const elevation = levelElevation(project, level.index);

    for (const kind of ['exterior', 'interior']) {
      const filtered = { ...level, walls: {}, openings: {} };
      for (const w of Object.values(level.walls)) {
        if (w.kind === kind) filtered.walls[w.id] = w;
      }
      for (const o of Object.values(level.openings)) {
        const w = level.walls[o.wallId];
        if (w && w.kind === kind) filtered.openings[o.id] = o;
      }
      if (Object.keys(filtered.walls).length === 0) continue;
      const { builder } = buildWalls(project, filtered, elevation);
      if (builder.isEmpty) continue;
      const mat = kind === 'exterior'
        ? this.materials.exteriorWall
        : this.materials.interiorWall;
      const mesh = new THREE.Mesh(builder.build(THREE), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    const holes = project.stairs
      .filter((s) => s.toLevelId === level.id && s.holePolygon)
      .map((s) => s.holePolygon);
    const slabBottom = elevation - project.settings.slabThickness;
    const slab = buildSlab(level, slabBottom, elevation, holes);
    if (!slab.isEmpty) {
      const mesh = new THREE.Mesh(slab.build(THREE), this.materials.slab);
      mesh.castShadow = level.index > 0;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    group.add(this.#buildFloors(level, elevation));
    return group;
  }

  #buildFloors(level, elevation) {
    const group = new THREE.Group();
    group.name = `floors-${level.id}`;
    for (const face of detectFaces(level)) {
      if (face.points.length < 3) continue;
      const label = level.labels.find((l) => pointInPolygon(l, face.points));
      const type = label?.type ?? 'otro';
      const mat = this.materials.floor[type] ?? this.materials.floor.otro;
      const shape = new THREE.Shape();
      const pts = face.points;
      shape.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) shape.lineTo(pts[i].x, pts[i].y);
      shape.closePath();
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = elevation + 0.005;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  #buildStairs(project) {
    const group = new THREE.Group();
    group.name = 'stairs';
    for (const stair of project.stairs) {
      const from = project.levels.find((l) => l.id === stair.fromLevelId);
      const base = levelElevation(project, from?.index ?? 0);
      const metrics = computeStairMetrics(project, stair);
      const builder = buildStairGeometry(stair, metrics, base);
      if (builder.isEmpty) continue;
      const mesh = new THREE.Mesh(builder.build(THREE), this.materials.stair);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  #buildRoof(project) {
    const group = new THREE.Group();
    group.name = 'roof';
    const last = project.levels[project.levels.length - 1];
    if (!last) return group;
    const top = levelElevation(project, last.index) + project.settings.wallHeight;
    const slab = buildSlab(last, top, top + project.settings.slabThickness, []);
    if (!slab.isEmpty) {
      const mesh = new THREE.Mesh(slab.build(THREE), this.materials.slab);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

export function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.isMesh) obj.geometry?.dispose();
  });
}
