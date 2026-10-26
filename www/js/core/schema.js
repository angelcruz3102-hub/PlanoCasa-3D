// === www/js/core/schema.js ===
import { DEFAULT_SETTINGS, COORD_FACTOR, MAX_LEVELS } from './constants.js';

export const SCHEMA_VERSION = 1;

/** Redondeo estable de coordenadas para evitar ruido numérico en el JSON. */
export function roundCoord(value) {
  return Math.round(value * COORD_FACTOR) / COORD_FACTOR;
}

let fallbackCounter = 0;

/**
 * ID único. Usa `crypto.randomUUID` cuando existe y cae a un contador +
 * timestamp si no, porque algunos WebView antiguos no lo exponen.
 */
export function createId(prefix = 'id') {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  fallbackCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${fallbackCounter.toString(36)}`;
}

export function createLevel({ id, index, name, inheritFrom = null }) {
  if (index >= MAX_LEVELS) {
    throw new Error(`No se pueden crear más de ${MAX_LEVELS} niveles en v1`);
  }
  return {
    id,
    index,
    name: name ?? (index === 0 ? 'Planta baja' : 'Segunda planta'),
    rev: 0,
    nodes: {},
    walls: {},
    openings: {},
    labels: [],
    perimeterLoop: inheritFrom ? [...inheritFrom.perimeterLoop] : [],
  };
}

export function createProject({ name = 'Casa sin título' } = {}) {
  const now = new Date().toISOString();
  const level1 = createLevel({ id: 'L1', index: 0, name: 'Planta baja' });
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('prj'),
    name,
    createdAt: now,
    updatedAt: now,
    settings: structuredClone(DEFAULT_SETTINGS),
    site: {
      lot: null,
      lotEdgeStyle: 'line',
      street: null,
      gallery: null,
      northAngleDeg: 0,
    },
    levels: [level1],
    stairs: [],
  };
}

/**
 * Migra un objeto cargado desde JSON al esquema actual. Devuelve una copia
 * nueva; nunca muta la entrada. Si la versión es desconocida o mayor, lanza
 * para que la capa de persistencia muestre un error claro.
 */
export function migrateProject(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('El archivo no contiene un proyecto válido');
  }
  const version = Number(input.schemaVersion);
  if (!Number.isFinite(version)) {
    throw new Error('Falta schemaVersion en el proyecto');
  }
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `El proyecto usa schemaVersion ${version}, más nueva que la soportada (${SCHEMA_VERSION})`,
    );
  }

  const project = structuredClone(input);
  if (version < 1) {
    project.settings = { ...structuredClone(DEFAULT_SETTINGS), ...(project.settings ?? {}) };
    project.site = {
      lot: null,
      lotEdgeStyle: 'line',
      street: null,
      gallery: null,
      northAngleDeg: 0,
      ...(project.site ?? {}),
    };
  }

  project.schemaVersion = SCHEMA_VERSION;
  if (!Array.isArray(project.levels) || project.levels.length === 0) {
    throw new Error('El proyecto no contiene niveles');
  }
  project.stairs ??= [];
  project.levels = project.levels.map((level, index) => ({
    rev: 0,
    nodes: {},
    walls: {},
    openings: {},
    labels: [],
    perimeterLoop: [],
    ...level,
    index,
    id: level.id ?? (index === 0 ? 'L1' : `L${index + 1}`),
  }));
  return project;
}
