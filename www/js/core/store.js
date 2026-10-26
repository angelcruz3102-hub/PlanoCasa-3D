// === www/js/core/store.js ===
import { History } from './history.js';
import { createProject } from './schema.js';
import { PHASES } from './constants.js';

export class Store {
  project;
  ui;
  history = new History();
  #subs = new Set();
  #scheduled = false;

  constructor(project = createProject()) {
    this.project = project;
    this.ui = {
      phase: 'SITE',
      activeLevelId: project.levels[0]?.id ?? 'L1',
      tool: 'select',
      zoom2d: 50,
      pan2d: { x: 0, y: 0 },
      selection: null,
      snaps: { node: true, midpoint: true, edge: true, ortho: true, angle15: true, grid: true },
      view3d: { mode: 'all', quality: 'medium' },
      lastPhase: 'SITE',
    };
  }

  subscribe(selector, callback) {
    const entry = { selector, callback };
    this.#subs.add(entry);
    return () => this.#subs.delete(entry);
  }

  #notify() {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      for (const { selector, callback } of this.#subs) {
        try {
          callback(selector(this.project, this.ui));
        } catch (err) {
          console.error('Error en suscriptor del store:', err);
        }
      }
    });
  }

  apply(command) {
    this.history.execute(command, this.project);
    this.#touch();
    this.#notify();
  }

  beginTransaction(label) { this.history.beginTransaction(label); }

  executeInTransaction(command) {
    this.history.execute(command, this.project, { transaction: true });
    this.#touch();
    this.#notify();
  }

  commitTransaction() {
    this.history.commit();
    this.#touch();
    this.#notify();
  }

  rollbackTransaction() {
    this.history.rollback(this.project);
    this.#notify();
  }

  undo() {
    const ok = this.history.undo(this.project);
    if (ok) this.#touch();
    this.#notify();
    return ok;
  }

  redo() {
    const ok = this.history.redo(this.project);
    if (ok) this.#touch();
    this.#notify();
    return ok;
  }

  #touch() { this.project.updatedAt = new Date().toISOString(); }

  setUi(patch) { Object.assign(this.ui, patch); this.#notify(); }

  setPhase(phase) {
    if (!PHASES.includes(phase)) throw new Error(`Fase desconocida: ${phase}`);
    this.ui.phase = phase;
    this.ui.lastPhase = phase;
    this.#notify();
  }

  setActiveLevel(levelId) {
    if (!this.project.levels.some((l) => l.id === levelId)) {
      throw new Error(`Nivel inexistente: ${levelId}`);
    }
    this.ui.activeLevelId = levelId;
    this.#notify();
  }

  getActiveLevel() {
    return this.project.levels.find((l) => l.id === this.ui.activeLevelId) ?? this.project.levels[0];
  }

  bumpLevelRev(levelId) {
    const level = this.project.levels.find((l) => l.id === levelId);
    if (level) level.rev += 1;
  }

  replaceProject(project) {
    this.project = project;
    this.history.clear();
    this.ui.activeLevelId = project.levels[0]?.id ?? 'L1';
    this.#notify();
  }
}
