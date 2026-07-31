import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mosaic = join(root, 'mosaic');
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) walk(full); else files.push(full);
  }
}
walk(mosaic);

let failed = false;
for (const file of files.filter((path) => path.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    console.error(`Syntax error: ${file}\n${result.stderr}`);
  }
  const source = readFileSync(file, 'utf8');
  const imports = [...source.matchAll(/(?:from\s+|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g)].map((match) => match[2]);
  for (const specifier of imports) {
    const target = resolve(dirname(file), specifier);
    if (!existsSync(target)) {
      failed = true;
      console.error(`Missing import target: ${file} -> ${specifier}`);
    }
  }
}

const html = readFileSync(join(mosaic, 'index.html'), 'utf8');
const app = readFileSync(join(mosaic, 'app.js'), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const referencedIds = new Set([...app.matchAll(/\$\(['"]#([A-Za-z0-9_-]+)['"]\)/g)].map((match) => match[1]));
for (const id of referencedIds) {
  if (!ids.has(id)) {
    failed = true;
    console.error(`app.js references missing element #${id}`);
  }
}

const sw = readFileSync(join(mosaic, 'sw.js'), 'utf8');
const cacheEntries = [...sw.matchAll(/'\.\/([^']*)'/g)].map((match) => match[1]).filter(Boolean);
for (const entry of cacheEntries) {
  const target = join(mosaic, entry.split('?')[0]);
  if (!existsSync(target)) {
    failed = true;
    console.error(`Service worker cache entry does not exist: ${entry}`);
  }
}

const open = (html.match(/{/g) || []).length;
const close = (html.match(/}/g) || []).length;
if (open !== close) console.warn(`HTML contains ${open} opening and ${close} closing braces; this is informational only.`);

console.log(`Checked ${files.length} app files, ${referencedIds.size} DOM references, and ${cacheEntries.length} cache paths.`);
if (failed) process.exitCode = 1;
