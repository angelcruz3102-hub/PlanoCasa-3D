// === www/js/viewer3d/materials.js ===
/**
 * Materiales estándar por categoría. Se comparten entre mallas del mismo
 * tipo para mantener ≤ 60 draw calls en la casa de ejemplo.
 */
import * as THREE from 'three';

const std = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.85, metalness: 0.0, ...opts,
});

export function createMaterials() {
  return {
    exteriorWall: std(0xe2e8f0),
    interiorWall: std(0xcbd5e1),
    slab: std(0x94a3b8, { roughness: 0.95 }),
    floor: {
      sala: std(0x5aa9ff, { roughness: 0.8 }),
      cocina: std(0xf59e0b, { roughness: 0.8 }),
      bano: std(0x38bdf8, { roughness: 0.7 }),
      habitacion: std(0xa855f7, { roughness: 0.8 }),
      pasillo: std(0x94a3b8, { roughness: 0.9 }),
      escalera: std(0x22c55e, { roughness: 0.8 }),
      otro: std(0x64748b, { roughness: 0.9 }),
    },
    door: std(0x8b5e3c, { roughness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x9ad7ff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      roughness: 0.1,
      metalness: 0.0,
    }),
    terrain: std(0x1f2937, { roughness: 1.0 }),
    asphalt: std(0x334155, { roughness: 1.0 }),
    sidewalk: std(0x64748b, { roughness: 0.95 }),
    grass: std(0x3f6212, { roughness: 1.0 }),
    fence: std(0x78716c, { roughness: 0.9 }),
    stair: std(0x22c55e, { roughness: 0.8 }),
  };
}

export function disposeMaterials(materials) {
  for (const m of Object.values(materials)) {
    if (m?.isMaterial) m.dispose();
    else if (m && typeof m === 'object') disposeMaterials(m);
  }
}
