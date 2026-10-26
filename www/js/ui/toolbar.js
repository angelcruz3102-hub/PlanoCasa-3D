// === www/js/ui/toolbar.js ===
/** Herramientas por fase. La barra se adapta al ancho con CSS. */
import { STRINGS } from './strings.es.js';

const TOOLS_BY_PHASE = {
  SITE: ['lot', 'street', 'gallery'],
  PERIMETER: ['perimeter'],
  LEVEL_1: ['select', 'wall', 'door', 'window', 'label', 'stair'],
  LEVEL_2: ['select', 'wall', 'door', 'window', 'label', 'stair'],
  VIEW_3D: ['select'],
};

const GLYPHS = {
  lot: '▱', street: '═', gallery: '⌂', perimeter: '▭', wall: '│',
  door: '🚪', window: '▦', label: '🏷', stair: '🪜', select: '☝',
};

export class Toolbar {
  constructor(root, store, { onToolChange }) {
    this.root = root;
    this.store = store;
    this.onToolChange = onToolChange;
    this.render();
    store.subscribe((p, u) => u.phase, () => this.render());
    store.subscribe((p, u) => u.tool, () => this.render());
  }

  render() {
    const phase = this.store.ui.phase;
    const tools = TOOLS_BY_PHASE[phase] ?? [];
    this.root.innerHTML = '';
    for (const tool of tools) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-button';
      btn.setAttribute('aria-pressed', String(this.store.ui.tool === tool));
      btn.innerHTML = `<span class="glyph">${GLYPHS[tool] ?? '•'}</span><span>${STRINGS.tools[tool]}</span>`;
      btn.addEventListener('click', () => {
        this.store.setUi({ tool });
        if (tool === 'door' || tool === 'window') {
          this.store.setUi({ openingType: tool });
        }
        this.onToolChange?.(tool);
      });
      this.root.appendChild(btn);
    }
  }
}
