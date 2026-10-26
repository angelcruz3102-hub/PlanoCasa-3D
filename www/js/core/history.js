// === www/js/core/history.js ===
import { MAX_UNDO_STACK } from './constants.js';

export class History {
  #undo = [];
  #redo = [];
  #txn = null;
  #listeners = new Set();

  get canUndo() { return this.#undo.length > 0; }
  get canRedo() { return this.#redo.length > 0; }

  subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #emit() {
    for (const fn of this.#listeners) fn();
  }

  beginTransaction(label = 'txn') {
    if (this.#txn) throw new Error('Ya hay una transacción abierta');
    this.#txn = { label, entries: [] };
  }

  execute({ apply, revert }, project, { transaction = false } = {}) {
    const snapshot = transaction ? null : structuredClone(project);
    apply(project);
    if (transaction) {
      if (!this.#txn) throw new Error('execute con transaction=true sin beginTransaction');
      this.#txn.entries.push({ apply, revert });
    } else {
      this.#pushUndo({ apply, revert, snapshotBefore: snapshot });
    }
    this.#emit();
  }

  commit() {
    if (!this.#txn) return;
    const txn = this.#txn;
    this.#txn = null;
    if (txn.entries.length === 0) return;
    this.#pushUndo({
      apply: (p) => { for (const e of txn.entries) e.apply(p); },
      revert: (p) => {
        for (let i = txn.entries.length - 1; i >= 0; i -= 1) txn.entries[i].revert(p);
      },
      label: txn.label,
    });
    this.#emit();
  }

  rollback(project) {
    if (!this.#txn) return;
    const txn = this.#txn;
    this.#txn = null;
    for (let i = txn.entries.length - 1; i >= 0; i -= 1) {
      txn.entries[i].revert(project);
    }
    this.#emit();
  }

  #pushUndo(entry) {
    this.#undo.push(entry);
    if (this.#undo.length > MAX_UNDO_STACK) this.#undo.shift();
    this.#redo.length = 0;
  }

  undo(project) {
    if (this.#txn) throw new Error('No se puede undo con una transacción abierta');
    const entry = this.#undo.pop();
    if (!entry) return false;
    entry.revert(project);
    this.#redo.push(entry);
    this.#emit();
    return true;
  }

  redo(project) {
    if (this.#txn) throw new Error('No se puede redo con una transacción abierta');
    const entry = this.#redo.pop();
    if (!entry) return false;
    entry.apply(project);
    this.#undo.push(entry);
    this.#emit();
    return true;
  }

  clear() {
    this.#undo.length = 0;
    this.#redo.length = 0;
    this.#txn = null;
    this.#emit();
  }
}
