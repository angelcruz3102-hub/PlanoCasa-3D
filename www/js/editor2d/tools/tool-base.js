// === www/js/editor2d/tools/tool-base.js ===
/**
 * Clase base de herramientas. Contrato de entrada:
 *   onPointerDown(world, screen, event)
 *   onPointerMove(world, screen, event)
 *   onPointerUp(world, screen, event)
 *   onDoubleTap(world, screen)
 *   onLongPress(world, screen)
 *   onCancel()
 *   renderOverlay(ctx, view)
 *
 * Las herramientas nunca mutan el proyecto directamente. `replaceLevel` y
 * `replaceProject` producen un comando atómico que aplica una copia mutada y
 * revierte restaurando la copia previa; esto preserva la identidad de las
 * referencias y funciona con undo/redo sin lógica adicional.
 */
import { roundCoord } from '../../core/schema.js';

export class ToolBase {
  constructor(store, view, snap) {
    this.store = store;
    this.view = view;
    this.snap = snap;
    this.active = false;
  }

  activate() { this.active = true; }
  deactivate() { this.active = false; }

  onPointerDown() {}
  onPointerMove() {}
  onPointerUp() {}
  onCancel() {}
  renderOverlay() {}

  getLevel() { return this.store.getActiveLevel(); }

  getLevelById(id) {
    return this.store.project.levels.find((l) => l.id === id);
  }

  getProject() { return this.store.project; }

  setHud(text) {
    this.store.ui.hudText = text;
    this.view.invalidate();
  }

  replaceLevel(levelId, mutator, label = 'level-edit') {
    const level = this.getLevelById(levelId);
    if (!level) return;
    const before = structuredClone(level);
    const after = structuredClone(level);
    mutator(after);
    after.rev = (after.rev ?? 0) + 1;
    this.store.apply({
      label,
      apply: (p) => {
        const lvl = p.levels.find((l) => l.id === levelId);
        if (!lvl) return;
        for (const k of Object.keys(lvl)) delete lvl[k];
        Object.assign(lvl, structuredClone(after));
      },
      revert: (p) => {
        const lvl = p.levels.find((l) => l.id === levelId);
        if (!lvl) return;
        for (const k of Object.keys(lvl)) delete lvl[k];
        Object.assign(lvl, structuredClone(before));
      },
    });
  }

  replaceProject(mutator, label = 'project-edit') {
    const before = structuredClone(this.store.project);
    const after = structuredClone(this.store.project);
    mutator(after);
    this.store.apply({
      label,
      apply: (p) => {
        for (const k of Object.keys(p)) delete p[k];
        Object.assign(p, structuredClone(after));
      },
      revert: (p) => {
        for (const k of Object.keys(p)) delete p[k];
        Object.assign(p, structuredClone(before));
      },
    });
  }

  snapCoord(p) {
    return { x: roundCoord(p.x), y: roundCoord(p.y) };
  }
}
