// Known-answer check for the loan-model numbers: node src/stats.check.mjs (runs inside npm test / build).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseNotebook } from './parse.js';
import { bayesCeiling, wilson, generate, scaler, fitLDA, fitKNN, accuracy } from './stats.js';

const nb = parseNotebook(JSON.parse(fs.readFileSync(new URL('../../decision_boundaries_analysis_feature_pairs.ipynb', import.meta.url), 'utf8')));
const F = nb.features;

// Generator constants read from the notebook source.
assert.deepEqual(F.map((f) => [f.name, f.lo, f.hi, f.w, f.thr]), [
  ['age', 20, 65, 0.2, 25], ['income', 10000, 100000, 0.3, 45000], ['credit_score', 400, 900, 0.4, 700], ['employment_length', 1, 7, 0.1, 2]]);

// Closed-form ceiling, cross-checked in Python during review: 0.71873 and 0.58253.
const b = bayesCeiling(F);
assert.ok(Math.abs(b.ceiling - 0.71873) < 5e-6, `ceiling ${b.ceiling}`);
assert.ok(Math.abs(b.positive - 0.58253) < 5e-6, `positive ${b.positive}`);
assert.equal(b.clipped, false);

// Monte Carlo agreement: the JS generator with the Bayes rule lands on the closed form.
const big = generate(F, 200000, 7);
const bayes = (x) => (F.reduce((s, f, j) => s + (x[j] > f.thr ? f.w : 0), 0) > 0.5 ? 1 : 0);
const mcAcc = big.X.reduce((s, x, i) => s + (bayes(x) === big.y[i] ? 1 : 0), 0) / big.X.length;
const mcPos = big.y.reduce((s, v) => s + v, 0) / big.y.length;
assert.ok(Math.abs(mcAcc - b.ceiling) < 0.004, `MC ceiling ${mcAcc}`);
assert.ok(Math.abs(mcPos - b.positive) < 0.004, `MC positive ${mcPos}`);

// Recorded results parsed from the notebook's saved outputs.
assert.deepEqual(nb.comparison.map((r) => [r.model, r.accuracy]), [['LDA', 0.715], ['QDA', 0.685], ['kNN', 0.68], ['Random Forest', 0.645]]);
assert.equal(Math.max(...nb.comparison.map((r) => r.auc)).toFixed(3), '0.769');
assert.equal(nb.cv['Random Forest'].mean, 0.681);
const sup = nb.reports.LDA;
assert.equal(sup[0].support + sup[1].support, nb.nTest);
const majority = Math.max(sup[0].support, sup[1].support) / nb.nTest;
assert.equal(majority, 0.645); // equals Random Forest's test accuracy
const [lo, hi] = wilson(0.715, 200);
assert.ok(Math.abs(lo - 0.6491) < 5e-4 && Math.abs(hi - 0.7728) < 5e-4, `wilson ${lo} ${hi}`);

// Playground sanity: on a fresh draw, LDA and kNN on credit_score x income stay at or below the
// two-feature ceiling (plus sampling noise on a 2,000-row holdout).
const d = generate(F, 10000, 42);
const tr = d.X.slice(0, 8000), te = d.X.slice(8000);
const s = scaler(tr), pick = (r) => { const z = s(r); return [z[2], z[1]]; };
const pair = bayesCeiling(F, [false, true, true, false]).ceiling;
const lda = accuracy(fitLDA(tr.map(pick), d.y.slice(0, 8000)), te.map(pick), d.y.slice(8000));
const knn = accuracy(fitKNN(tr.map(pick), d.y.slice(0, 8000), 15), te.map(pick).slice(0, 500), d.y.slice(8000, 8500));
assert.ok(lda < pair + 0.03 && lda > pair - 0.05, `lda ${lda} vs pair ceiling ${pair}`);
assert.ok(knn < pair + 0.06, `knn ${knn}`);
console.log('stats ok', { ceiling: +b.ceiling.toFixed(5), positive: +b.positive.toFixed(5), mcAcc, majority, pairCeiling: +pair.toFixed(4), lda, knn });
