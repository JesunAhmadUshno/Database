// Build step: read the notebook once, write its parsed results to src/generated/notebook.json
// and decode its 9 saved PNG outputs into public/figures/. Both folders are gitignored.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNotebook, FIGURE_TITLES } from '../src/parse.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..');
const nb = JSON.parse(fs.readFileSync(path.join(site, '..', 'decision_boundaries_analysis_feature_pairs.ipynb'), 'utf8'));

const pngs = nb.cells.flatMap((c) => c.outputs || []).map((o) => o.data?.['image/png']).filter(Boolean);
if (pngs.length !== FIGURE_TITLES.length) throw new Error(`expected ${FIGURE_TITLES.length} figures, found ${pngs.length}`);
const figDir = path.join(site, 'public', 'figures');
fs.mkdirSync(figDir, { recursive: true });
const figures = pngs.map((b64, i) => {
  const file = `figure-${i + 1}.png`;
  const buf = Buffer.from([].concat(b64).join(''), 'base64');
  fs.writeFileSync(path.join(figDir, file), buf);
  return { file, title: FIGURE_TITLES[i], bytes: buf.length, w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
});

const out = { ...parseNotebook(nb), figures };
fs.mkdirSync(path.join(site, 'src', 'generated'), { recursive: true });
fs.writeFileSync(path.join(site, 'src', 'generated', 'notebook.json'), JSON.stringify(out, null, 1));
console.log(`extract ok: ${Object.keys(out.reports).length} reports, ${out.comparison.length} comparison rows, ${figures.length} figures`);
