import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kitRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const targetRoot = resolve(process.argv[2] || '');
if (!process.argv[2]) {
  console.error('Usage: node scripts/integrate-into-topoboard.mjs /path/to/Topoboardgame');
  process.exit(1);
}
if (!existsSync(join(targetRoot, 'package.json')) || !existsSync(join(targetRoot, 'tools', 'build-website.mjs'))) {
  console.error(`Not a compatible Topoboardgame checkout: ${targetRoot}`);
  process.exit(1);
}

cpSync(join(kitRoot, 'mosaic'), join(targetRoot, 'mosaic'), { recursive: true, force: true });

const buildPath = join(targetRoot, 'tools', 'build-website.mjs');
let build = readFileSync(buildPath, 'utf8');
const copyLine = "copyIfExists(join(root, 'mosaic'), join(output, 'mosaic'));";
if (!build.includes(copyLine)) {
  const anchor = "copyIfExists(join(root, 'spacetime'), join(output, 'spacetime'));";
  if (!build.includes(anchor)) throw new Error(`Could not locate the spacetime copy anchor in ${buildPath}`);
  build = build.replace(anchor, `${anchor}\n${copyLine}`);
  writeFileSync(buildPath, build);
}

const indexPath = join(targetRoot, 'index.html');
let html = readFileSync(indexPath, 'utf8');
const links = {
  two: `                    <a class="game-option topomosaic-option" href="./mosaic/?dimension=2&time=0&lattice=square">
                        <span class="game-option-copy"><strong data-i18n="games.topomosaic2d.title">2D TopoMosaic</strong><small data-i18n="games.topomosaic2d.desc">Colored picture logic on square, hexagonal, and triangular cells</small></span>
                    </a>`,
  three: `                    <a class="game-option topomosaic-option" href="./mosaic/?dimension=3&time=0&lattice=sc">
                        <span class="game-option-copy"><strong data-i18n="games.topomosaic3d.title">3D TopoMosaic</strong><small data-i18n="games.topomosaic3d.desc">Model, slice, and track solving on SC, FCC, BCC, and HCP cells</small></span>
                    </a>`,
  twoTime: `                    <a class="game-option topomosaic-option" href="./mosaic/?dimension=2&time=1&lattice=square">
                        <span class="game-option-copy"><strong data-i18n="games.topomosaic2p1.title">2+1D TopoMosaic</strong><small data-i18n="games.topomosaic2p1.desc">Animation reconstructed with spatial and temporal colored clues</small></span>
                    </a>`,
  threeTime: `                    <a class="game-option topomosaic-option" href="./mosaic/?dimension=3&time=1&lattice=sc">
                        <span class="game-option-copy"><strong data-i18n="games.topomosaic3p1.title">3+1D TopoMosaic</strong><small data-i18n="games.topomosaic3p1.desc">Solve evolving inner 3D structures through time</small></span>
                    </a>`,
};

function insertBeforeMarker(marker, content, uniqueKey) {
  if (html.includes(uniqueKey)) return;
  const index = html.indexOf(marker);
  if (index < 0) throw new Error(`Could not find launcher marker: ${marker.slice(0, 80)}`);
  const close = html.lastIndexOf('                </section>', index);
  if (close < 0) throw new Error(`Could not find the section closing tag before ${marker.slice(0, 40)}`);
  html = `${html.slice(0, close)}${content}\n${html.slice(close)}`;
}

insertBeforeMarker('                <section class="dimension-card dimension-3d"', links.two, 'games.topomosaic2d.title');
insertBeforeMarker('                <section class="dimension-card dimension-4d"', links.three, 'games.topomosaic3d.title');
insertBeforeMarker('                <section class="dimension-card dimension-3p1', links.twoTime, 'games.topomosaic2p1.title');
if (!html.includes('games.topomosaic3p1.title')) {
  const marker = '            <div id="strategy-systems-labs"';
  const index = html.indexOf(marker);
  const close = html.lastIndexOf('                </section>', index);
  if (index < 0 || close < 0) throw new Error('Could not locate the end of the 3+1D launcher card.');
  html = `${html.slice(0, close)}${links.threeTime}\n${html.slice(close)}`;
}

const enEntries = `                        topomosaic2d: { title: '2D TopoMosaic', desc: 'Colored picture logic on square, hexagonal, and triangular cells' },
                        topomosaic3d: { title: '3D TopoMosaic', desc: 'Model, slice, and track solving on SC, FCC, BCC, and HCP cells' },
                        topomosaic2p1: { title: '2+1D TopoMosaic', desc: 'Animation reconstructed with spatial and temporal colored clues' },
                        topomosaic3p1: { title: '3+1D TopoMosaic', desc: 'Solve evolving inner 3D structures through time' },`;
const zhEntries = `                        topomosaic2d: { title: '2D TopoMosaic', desc: '在正方格、六角格與三角格上完成彩色圖像邏輯' },
                        topomosaic3d: { title: '3D TopoMosaic', desc: '在 SC、FCC、BCC 與 HCP 晶格中以模型、切片及路徑解題' },
                        topomosaic2p1: { title: '2+1D TopoMosaic', desc: '同時利用空間與時間彩色線索重建動畫' },
                        topomosaic3p1: { title: '3+1D TopoMosaic', desc: '沿時間解出會演化的三維內部結構' },`;

if (!html.includes("topomosaic2d: { title: '2D TopoMosaic'")) {
  const enAnchor = "                        '2dchess': { title: '2D Chess', desc: 'Chess with selectable boundaries' },";
  if (!html.includes(enAnchor)) throw new Error('Could not locate the English games translation dictionary.');
  html = html.replace(enAnchor, `${enEntries}\n${enAnchor}`);
}
if (!html.includes("topomosaic2d: { title: '2D TopoMosaic', desc: '在正方格")) {
  const zhAnchor = "                        '2dchess': { title: '2D 西洋棋', desc: '可切換邊界的西洋棋' },";
  if (!html.includes(zhAnchor)) throw new Error('Could not locate the Chinese games translation dictionary.');
  html = html.replace(zhAnchor, `${zhEntries}\n${zhAnchor}`);
}
writeFileSync(indexPath, html);

console.log('TopoMosaic copied to:', join(targetRoot, 'mosaic'));
console.log('Patched:', buildPath);
console.log('Patched:', indexPath);
console.log('Next: npm run build:web (or the build command used by your chosen Topoboard edition).');
