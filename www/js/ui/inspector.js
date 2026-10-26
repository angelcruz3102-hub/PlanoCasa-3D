// === www/js/ui/inspector.js ===
/**
 * Bottom-sheet de propiedades. En fase 3D muestra vistas rápidas y modos;
 * con selección edita nodo/abertura/etiqueta; sin selección muestra ajustes
 * y acciones de import/export.
 */
import { STRINGS } from './strings.es.js';
import { replaceLevel } from '../core/commands.js';
import { confirmDialog } from './dialogs.js';
import { applyViewMode, VIEW_MODES } from '../viewer3d/view-modes.js';

export class Inspector {
  constructor(root, store, callbacks = {}) {
    this.root = root;
    this.store = store;
    this.callbacks = callbacks;
    this.render();
    this.store.subscribe(
      (p, u) => JSON.stringify(u.selection) + ':' + u.phase,
      () => this.render(),
    );
    this.store.subscribe(
      (p, u) => {
        const lvl = p.levels.find((l) => l.id === u.activeLevelId);
        return lvl ? lvl.rev : -1;
      },
      () => this.render(),
    );
  }

  render() {
    const { ui } = this.store;
    this.root.innerHTML = '';
    this.root.hidden = false;
    if (ui.phase === 'VIEW_3D') {
      this.render3D();
      return;
    }
    if (ui.selection) {
      this.renderSelection(ui.selection);
      return;
    }
    this.renderSettings();
  }

  render3D() {
    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.style.marginBottom = '8px';
    title.textContent = 'Vistas rápidas';
    this.root.appendChild(title);

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.gap = '8px';
    for (const view of ['iso', 'front', 'plan', 'walk']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'button-secondary';
      b.textContent = STRINGS.views[view];
      b.addEventListener('click', () => this.callbacks.onQuickView?.(view));
      row.appendChild(b);
    }
    this.root.appendChild(row);

    const modesTitle = document.createElement('div');
    modesTitle.style.fontWeight = '600';
    modesTitle.style.margin = '14px 0 8px';
    modesTitle.textContent = 'Modos de vista';
    this.root.appendChild(modesTitle);

    const modes = document.createElement('div');
    modes.style.display = 'flex';
    modes.style.flexWrap = 'wrap';
    modes.style.gap = '8px';
    for (const mode of VIEW_MODES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'button-secondary';
      b.textContent = STRINGS.modes[mode];
      b.addEventListener('click', () => {
        this.store.setUi({ view3d: { ...this.store.ui.view3d, mode } });
        this.callbacks.onViewModel?.(mode);
        applyViewMode(mode, this.callbacks.getModel?.());
      });
      modes.appendChild(b);
    }
    this.root.appendChild(modes);
  }

  renderSelection(sel) {
    const level = this.store.project.levels.find((l) => l.id === sel.levelId);
    if (!level) return;
    if (sel.kind === 'node') this.renderNode(level, sel);
    else if (sel.kind === 'opening') this.renderOpening(level, sel);
    else if (sel.kind === 'label') this.renderLabel(level, sel);
  }

  renderNode(level, sel) {
    const node = level.nodes[sel.id];
    if (!node) return;
    this.addTitle('Nodo');
    this.addNumberRow('X (m)', node.x, (v) => {
      replaceLevel(this.store, level.id, (lvl) => { lvl.nodes[sel.id].x = v; }, 'node-x');
    });
    this.addNumberRow('Y (m)', node.y, (v) => {
      replaceLevel(this.store, level.id, (lvl) => { lvl.nodes[sel.id].y = v; }, 'node-y');
    });
  }

  renderOpening(level, sel) {
    const op = level.openings[sel.id];
    if (!op) return;
    this.addTitle(op.type === 'door' ? 'Puerta' : 'Ventana');
    this.addNumberRow(STRINGS.inspector.openingS, op.s, (v) => {
      replaceLevel(this.store, level.id, (lvl) => { lvl.openings[sel.id].s = v; }, 'opening-s');
    });
    this.addNumberRow(STRINGS.inspector.openingWidth, op.width, (v) => {
      replaceLevel(this.store, level.id, (lvl) => { lvl.openings[sel.id].width = v; }, 'opening-w');
    });
    this.addNumberRow(STRINGS.inspector.openingHeight, op.height, (v) => {
      replaceLevel(this.store, level.id, (lvl) => { lvl.openings[sel.id].height = v; }, 'opening-h');
    });
    if (op.type === 'window') {
      this.addNumberRow(STRINGS.inspector.openingSill, op.sill, (v) => {
        replaceLevel(this.store, level.id, (lvl) => { lvl.openings[sel.id].sill = v; }, 'opening-sill');
      });
    }
    this.addDeleteButton(async () => {
      if (await confirmDialog('Eliminar abertura', '¿Eliminar esta abertura?')) {
        replaceLevel(this.store, level.id, (lvl) => { delete lvl.openings[sel.id]; }, 'opening-del');
        this.store.ui.selection = null;
      }
    });
  }

  renderLabel(level, sel) {
    const label = level.labels.find((l) => l.id === sel.id);
    if (!label) return;
    this.addTitle('Etiqueta');
    this.addTextRow(STRINGS.inspector.labelName, label.name, (v) => {
      replaceLevel(this.store, level.id, (lvl) => {
        const l = lvl.labels.find((x) => x.id === sel.id);
        if (l) l.name = v;
      }, 'label-name');
    });
    this.addDeleteButton(async () => {
      if (await confirmDialog('Eliminar etiqueta', '¿Eliminar esta etiqueta?')) {
        replaceLevel(this.store, level.id, (lvl) => {
          lvl.labels = lvl.labels.filter((x) => x.id !== sel.id);
        }, 'label-del');
        this.store.ui.selection = null;
      }
    });
  }

  renderSettings() {
    const s = this.store.project.settings;
    this.addTitle(STRINGS.inspector.settings);
    this.addNumberRow(STRINGS.inspector.wallHeight, s.wallHeight, (v) => {
      this.store.apply({
        label: 'settings-wallHeight',
        apply: (p) => { p.settings.wallHeight = v; },
        revert: (p) => { p.settings.wallHeight = s.wallHeight; },
      });
    });
    this.addNumberRow(STRINGS.inspector.slabThickness, s.slabThickness, (v) => {
      this.store.apply({
        label: 'settings-slab',
        apply: (p) => { p.settings.slabThickness = v; },
        revert: (p) => { p.settings.slabThickness = s.slabThickness; },
      });
    });
    this.addNumberRow(STRINGS.inspector.exteriorThickness, s.wallThickness.exterior, (v) => {
      this.store.apply({
        label: 'settings-ext',
        apply: (p) => { p.settings.wallThickness.exterior = v; },
        revert: (p) => { p.settings.wallThickness.exterior = s.wallThickness.exterior; },
      });
    });
    this.addNumberRow(STRINGS.inspector.interiorThickness, s.wallThickness.interior, (v) => {
      this.store.apply({
        label: 'settings-int',
        apply: (p) => { p.settings.wallThickness.interior = v; },
        revert: (p) => { p.settings.wallThickness.interior = s.wallThickness.interior; },
      });
    });

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.flexWrap = 'wrap';
    actions.style.gap = '8px';
    actions.style.marginTop = '14px';
    const buttons = [
      [STRINGS.actions.loadSample, () => this.callbacks.onLoadSample?.()],
      [STRINGS.actions.exportJson, () => this.callbacks.onExport?.()],
      [STRINGS.actions.importJson, () => this.callbacks.onImport?.()],
    ];
    for (const [label, fn] of buttons) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'button-secondary';
      b.textContent = label;
      b.addEventListener('click', fn);
      actions.appendChild(b);
    }
    this.root.appendChild(actions);
  }

  addTitle(text) {
    const t = document.createElement('div');
    t.style.fontWeight = '600';
    t.style.marginBottom = '8px';
    t.textContent = text;
    this.root.appendChild(t);
  }

  addNumberRow(label, value, onChange) {
    const row = document.createElement('div');
    row.className = 'inspector-row';
    const l = document.createElement('label');
    l.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.inputMode = 'decimal';
    input.value = String(value);
    input.addEventListener('change', () => {
      const v = Number(input.value);
      if (Number.isFinite(v)) onChange(v);
    });
    row.appendChild(l);
    row.appendChild(input);
    this.root.appendChild(row);
  }

  addTextRow(label, value, onChange) {
    const row = document.createElement('div');
    row.className = 'inspector-row';
    const l = document.createElement('label');
    l.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.addEventListener('change', () => onChange(input.value));
    row.appendChild(l);
    row.appendChild(input);
    this.root.appendChild(row);
  }

  addDeleteButton(onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'button-danger';
    b.style.marginTop = '14px';
    b.textContent = STRINGS.actions.delete;
    b.addEventListener('click', onClick);
    this.root.appendChild(b);
  }
}
