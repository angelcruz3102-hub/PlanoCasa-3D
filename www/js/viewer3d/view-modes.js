// === www/js/viewer3d/view-modes.js ===
/** Conmuta la visibilidad de subgrupos del modelo. `cut` oculta techo y L2. */
export const VIEW_MODES = ['all', 'level1', 'level2', 'roof', 'site', 'cut'];

export function applyViewMode(mode, model) {
  if (!model) return;
  const set = (name, visible) => {
    const g = model.getObjectByName(name);
    if (g) g.visible = visible;
  };
  switch (mode) {
    case 'level1':
      set('level-L1', true); set('level-L2', false); set('roof', false);
      set('site', true); set('stairs', true);
      break;
    case 'level2':
      set('level-L1', false); set('level-L2', true); set('roof', false);
      set('site', true); set('stairs', true);
      break;
    case 'roof':
      set('level-L1', true); set('level-L2', true); set('roof', true);
      set('site', true); set('stairs', true);
      break;
    case 'site':
      set('level-L1', true); set('level-L2', true); set('roof', true);
      set('site', true); set('stairs', true);
      break;
    case 'cut':
      set('level-L1', true); set('level-L2', false); set('roof', false);
      set('site', false); set('stairs', false);
      break;
    default:
      set('level-L1', true); set('level-L2', true); set('roof', true);
      set('site', true); set('stairs', true);
  }
}
