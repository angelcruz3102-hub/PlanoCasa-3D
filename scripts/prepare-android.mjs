// === scripts/prepare-android.mjs ===
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GRADLE = join(ROOT, 'android', 'app', 'build.gradle');
const PKG = join(ROOT, 'package.json');

async function main() {
  if (!existsSync(GRADLE)) {
    console.error(`No existe ${GRADLE}. Ejecuta antes: npx cap add android`);
    process.exit(1);
  }
  const pkg = JSON.parse(await readFile(PKG, 'utf8'));
  const versionName = pkg.version ?? '1.0.0';
  const versionCode = String(process.env.VERSION_CODE ?? '1');
  if (!/^\d+$/.test(versionCode)) {
    console.error(`VERSION_CODE inválido: "${versionCode}".`);
    process.exit(1);
  }
  let gradle = await readFile(GRADLE, 'utf8');
  const codePattern = /versionCode\s*(=\s*)?(\d+)/;
  const namePattern = /versionName\s*(=\s*)?"[^"]*"/;
  if (!codePattern.test(gradle)) {
    console.error('No se encontró "versionCode" en build.gradle.');
    process.exit(1);
  }
  if (!namePattern.test(gradle)) {
    console.error('No se encontró "versionName" en build.gradle.');
    process.exit(1);
  }
  gradle = gradle.replace(codePattern, (m, eq) => `versionCode${eq ? ' =' : ' '}${versionCode}`);
  gradle = gradle.replace(namePattern, `versionName "${versionName}"`);
  await writeFile(GRADLE, gradle, 'utf8');
  console.log(`build.gradle: versionCode=${versionCode}, versionName="${versionName}"`);
}

main().catch((err) => { console.error(err); process.exit(1); });
