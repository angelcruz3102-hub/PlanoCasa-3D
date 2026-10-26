// === www/js/core/commands.js ===
/**
 * Helpers de edición atómica compartidos por el inspector y la UI.
 * `replaceLevel`/`replaceProject` aplican una copia mutada y revierten
 * restaurando la copia previa completa: funciona con cualquier mutación,
 * incluidas las que crean o eliminan nodos, sin escribir inversos a mano.
 */
export function replaceLevel(store, levelId, mutator, label = 'edit') {
  const level = store.project.levels.find((l) => l.id === levelId);
  if (!level) return;
  const before = structuredClone(level);
  const after = structuredClone(level);
  mutator(after);
  after.rev = (after.rev ?? 0) + 1;
  store.apply({
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

export function replaceProject(store, mutator, label = 'edit') {
  const before = structuredClone(store.project);
  const after = structuredClone(store.project);
  mutator(after);
  store.apply({
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
