import { useMemo, useState, useEffect, useId } from 'react';
import scottSql from '../../scott.sql?raw';
import queriesSql from '../../all_queries.sql?raw';
import nb from './generated/notebook.json';
import { parseScott, parseQueries, fmtDate } from './parse.js';
import { QUERIES, USES_SYSDATE, raise, grade } from './oracle.js';
import { bayesCeiling, wilson, generate, scaler, fitLDA, fitKNN, accuracy } from './stats.js';

const REPO = 'https://github.com/JesunAhmadUshno/Database';
const blob = (p) => `${REPO}/blob/master/${p}`;
const NB_FILE = 'decision_boundaries_analysis_feature_pairs.ipynb';
const BASE = import.meta.env.BASE_URL;
const f3 = (x) => x.toFixed(3);
const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const money = (n) => n.toLocaleString('en-US');

// Everything below is parsed from the repo files at build time.
const db = parseScott(scottSql);
const queries = parseQueries(queriesSql);
const lectures = [...new Set(queries.map((q) => q.lecture))];
const deptName = Object.fromEntries(db.dept.map((d) => [d.DEPTNO, d.DNAME]));
const ceiling = bayesCeiling(nb.features);
const support = nb.reports.LDA;
const majority = Math.max(support[0].support, support[1].support) / nb.nTest;
const best = nb.comparison.reduce((a, b) => (b.accuracy > a.accuracy ? b : a));
const bestAuc = nb.comparison.reduce((a, b) => (b.auc > a.auc ? b : a));
// Exercise 6.2's raise, read from its SQL text ("sal*0.15").
const RAISE_62 = Math.round(+queries.find((q) => q.id === '6.2').sql.match(/sal\*([\d.]+)/)[1] * 100);
const LABEL = { age: 'Age', income: 'Income', credit_score: 'Credit score', employment_length: 'Employment length' };

const SECTIONS = [['top', 'Overview', '◎'], ['schema', 'Schema', '▦'], ['queries', 'Query runner', '❯_'], ['raise', 'Raise calculator', '%'], ['ceiling', 'Bayes ceiling', '⊤'], ['playground', 'Playground', '◐'], ['results', 'Recorded results', '▥'], ['figures', 'Figures', '▣'], ['review', 'Review', '✓']];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function MenuBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return (
    <div className="menubar" role="banner">
      <span className="apple" aria-hidden="true">◆</span>
      <a className="app" href="#top">Database Lab</a>
      <a className="m" href={blob('README.md')}>README</a>
      <a className="m" href={blob('docs/research-review.md')}>Research review</a>
      <a className="m" href={blob('scott.sql')}>scott.sql</a>
      <a className="m" href={blob(NB_FILE)}>Notebook</a>
      <span className="spacer" />
      <span className="status"><i /> Checks run at build</span>
      <a href={REPO}>GitHub ↗</a>
      <span className="clock">{now.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  );
}

function Dock() {
  const [active, setActive] = useState('top');
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-45% 0px -50% 0px' });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return (
    <nav className="dock" aria-label="Sections">
      {SECTIONS.map(([id, label, icon]) => (
        <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined} aria-label={label}>
          <span className="ico" aria-hidden="true">{icon}</span><span className="lbl">{label}</span>
        </a>
      ))}
    </nav>
  );
}

function Range({ label, value, min, max, step, onChange, show }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label} <span>{show}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

export default function App() {
  useReveal();
  return (
    <div className="wrap">
      <MenuBar />
      <div className="glow" aria-hidden="true" />
      <Hero />
      <Schema />
      <Runner />
      <Raise />
      <Ceiling />
      <Playground />
      <Results />
      <Figures />
      <Review />
      <Dock />
      <footer>
        Every number on this page is parsed at build time from <code>scott.sql</code>, <code>all_queries.sql</code> and the saved outputs of <code>{NB_FILE}</code>, or computed live in your browser from them.
        Windows marked RECORDED replay the notebook's saved outputs; nothing on this page reruns the notebook.
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <header className="card hero window" id="top" data-title="Database — README">
      <div className="head">
        <p className="eyebrow">Coursework · Oracle SQL and classification</p>
        <span className="pill info">● {Object.keys(QUERIES).length} answers checked at build</span>
      </div>
      <h1>{queries.length} SQL answers on SCOTT, and a loan model that <em>already sits at its ceiling</em>.</h1>
      <p className="sub">
        Two pieces of database and data-mining coursework. The SQL answers run live below over the rows parsed from <code>scott.sql</code>.
        The notebook compares {nb.comparison.length} classifiers on a synthetic loan dataset. Its best test score, {best.model} at {f3(best.accuracy)}, is within a few points of {f3(ceiling.ceiling)}:
        the best accuracy any model can reach on data generated by those rules. The differences between the models are inside the noise of a {nb.nTest}-row test split.
      </p>
      <div className="actions">
        <a className="btn primary" href="#queries">Run the SQL answers</a>
        <a className="btn ghost" href="#ceiling">See the ceiling calculation</a>
        <span className="hint">Rebuild with <code>cd site && npm ci && npm run build</code></span>
      </div>
      <div className="tiles">
        <div className="tile"><div className="num">{queries.length}</div><div className="cap">SQL answers across {lectures.length} lectures ({lectures.map((l) => `L${l}: ${queries.filter((q) => q.lecture === l).length}`).join(', ')})</div></div>
        <div className="tile"><div className="num">{db.emp.length} · {db.dept.length} · {db.salgrade.length}</div><div className="cap">Rows in EMP, DEPT and SALGRADE, parsed from the INSERTs</div></div>
        <div className="tile"><div className="num">{f3(best.accuracy)}</div><div className="cap">Best recorded test accuracy ({best.model}); best ROC AUC {f3(bestAuc.auc)} ({bestAuc.model})</div></div>
        <div className="tile"><div className="num">{f3(ceiling.ceiling)}</div><div className="cap">Highest accuracy any model can reach on this generator (exact)</div></div>
      </div>
    </header>
  );
}

function Schema() {
  const [table, setTable] = useState('EMP');
  const [sort, setSort] = useState({ col: null, dir: 1 });
  const t = db.tables.find((x) => x.name === table);
  const rows = useMemo(() => {
    const r = [...(db[table.toLowerCase()] || [])];
    if (sort.col) r.sort((a, b) => { const x = a[sort.col], y = b[sort.col]; if (x === y) return 0; if (x === null) return 1; if (y === null) return -1; return (x < y ? -1 : 1) * sort.dir; });
    return r;
  }, [table, sort]);
  const show = (c, v) => (v === null || v === undefined ? <span className="null">null</span> : c.type === 'DATE' ? fmtDate(v) : v);
  return (
    <section id="schema" className="card window reveal" data-title="scott.sql — schema browser">
      <p className="eyebrow">The SCOTT schema</p>
      <h2>Four tables, one foreign key, {db.emp.length + db.dept.length + db.salgrade.length} rows.</h2>
      <p className="sub">
        Parsed from the CREATE TABLE and INSERT statements in <a href={blob('scott.sql')}>scott.sql</a>. The file starts with setup prose before the DDL, so it is not a runnable script as is; the parser reads only the statements.
        Two hire dates are written as date arithmetic (<code>to_date('13-JUL-87')-85</code>), which the parser evaluates.
      </p>
      <div className="schema-grid" style={{ marginTop: 18 }}>
        {db.tables.map((tb) => (
          <button key={tb.name} className={`tbl ${table === tb.name ? 'on' : ''}`} onClick={() => { setTable(tb.name); setSort({ col: null, dir: 1 }); }} aria-pressed={table === tb.name}>
            <b>{tb.name}</b><small>{(db[tb.name.toLowerCase()] || []).length} rows</small>
            <ul>{tb.cols.map((c) => <li key={c.name}><span>{c.name}</span><em>{c.type}</em>{c.pk && <i className="k pk">PK</i>}{c.fk && <i className="k fk">FK → {c.fk}</i>}</li>)}</ul>
          </button>
        ))}
      </div>
      <h3 style={{ marginTop: 22 }}>{table} rows {rows.length ? '(click a column to sort)' : ''}</h3>
      {rows.length ? (
        <div className="scroll-x" style={{ marginTop: 8 }}>
          <table>
            <thead><tr>{t.cols.map((c) => (
              <th key={c.name} aria-sort={sort.col === c.name ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                <button className="sorter" onClick={() => setSort((s) => ({ col: c.name, dir: s.col === c.name ? -s.dir : 1 }))}>{c.name}{sort.col === c.name ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</button>
              </th>))}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{t.cols.map((c) => <td key={c.name}>{show(c, r[c.name])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : <p className="hint">BONUS is created but scott.sql inserts no rows into it.</p>}
    </section>
  );
}

function Runner() {
  const [lec, setLec] = useState(4);
  const [id, setId] = useState('4.1');
  const [now, setNow] = useState(() => new Date());
  const q = queries.find((x) => x.id === id);
  const rows = useMemo(() => QUERIES[id](db, now), [id, now]);
  const inLec = queries.filter((x) => x.lecture === lec);
  const ordered = /ORDER BY/i.test(q.sql);
  return (
    <section id="queries" className="card window reveal" data-title="all_queries.sql — query runner (live)">
      <div className="head">
        <div>
          <p className="eyebrow">Live in your browser</p>
          <h2>Pick an exercise, read the exact SQL, see what Oracle would return.</h2>
          <p className="sub">
            The SQL is the file's text, verbatim. Each answer has a small hand-written JavaScript equivalent that runs over the parsed SCOTT rows with Oracle's rules
            (half-away-from-zero ROUND, padded TO_CHAR day and month names, the ADD_MONTHS end-of-month rule). A node check asserts known results before every build.
          </p>
        </div>
        <span className="pill info">{rows.length} row{rows.length === 1 ? '' : 's'}</span>
      </div>
      <div className="seg" role="group" aria-label="Lecture">
        {lectures.map((l) => <button key={l} aria-pressed={lec === l} onClick={() => { setLec(l); setId(queries.find((x) => x.lecture === l).id); }}>Lecture {l}</button>)}
      </div>
      <div className="chips" role="group" aria-label={`Lecture ${lec} exercises`}>
        {inLec.map((x, i) => {
          const prev = inLec[i - 1];
          const gap = lec === 4 && prev && +x.num - +prev.num > 1;
          return (
            <span key={x.id} style={{ display: 'contents' }}>
              {gap && <span className="chip missing" title="Exercise 4.4 does not appear in all_queries.sql">{lec}.{+prev.num + 1} not in file</span>}
              <button className="chip" aria-pressed={id === x.id} onClick={() => setId(x.id)}>{x.num}{USES_SYSDATE.has(x.id) ? ' ◷' : ''}</button>
            </span>
          );
        })}
      </div>
      <pre className="sql" aria-label={`SQL for exercise ${id}`}><code>{q.sql}</code></pre>
      <div className="notes">
        {USES_SYSDATE.has(id) && <span className="pill warn">Uses SYSDATE: computed from your clock, {now.toLocaleString('en-US')} <button className="linkish" onClick={() => setNow(new Date())}>refresh</button></span>}
        {id === '4.3' && <span className="pill warn">Compares a DATE to a string: depends on the session NLS_DATE_FORMAT; TO_DATE would be portable</span>}
        {!ordered && rows.length > 1 && <span className="pill info">No ORDER BY: shown in insert order, which Oracle does not guarantee</span>}
        {id === '6.4' && <span className="pill info">Oracle pads Day and Month to 9 characters, so the spaces are real</span>}
      </div>
      <div className="scroll-x result">
        <table>
          <thead><tr>{q.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={typeof v === 'string' && /  /.test(v) ? 'pre' : ''}>{v === null ? <span className="null">null</span> : v}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function Raise() {
  const [p, setP] = useState(RAISE_62);
  const rows = db.emp.map((e) => { const n = raise(e.SAL, p); return { e, n, g0: grade(e.SAL, db.salgrade), g1: grade(n, db.salgrade) }; });
  const moved = rows.filter((r) => r.g0 !== r.g1).length;
  const tot0 = rows.reduce((s, r) => s + r.e.SAL, 0), tot1 = rows.reduce((s, r) => s + r.n, 0);
  const depts = db.dept.map((d) => { const rs = rows.filter((r) => r.e.DEPTNO === d.DEPTNO); return { d, before: rs.reduce((s, r) => s + r.e.SAL, 0), after: rs.reduce((s, r) => s + r.n, 0), n: rs.length }; });
  const max = Math.max(...depts.map((d) => d.after), 1);
  const W = 460, rowH = 46, H = depts.length * rowH + 8, L = 110;
  return (
    <section id="raise" className="card window reveal" data-title="salgrade.app — raise calculator (live)">
      <p className="eyebrow">Exercises 6.2 and 6.3, generalised</p>
      <h2>Give everyone a raise and watch who changes salary grade.</h2>
      <p className="sub">
        Exercise 6.2 applies a {RAISE_62}% raise with <code>ROUND(sal+(sal*0.15))</code>. Move the slider to try any whole percentage: new salaries use the same Oracle rounding, and each salary is placed in its SALGRADE band from scott.sql.
      </p>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div>
          <div className="controls" style={{ gridTemplateColumns: '1fr' }}>
            <Range label="Raise for every employee" value={p} min={0} max={60} step={1} onChange={setP} show={`${p}%${p === RAISE_62 ? ' (exercise 6.2)' : ''}`} />
          </div>
          <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 0 }}>
            <div className="tile"><div className="num">{money(tot1)}</div><div className="cap">Monthly payroll after the raise, up {money(tot1 - tot0)} from {money(tot0)}</div></div>
            <div className="tile"><div className="num">{moved} of {rows.length}</div><div className="cap">Employees who move to a higher SALGRADE band</div></div>
          </div>
        </div>
        <div>
          <h3>Monthly payroll by department</h3>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Department payroll before and after a ${p}% raise`}>
            {depts.map((d, i) => (
              <g key={d.d.DEPTNO} transform={`translate(0 ${i * rowH + 4})`}>
                <text x={0} y={14} style={{ fill: 'var(--text)', fontSize: 12 }}>{d.d.DNAME}</text>
                <text x={0} y={30}>{d.n} employee{d.n === 1 ? '' : 's'}</text>
                <rect x={L} y={4} height={12} rx={6} width={((W - L - 70) * d.after) / max} fill="var(--primary)" opacity="0.85" />
                <rect x={L} y={20} height={12} rx={6} width={((W - L - 70) * d.before) / max} fill="var(--muted)" opacity="0.45" />
                <text x={L + ((W - L - 70) * d.after) / max + 6} y={14} style={{ fill: 'var(--text)' }}>{money(d.after)}</text>
                <text x={L + ((W - L - 70) * d.before) / max + 6} y={30}>{money(d.before)}</text>
              </g>
            ))}
          </svg>
          <div className="legend"><span><i style={{ background: 'var(--primary)' }} />after</span><span><i style={{ background: 'var(--muted)' }} />before</span></div>
        </div>
      </div>
      <div className="scroll-x" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>Employee</th><th>Department</th><th>Salary</th><th>New salary</th><th>Increase</th><th>Grade</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.e.EMPNO}><td>{r.e.ENAME}</td><td>{deptName[r.e.DEPTNO]}</td><td>{money(r.e.SAL)}</td><td>{money(r.n)}</td><td>+{money(r.n - r.e.SAL)}</td>
              <td className={r.g0 !== r.g1 ? 'ok' : ''}>{r.g0}{r.g0 !== r.g1 ? ` → ${r.g1 ?? 'above top band'}` : ''}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function Ceiling() {
  const [feats, setFeats] = useState(nb.features);
  const set = (i, k, v) => setFeats((fs) => fs.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  const res = bayesCeiling(feats);
  const isDefault = feats.every((f, i) => f.w === nb.features[i].w && f.thr === nb.features[i].thr);
  const majorityPop = Math.max(res.positive, 1 - res.positive);
  return (
    <section id="ceiling" className="card window reveal" data-title="loan_data.py — Bayes ceiling (live, exact)">
      <div className="head">
        <div>
          <p className="eyebrow">How good can any model be?</p>
          <h2>The labels are partly coin flips, so no model can beat <em>{f3(bayesCeiling(nb.features).ceiling)}</em>.</h2>
          <p className="sub">
            The notebook's <code>generate_synthetic_data</code> draws each feature uniformly and sets <code>loan_approved</code> to 1 with probability equal to a weighted sum of four threshold tests.
            The best possible classifier predicts 1 when that probability is above one half, and its accuracy is the average of max(p, 1 − p).
            This page computes it exactly over the 16 combinations of the thresholds, using the integer ranges read from the notebook. Change a rule and it recomputes.
          </p>
        </div>
        {!isDefault && <button className="btn ghost" onClick={() => setFeats(nb.features)}>Reset to the notebook's rules</button>}
      </div>
      <div className="rules">
        {feats.map((f, i) => (
          <div className="rule" key={f.name}>
            <div className="rule-head"><b className="mono">{f.name}</b><span className="hint">randint({money(f.lo)}, {money(f.hi)})</span></div>
            <Range label="Weight" value={f.w} min={0} max={0.6} step={0.05} onChange={(v) => set(i, 'w', +v.toFixed(2))} show={f.w.toFixed(2)} />
            <Range label="Threshold (x >)" value={f.thr} min={f.lo} max={f.hi - 1} step={f.hi - f.lo > 1000 ? 1000 : 1} onChange={(v) => set(i, 'thr', v)} show={money(f.thr)} />
          </div>
        ))}
      </div>
      <div className="tiles">
        <div className="tile"><div className="num">{f3(res.ceiling)}</div><div className="cap">Best possible accuracy {isDefault ? '(notebook rules)' : '(your rules)'}</div></div>
        <div className="tile"><div className="num">{f3(res.positive)}</div><div className="cap">Share of loans approved, P(y = 1)</div></div>
        <div className="tile"><div className="num">{f3(majorityPop)}</div><div className="cap">Accuracy of always guessing the larger class</div></div>
        <div className="tile"><div className="num">{f3(best.accuracy)}</div><div className="cap">{best.model}'s recorded test accuracy, for comparison (RECORDED)</div></div>
      </div>
      {res.clipped && <p className="hint" style={{ color: 'var(--warn)' }}>Your weights push the probability outside 0 to 1 for some applicants. The calculator clips it; numpy's binomial would raise an error instead.</p>}
      <p className="hint" style={{ marginTop: 12 }}>
        The notebook's docstring calls the classes imbalanced; with these rules about {pct(bayesCeiling(nb.features).positive, 0)} of loans are approved, so the imbalance is mild.
        A node check confirms {f3(bayesCeiling(nb.features).ceiling)} by simulating 200,000 applicants.
      </p>
    </section>
  );
}

const PAIRS = [];
for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) PAIRS.push([i, j]);

function Playground() {
  const [pair, setPair] = useState(3); // index into PAIRS: income x credit_score
  const [k, setK] = useState(nb.k);
  const [seed, setSeed] = useState(1);
  const [a, b] = PAIRS[pair];
  const nTrain = nb.nSamples - nb.nTest;
  const data = useMemo(() => generate(nb.features, nb.nSamples, seed), [seed]);
  const fit = useMemo(() => {
    const s = scaler(data.X.slice(0, nTrain));
    const Z = data.X.map((r) => { const z = s(r); return [z[a], z[b]]; });
    const tr = Z.slice(0, nTrain), ytr = data.y.slice(0, nTrain), te = Z.slice(nTrain), yte = data.y.slice(nTrain);
    const lda = fitLDA(tr, ytr), knn = fitKNN(tr, ytr, k);
    const G = 36, lo = -2.1, hi = 2.1, step = (hi - lo) / G;
    const grid = (pred) => { const out = []; for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) out.push(pred([lo + (gx + 0.5) * step, hi - (gy + 0.5) * step])); return out; };
    return { te, yte, G, lo, hi, models: [['LDA', lda], [`kNN (k = ${k})`, knn]].map(([name, m]) => ({ name, cells: grid(m), acc: accuracy(m, te, yte) })) };
  }, [data, a, b, k, nTrain]);
  const pairCeil = bayesCeiling(nb.features, nb.features.map((_, i) => i === a || i === b)).ceiling;
  const W = 300, P = 28, S = W - P - 6;
  const sx = (v) => P + ((v - fit.lo) / (fit.hi - fit.lo)) * S, sy = (v) => 6 + ((fit.hi - v) / (fit.hi - fit.lo)) * S;
  const jitter = (i, d) => (((i * 9301 + d * 49297) % 233280) / 233280 - 0.5) * 0.12;
  return (
    <section id="playground" className="card window reveal" data-title="decision_boundaries.ipynb — playground (live, fresh sample)">
      <div className="head">
        <div>
          <p className="eyebrow">Live, on a fresh sample</p>
          <h2>Refit LDA and kNN on any feature pair and see where they draw the line.</h2>
          <p className="sub">
            Your browser draws {money(nb.nSamples)} applicants with the notebook's rules, holds out {nb.nTest} for testing, standardizes using the training rows only, and fits both models on the chosen pair.
            This is a different random draw from the notebook's numpy stream, so its scores will not match the recorded ones; the point is how the boundaries behave.
          </p>
        </div>
        <span className="pill warn">Fresh JS sample, not the notebook's data</span>
      </div>
      <div className="controls">
        <div className="field"><label htmlFor="pair">Feature pair</label>
          <select id="pair" value={pair} onChange={(e) => setPair(+e.target.value)}>
            {PAIRS.map(([i, j], n) => <option key={n} value={n}>{LABEL[nb.features[i].name]} × {LABEL[nb.features[j].name]}</option>)}
          </select>
        </div>
        <Range label="Neighbours k" value={k} min={1} max={51} step={2} onChange={setK} show={k} />
        <div className="field"><label htmlFor="seed">Sample seed</label><input id="seed" type="number" min="1" value={seed} onChange={(e) => setSeed(Math.max(1, Math.floor(+e.target.value) || 1))} /></div>
      </div>
      <div className="grid2">
        {fit.models.map((m) => {
          const [lo, hi] = wilson(m.acc, nb.nTest);
          const cw = S / fit.G;
          return (
            <div key={m.name}>
              <div className="head" style={{ marginBottom: 6 }}><h3>{m.name}</h3><span className="pill info">holdout {f3(m.acc)} · 95% CI {f3(lo)} to {f3(hi)}</span></div>
              <svg className="chart" viewBox={`0 0 ${W} ${W + 20}`} role="img" aria-label={`${m.name} decision regions for ${LABEL[nb.features[a].name]} and ${LABEL[nb.features[b].name]}`}>
                {[1, 0].map((cls) => (
                  <g key={cls} opacity={cls ? 0.2 : 0.15} shapeRendering="crispEdges">
                    {m.cells.map((c, i) => c === cls && <rect key={i} x={P + (i % fit.G) * cw} y={6 + Math.floor(i / fit.G) * cw} width={cw + 0.5} height={cw + 0.5} fill={cls ? 'var(--good)' : 'var(--bad)'} />)}
                  </g>
                ))}
                {fit.te.map((p, i) => <circle key={i} cx={sx(p[0] + jitter(i, 1))} cy={sy(p[1] + jitter(i, 2))} r="2.6" fill={fit.yte[i] ? 'var(--good)' : 'var(--bad)'} stroke="var(--surface-strong)" strokeWidth="0.6" />)}
                <text x={P + S / 2} y={W + 14} textAnchor="middle">{LABEL[nb.features[a].name]} (standardized)</text>
                <text x={10} y={6 + S / 2} textAnchor="middle" transform={`rotate(-90 10 ${6 + S / 2})`}>{LABEL[nb.features[b].name]}</text>
              </svg>
            </div>
          );
        })}
      </div>
      <div className="legend" style={{ marginTop: 22 }}><span><i style={{ background: 'var(--good)' }} />approved (1)</span><span><i style={{ background: 'var(--bad)' }} />declined (0)</span><span>Dots: the {nb.nTest} held-out applicants, slightly jittered because some features take few values.</span></div>
      <p className="hint">Best possible accuracy using only this pair: <b>{f3(pairCeil)}</b> (exact, same method as the ceiling window). With all four features it is {f3(ceiling.ceiling)}.</p>
    </section>
  );
}

function Results() {
  const [view, setView] = useState('acc');
  const rows = nb.comparison.map((r) => ({ ...r, ci: wilson(r.accuracy, nb.nTest), cv: nb.cv[r.model], rep: nb.reports[r.model] }));
  const W = 960, rowH = 52, H = rows.length * rowH + 40, L = 150, R = 24, lo = 0.55, hi = 0.8;
  const x = (v) => L + ((v - lo) / (hi - lo)) * (W - L - R);
  const ref = [[majority, 'always guess "approved"', 'var(--bad)'], [ceiling.ceiling, 'best possible (exact)', 'var(--good)']];
  return (
    <section id="results" className="card window reveal" data-title="model_comparison.csv — RECORDED notebook outputs">
      <div className="head">
        <div>
          <p className="eyebrow">Recorded results, with context the notebook leaves out</p>
          <h2>All four models land between the majority-class guess and the ceiling, and their intervals overlap.</h2>
          <p className="sub">
            These numbers are replayed from the notebook's saved outputs. Two reference lines are added: always predicting the larger class scores {f3(majority)} on this test split ({Math.max(support[0].support, support[1].support)} of {nb.nTest}, from the report's support counts),
            and {f3(ceiling.ceiling)} is the best any model can do. Random Forest's test accuracy equals the majority baseline. The 95% Wilson intervals (computed here from n = {nb.nTest}) all overlap, and the cross-validation ranking disagrees with the test ranking.
          </p>
        </div>
        <span className="pill warn">RECORDED</span>
      </div>
      <div className="seg" role="group" aria-label="Results view">
        {[['acc', 'Accuracy and intervals'], ['class', 'Per-class report']].map(([kk, l]) => <button key={kk} aria-pressed={view === kk} onClick={() => setView(kk)}>{l}</button>)}
      </div>
      {view === 'acc' ? (
        <>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Recorded test accuracy with 95% intervals and cross-validation means for each model" style={{ marginTop: 16 }}>
            {[0.55, 0.6, 0.65, 0.7, 0.75, 0.8].map((t) => <g key={t}><line className="axis" x1={x(t)} x2={x(t)} y1={18} y2={H - 22} /><text x={x(t)} y={H - 6} textAnchor="middle">{t.toFixed(2)}</text></g>)}
            {ref.map(([v, l, c], i) => <g key={l}><line x1={x(v)} x2={x(v)} y1={18} y2={H - 22} stroke={c} strokeDasharray="5 4" strokeWidth="1.5" /><text x={x(v) + (i ? 6 : -6)} y={12} textAnchor={i ? 'start' : 'end'} style={{ fill: c }}>{l} {f3(v)}</text></g>)}
            {rows.map((r, i) => (
              <g key={r.model} transform={`translate(0 ${i * rowH + 44})`}>
                <text x={0} y={4} style={{ fill: 'var(--text)', fontSize: 13 }}>{r.model}</text>
                <line x1={x(r.ci[0])} x2={x(r.ci[1])} y1={0} y2={0} stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
                <circle cx={x(r.accuracy)} cy={0} r="6" fill="var(--primary)" />
                <text x={x(r.accuracy)} y={-10} textAnchor="middle" style={{ fill: 'var(--text)' }}>{f3(r.accuracy)}</text>
                <line x1={x(r.cv.mean - r.cv.pm2sd)} x2={x(r.cv.mean + r.cv.pm2sd)} y1={14} y2={14} stroke="var(--warn)" strokeWidth="2" opacity="0.7" />
                <rect x={x(r.cv.mean) - 4} y={10} width="8" height="8" fill="var(--warn)" transform={`rotate(45 ${x(r.cv.mean)} 14)`} />
              </g>
            ))}
          </svg>
          <div className="legend"><span><i style={{ background: 'var(--primary)' }} />test accuracy, 95% Wilson interval</span><span><i style={{ background: 'var(--warn)' }} />{nb.cvFolds}-fold CV mean ± 2 sd (as printed)</span></div>
          <div className="scroll-x" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Model</th><th>Test accuracy</th><th>95% interval</th><th>ROC AUC</th><th>CV mean ± 2 sd</th><th>vs majority baseline</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.model}><td>{r.model}</td><td>{f3(r.accuracy)}</td><td>{f3(r.ci[0])} to {f3(r.ci[1])}</td><td>{f3(r.auc)}</td><td>{f3(r.cv.mean)} ± {f3(r.cv.pm2sd)}</td>
                  <td><span className={`pill ${r.ci[0] > majority ? 'good' : 'warn'}`}>{r.accuracy === majority ? 'equal' : r.ci[0] > majority ? 'interval clears it' : 'interval includes it'}</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="scroll-x" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Model</th><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Support</th></tr></thead>
            <tbody>{rows.flatMap((r) => ['0', '1'].map((c) => (
              <tr key={r.model + c}><td>{c === '0' ? r.model : ''}</td><td>{c === '0' ? '0 declined' : '1 approved'}</td><td>{r.rep[c].precision.toFixed(2)}</td><td>{r.rep[c].recall.toFixed(2)}</td><td>{r.rep[c].f1.toFixed(2)}</td><td>{r.rep[c].support}</td></tr>
            )))}</tbody>
          </table>
          <p className="hint">Two-decimal values as printed by scikit-learn's classification_report.</p>
        </div>
      )}
    </section>
  );
}

function Figures() {
  const [i, setI] = useState(0);
  const f = nb.figures[i];
  return (
    <section id="figures" className="card window reveal" data-title={`figures/ — ${nb.figures.length} RECORDED notebook images`}>
      <div className="head">
        <div>
          <p className="eyebrow">Recorded figures</p>
          <h2>The notebook's own plots, decoded from its saved outputs.</h2>
          <p className="sub">The build step extracts each embedded PNG from the notebook file. The decision-boundary grids were drawn after refitting every model on all {money(nb.nSamples)} rows, test rows included, so they show fitted shapes rather than held-out performance.</p>
        </div>
        <span className="pill warn">RECORDED</span>
      </div>
      <div className="chips" role="group" aria-label="Choose a figure">
        {nb.figures.map((g, n) => <button key={g.file} className="chip" aria-pressed={i === n} onClick={() => setI(n)}>{n + 1}. {g.title.replace('Decision boundaries: ', '')}</button>)}
      </div>
      <figure className="fig">
        <img src={`${BASE}figures/${f.file}`} alt={`Notebook figure ${i + 1}: ${f.title}`} width={f.w} height={f.h} />
        <figcaption>{f.title} · {f.w}×{f.h} px</figcaption>
      </figure>
    </section>
  );
}

function Review() {
  const gaps = [
    ['fixed', 'No baseline', `Added here: the majority-class rate ${f3(majority)} from the support counts. Random Forest's ${f3(nb.comparison.find((r) => r.model === 'Random Forest').accuracy)} equals it.`],
    ['fixed', 'No theoretical ceiling', `Added here: the exact Bayes ceiling ${f3(ceiling.ceiling)}, computed from the generator and confirmed by simulation.`],
    ['fixed', 'No uncertainty on test accuracy', `Added here: Wilson 95% intervals for n = ${nb.nTest}; every pair of models overlaps.`],
    ['fixed', 'No README or tests', 'Added a README and node checks for the SQL equivalents and the statistics, run by npm test and before every build.'],
    ['open', 'Scaler fitted before the split', 'StandardScaler sees the test rows. Needs one CPU rerun (seconds) with a scikit-learn Pipeline; this page does not change the recorded numbers.'],
    ['open', 'No paired comparison', 'McNemar tests need the per-row predictions, which the notebook does not save. Needs the same rerun, writing predictions to a results file.'],
    ['open', 'No tuning or calibration', 'k = 5, default forest, QDA without regularisation; no Brier score. Needs a small grid search in the same rerun.'],
    ['open', 'SQL gaps', 'Exercise 4.4 is missing, 4.3 relies on NLS date conversion, and no exercise statements are recorded. Needs the original exercise sheet.'],
  ];
  return (
    <section id="review" className="card window reveal" data-title="review.md — grading notes">
      <p className="eyebrow">Honest limits</p>
      <h2>What this coursework shows, and what it does not.</h2>
      <p className="sub">
        The full review is in <a href={blob('docs/research-review.md')}>docs/research-review.md</a>. In short: the SQL is correct and readable, and the notebook runs cleanly, but the model comparison cannot rank the models,
        because the data allow at most {f3(ceiling.ceiling)} and the test split is too small to separate scores this close.
      </p>
      <div className="grid2" style={{ marginTop: 16 }}>
        {gaps.map(([s, t, d]) => (
          <div className="tile" key={t}>
            <div className="head" style={{ marginBottom: 6 }}><h3>{t}</h3><span className={`pill ${s === 'fixed' ? 'good' : 'warn'}`}>{s === 'fixed' ? 'Addressed' : 'Open'}</span></div>
            <p className="hint" style={{ margin: 0, fontSize: 13 }}>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
