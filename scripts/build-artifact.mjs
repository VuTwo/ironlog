/* build-artifact.mjs — produce a body-fragment version of the bundle for hosts
   that wrap content in their own document skeleton (e.g. claude.ai artifacts).
   Usage: node scripts/build-artifact.mjs <out-path> */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execSync('node ' + JSON.stringify(join(root, 'scripts', 'build-single.mjs')), { stdio: 'inherit' });
const full = readFileSync(join(root, 'dist', 'index.html'), 'utf8');

const grab = (re) => { const m = full.match(re); return m ? m[0] : ''; };
const style = grab(/<style>[\s\S]*?<\/style>/);
const script = grab(/<script>window\.__SINGLE_FILE__[\s\S]*<\/script>/);

const out = `<title>IronLog</title>
${style}
<div id="app"></div>
${script}`;

const target = process.argv[2] || join(root, 'dist', 'artifact.html');
writeFileSync(target, out);
console.log(`Wrote ${target} (${(out.length / 1024).toFixed(0)} KB)`);
