// Pure parsers for the three repo files. Used by the page (via ?raw imports or the
// generated notebook JSON) and by the node checks, so both read the same numbers.

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Dates are whole UTC day numbers (days since 1970-01-01), like Oracle DATEs at midnight.
export const dayNum = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000;
export const ymd = (dn) => { const t = new Date(dn * 86400000); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; };
// Oracle's default NLS_DATE_FORMAT, DD-MON-RR.
export const fmtDate = (dn) => { const [y, m, d] = ymd(dn); return `${String(d).padStart(2, '0')}-${MON[m - 1]}-${String(y % 100).padStart(2, '0')}`; };

// Split on commas at paren depth 0 and outside single quotes.
function splitTop(s) {
  const out = []; let depth = 0, q = false, cur = '';
  for (const ch of s) {
    if (ch === "'") q = !q;
    if (!q && ch === '(') depth++;
    if (!q && ch === ')') depth--;
    if (!q && depth === 0 && ch === ',') { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function value(v) {
  if (/^null$/i.test(v)) return null;
  if (/^'.*'$/.test(v)) return v.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(v)) return +v;
  let m = v.match(/^to_date\('(\d+)-(\d+)-(\d{4})','dd-mm-yyyy'\)$/i);
  if (m) return { date: dayNum(+m[3], +m[2], +m[1]) };
  // to_date('13-JUL-87')-85: default DD-MON-RR, RR 50-99 means 19xx; minus whole days.
  m = v.match(/^to_date\('(\d+)-([A-Z]{3})-(\d{2})'\)\s*(-\s*\d+)?$/i);
  if (m) { const yy = +m[3]; return { date: dayNum(yy >= 50 ? 1900 + yy : 2000 + yy, MON.indexOf(m[2].toUpperCase()) + 1, +m[1]) + (m[4] ? +m[4].replace(/\s/g, '') : 0) }; }
  throw new Error(`unparsed SQL value: ${v}`);
}

// scott.sql opens with prose lines before the DDL, so only CREATE TABLE and INSERT statements are read.
export function parseScott(text) {
  const tables = [];
  for (const m of text.matchAll(/CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\)\s*;/gi)) {
    const cols = splitTop(m[2]).map((c) => {
      const p = c.replace(/\s+/g, ' ').trim();
      const [name, type] = p.split(' ');
      const pk = /PRIMARY KEY/i.test(p), fk = p.match(/REFERENCES (\w+)/i);
      return { name: name.toUpperCase(), type: type.toUpperCase(), pk, fk: fk ? fk[1].toUpperCase() : null };
    });
    tables.push({ name: m[1].toUpperCase(), cols });
  }
  const rows = {};
  for (const m of text.matchAll(/INSERT INTO\s+(\w+)\s+VALUES\s*\(([\s\S]*?)\)\s*;/gi)) {
    const t = m[1].toUpperCase(), cols = tables.find((x) => x.name === t).cols;
    const vals = splitTop(m[2]).map(value);
    (rows[t] ||= []).push(Object.fromEntries(cols.map((c, i) => [c.name, vals[i] && vals[i].date !== undefined ? vals[i].date : vals[i]])));
  }
  return { tables, dept: rows.DEPT || [], emp: rows.EMP || [], salgrade: rows.SALGRADE || [] };
}

// all_queries.sql: "----Lecture N----" headers, then "1.1-" or "3-" labels each followed by one statement.
export function parseQueries(text) {
  const out = [];
  const parts = text.split(/-+\s*Lecture\s+(\d+)\s*-+/);
  for (let i = 1; i < parts.length; i += 2) {
    const lecture = +parts[i];
    for (const m of parts[i + 1].matchAll(/^(\d+(?:\.\d+)?)-\s*\n([\s\S]*?;)/gm)) {
      const sql = m[2].trim();
      out.push({ id: `${lecture}.${m[1]}`, lecture, num: m[1], sql, cols: [...sql.matchAll(/AS "([^"]+)"/g)].map((x) => x[1]) });
    }
  }
  return out;
}

// Notebook: generator constants from the code cell, results from the saved text outputs.
export function parseNotebook(nb) {
  const code = nb.cells.filter((c) => c.cell_type === 'code').map((c) => [].concat(c.source).join('')).join('\n');
  const text = nb.cells.flatMap((c) => c.outputs || []).filter((o) => o.text).map((o) => [].concat(o.text).join('')).join('\n');
  const num = (re, s = code) => { const m = s.match(re); if (!m) throw new Error(`notebook: ${re}`); return m.slice(1).map(Number); };

  const features = ['age', 'income', 'credit_score', 'employment_length'].map((name) => {
    const [lo, hi] = num(new RegExp(`${name} = np\\.random\\.randint\\((\\d+), (\\d+)`));
    const [w, thr] = num(new RegExp(`([\\d.]+) \\* \\(${name} > (\\d+)\\)`));
    return { name, lo, hi, w, thr };
  });
  const [nSamples, seed] = num(/def generate_synthetic_data\(n_samples=(\d+), random_seed=(\d+)\)/);
  const [testSize, splitSeed] = num(/test_size=([\d.]+), random_state=(\d+)/);
  const [cvFolds] = num(/cv=(\d+)/);
  const [k] = num(/KNeighborsClassifier\(n_neighbors=(\d+)\)/);

  const reports = {}, cv = {};
  for (const m of text.matchAll(/Classification Report for ([^:]+):\n([\s\S]*?)weighted avg/g)) {
    const r = {};
    for (const row of m[2].matchAll(/^\s+([01])\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)$/gm))
      r[row[1]] = { precision: +row[2], recall: +row[3], f1: +row[4], support: +row[5] };
    r.accuracy = +m[2].match(/accuracy\s+([\d.]+)\s+(\d+)/)[1];
    reports[m[1]] = r;
  }
  for (const m of text.matchAll(/Cross-validation scores for ([^:]+):\nMean CV Accuracy: ([\d.]+) \(\+\/- ([\d.]+)\)/g))
    cv[m[1]] = { mean: +m[2], pm2sd: +m[3] };
  const comparison = [];
  const table = text.split('Model Comparison:')[1];
  for (const m of table.matchAll(/^\d+\s+(.+?)\s+([\d.]+)\s+([\d.]+)\s*$/gm)) comparison.push({ model: m[1], accuracy: +m[2], auc: +m[3] });

  const nTest = Math.round(nSamples * testSize);
  return { features, nSamples, seed, testSize, splitSeed, cvFolds, k, nTest, reports, cv, comparison };
}

// The order in which the notebook emits its image/png outputs, from main().
export const FIGURE_TITLES = (() => {
  const f = ['Age', 'Income', 'Credit Score', 'Employment Length'];
  const pairs = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) pairs.push(`Decision boundaries: ${f[i]} vs ${f[j]}`);
  return ['ROC curves (test split)', 'Confusion matrices (test split)', ...pairs, 'Model performance comparison'];
})();
