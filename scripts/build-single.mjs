/* build-single.mjs — bundle the whole app into one self-contained dist/index.html
   (easy to host anywhere, email to yourself, or preview as an artifact). */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const html = read('index.html');
const css = read('css/app.css');

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const js = scripts.map((p) => `/* ===== ${p} ===== */\n` + read(p)).join('\n');

const iconSvg = read('icons/icon.svg');
const iconDataUri = 'data:image/svg+xml,' + encodeURIComponent(iconSvg.replace(/\s+/g, ' '));
const applePng = readFileSync(join(root, 'icons/apple-touch-icon.png')).toString('base64');

let out = html
  .replace(/<link rel="manifest"[^>]*>\s*/g, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>/, `<link rel="apple-touch-icon" href="data:image/png;base64,${applePng}">`)
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${iconDataUri}" type="image/svg+xml">`)
  .replace(/<link rel="stylesheet"[^>]*>/, `<style>\n${css}\n</style>`)
  .replace(/(\s*<script src="[^"]+"><\/script>)+/, `\n<script>window.__SINGLE_FILE__=true;\n${js}\n</script>\n`);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'index.html'), out);
console.log(`Built dist/index.html (${(out.length / 1024).toFixed(0)} KB) from ${scripts.length} scripts.`);
