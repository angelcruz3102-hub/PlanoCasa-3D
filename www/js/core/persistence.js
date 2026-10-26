// === www/js/core/persistence.js ===
/**
 * Persistencia tolerante al entorno: localStorage si existe, Map en memoria
 * en Node/tests. La capa Capacitor se inyecta opcionalmente desde main.js.
 */
const KEY = 'planocasa3d:project';
const memory = new Map();

function storage() {
  if (typeof globalThis.localStorage !== 'undefined') return globalThis.localStorage;
  return {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
  };
}

export function saveLocal(project) {
  storage().setItem(KEY, JSON.stringify(project));
}

export function loadLocal() {
  const raw = storage().getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearLocal() {
  storage().removeItem(KEY);
}

export function createAutosaver({ delayMs = 800, sink = null } = {}) {
  let timer = null;
  let pending = null;
  return {
    schedule(project) {
      pending = project;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        timer = null;
        const p = pending;
        pending = null;
        saveLocal(p);
        if (sink) {
          try { await sink(p); } catch (err) { console.error('Error al guardar en archivo:', err); }
        }
      }, delayMs);
    },
    async flush(project) {
      if (timer) { clearTimeout(timer); timer = null; }
      const p = project ?? pending;
      if (!p) return;
      saveLocal(p);
      if (sink) {
        try { await sink(p); } catch (err) { console.error('Error al guardar en archivo:', err); }
      }
    },
  };
}
