// === www/js/core/constants.js ===
/**
 * Constantes globales del dominio. Los valores de construcción son DEFAULTS
 * CONFIGURABLES, no normas: deben validarse con el reglamento local aplicable.
 */
export const EPS = 1e-6;
export const COORD_DECIMALS = 3;
export const COORD_FACTOR = 10 ** COORD_DECIMALS;

export const DEFAULT_SETTINGS = Object.freeze({
  gridStep: 0.10,
  wallHeight: 2.70,
  slabThickness: 0.20,
  wallThickness: { exterior: 0.20, interior: 0.12 },
  defaults: {
    door: { w: 0.90, h: 2.10 },
    window: { w: 1.20, h: 1.20, sill: 0.90 },
  },
});

export const MIN_WALL_LENGTH = 0.05;
export const MIN_OPENING_EDGE_OFFSET = 0.15;
export const MIN_STAIR_HOLE_CLEARANCE = 0.05;
export const MAX_LEVELS = 2;
export const MAX_UNDO_STACK = 200;
export const AUTOSAVE_DEBOUNCE_MS = 800;

export const PHASES = Object.freeze([
  'SITE',
  'PERIMETER',
  'LEVEL_1',
  'LEVEL_2',
  'VIEW_3D',
]);

export const PHASE_LABELS_ES = Object.freeze({
  SITE: 'Entorno',
  PERIMETER: 'Perímetro',
  LEVEL_1: 'Planta baja',
  LEVEL_2: 'Segunda planta',
  VIEW_3D: 'Vista 3D',
});

export const LEVEL_NAMES_ES = Object.freeze({
  L1: 'Planta baja',
  L2: 'Segunda planta',
});

export const SITE_ELEVATIONS = Object.freeze({
  terrain: -0.02,
  street: -0.01,
  sidewalk: 0.10,
  gallerySlabTop: 0.00,
  gallerySlabThickness: 0.15,
  lotWallLow: 1.00,
  lotFenceHigh: 1.80,
  lotWallThickness: 0.10,
  basePlaneSize: 200,
});
