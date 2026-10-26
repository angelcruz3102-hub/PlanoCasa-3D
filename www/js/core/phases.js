// === www/js/core/phases.js ===
import { PHASES } from './constants.js';
import { validateSite, validatePerimeter, validateLevel, validateLevel2 } from './validation.js';
import { detectFaces } from '../geometry/faces.js';
import { pointInPolygon } from '../geometry/polygon.js';

export function evaluateGuards(project) {
  const result = {};

  const site = validateSite(project);
  result.SITE = site.SITE;

  const perimeter = validatePerimeter(project);
  result.PERIMETER = perimeter.PERIMETER;

  const l1 = project.levels[0];
  const l1Val = validateLevel(project, l1?.id);
  const l1Errors = [...l1Val.errors];
  const l1Warnings = [...l1Val.warnings];

  if (l1 && l1.perimeterLoop.length >= 3) {
    const faces = detectFaces(l1);
    const rooms = faces.filter((f) => f.area > 0.01);
    if (rooms.length < 2) {
      l1Errors.push({
        code: 'level1.rooms.tooFew', severity: 'error', phase: 'LEVEL_1',
        message: 'Se necesitan al menos 2 ambientes detectados',
        target: { levelId: l1.id, kind: 'level', id: l1.id },
      });
    }
    const unlabeled = rooms.filter(
      (r) => !l1.labels.some((lab) => pointInPolygon(lab, r.points)),
    );
    if (unlabeled.length > 0) {
      l1Errors.push({
        code: 'level1.labels.missing', severity: 'error', phase: 'LEVEL_1',
        message: `Hay ${unlabeled.length} ambiente(s) sin etiqueta`,
        target: { levelId: l1.id, kind: 'level', id: l1.id },
      });
    }
    const hasExteriorDoor = Object.values(l1.openings).some((o) => {
      if (o.type !== 'door') return false;
      const w = l1.walls[o.wallId];
      return w?.kind === 'exterior';
    });
    if (!hasExteriorDoor) {
      l1Errors.push({
        code: 'level1.exteriorDoor.missing', severity: 'error', phase: 'LEVEL_1',
        message: 'Falta al menos una puerta exterior',
        target: { levelId: l1.id, kind: 'opening', id: null },
      });
    }
  } else {
    l1Errors.push({
      code: 'level1.perimeter.missing', severity: 'error', phase: 'LEVEL_1',
      message: 'La planta baja no tiene perímetro',
      target: { levelId: l1?.id, kind: 'level', id: l1?.id },
    });
  }
  result.LEVEL_1 = { ok: l1Errors.length === 0, errors: l1Errors, warnings: l1Warnings };

  if (project.levels[1]) {
    const l2Val = validateLevel2(project);
    result.LEVEL_2 = {
      ok: l2Val.errors.length === 0,
      errors: l2Val.errors,
      warnings: l2Val.warnings,
    };
  } else {
    result.LEVEL_2 = {
      ok: false,
      errors: [{
        code: 'level2.missing', severity: 'error', phase: 'LEVEL_2',
        message: 'Aún no se ha creado la segunda planta',
        target: { levelId: null, kind: 'level', id: null },
      }],
      warnings: [],
    };
  }

  const priorOk = ['SITE', 'PERIMETER', 'LEVEL_1', 'LEVEL_2'].every((p) => result[p].ok);
  result.VIEW_3D = {
    ok: priorOk,
    errors: priorOk ? [] : [{
      code: 'view3d.blocked', severity: 'error', phase: 'VIEW_3D',
      message: 'Completa las fases anteriores sin errores para ver el 3D',
      target: { levelId: null, kind: 'phase', id: 'VIEW_3D' },
    }],
    warnings: [],
  };

  return result;
}

export function canAdvance(project, from, to) {
  if (PHASES.indexOf(to) !== PHASES.indexOf(from) + 1) return false;
  const guards = evaluateGuards(project);
  return guards[from]?.ok === true;
}

export function previousPhase(phase) {
  const i = PHASES.indexOf(phase);
  return i > 0 ? PHASES[i - 1] : PHASES[0];
}

export function phasesNeedingReview(project) {
  const guards = evaluateGuards(project);
  return PHASES.filter((p, i) => i > 0 && !guards[p].ok);
}
