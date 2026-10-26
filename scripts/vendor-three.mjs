// === scripts/vendor-three.mjs ===
import { mkdir, cp, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'node_modules', 'three');
const DEST = join(ROOT, 'www', 'vendor', 'three');

const WHITELIST = [
  { from: 'build/three.module.js', to: 'three.module.js' },
  { from: 'build/three.core.js', to: 'three.core.js' },
  { from: 'examples/jsm/controls/OrbitControls.js', to: 'addons/controls/OrbitControls.js' },
  { from: 'examples/jsm/exporters/GLTFExporter.js', to: 'addons/exporters/GLTFExporter.js' },
  { from: 'examples/jsm/utils/BufferGeometryUtils.js', to: 'addons/utils/BufferGeometryUtils.js' },
];

async function exists(path) {
  try { await access(path, constants.R_OK); return true; } catch { return false; }
}

async function main() {
  if (!(await exists(SRC))) {
    console.error(`No existe ${SRC}. Ejecuta primero: npm install`);
    process.exit(1);
  }
  const missing = [];
  for (const entry of WHITELIST) {
    if (!(await exists(join(SRC, entry.from)))) missing.push(entry.from);
  }
  if (missing.length > 0) {
    console.error('Faltan archivos en node_modules/three:');
    for (const m of missing) console.error(`  - ${m}`);
    console.error('Contenido actual de build/:');
    try {
      const { readdir } = await import('node:fs/promises');
      for (const f of await readdir(join(SRC, 'build'))) console.error(`  - build/${f}`);
    } catch { console.error('  (no se pudo leer node_modules/three/build)'); }
    process.exit(1);
  }
  for (const entry of WHITELIST) {
    const dest = join(DEST, entry.to);
    await mkdir(dirname(dest), { recursive: true });
    await cp(join(SRC, entry.from), dest, { force: true });
  }
  console.log(`three.js vendorizado en ${DEST} (${WHITELIST.length} archivos).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
