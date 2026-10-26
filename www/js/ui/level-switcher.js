// === www/js/ui/level-switcher.js ===
/** Chips PB/P2 y creación de la segunda planta. */
export class LevelSwitcher {
  constructor(root, store, { onCreateLevel }) {
    this.root = root;
    this.store = store;
    this.onCreateLevel = onCreateLevel;
    this.render();
    store.subscribe((p, u) => u.activeLevelId, () => this.render());
    store.subscribe((p) => p.levels.length, () => this.render());
  }

  render() {
    this.root.innerHTML = '';
    for (const level of this.store.project.levels) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-chip';
      btn.textContent = level.index === 0 ? 'PB' : 'P2';
      btn.setAttribute('aria-pressed', String(this.store.ui.activeLevelId === level.id));
      btn.addEventListener('click', () => this.store.setActiveLevel(level.id));
      this.root.appendChild(btn);
    }
    if (this.store.project.levels.length === 1) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'level-chip';
      add.textContent = '+ P2';
      add.addEventListener('click', () => this.onCreateLevel());
      this.root.appendChild(add);
    }
  }
}
