// Statistics for the loan-model windows. Generator constants come from the notebook (parse.js).

const clamp01 = (v) => Math.min(1, Math.max(0, v));
// P(x > thr) for numpy randint(lo, hi): integers lo..hi-1, uniform.
export const pAbove = ({ lo, hi, thr }) => clamp01((hi - 1 - Math.max(thr, lo - 1)) / (hi - lo));

// Exact Bayes ceiling: the best accuracy any classifier can reach when it sees the `observed`
// features (default: all). The label is Bernoulli(p) with p = sum of w * [x > thr], so the best rule
// predicts 1 when E[p | observed] > 0.5, and its accuracy is E[max(p, 1 - p)].
export function bayesCeiling(features, observed = features.map(() => true)) {
  const q = features.map(pAbove);
  const obs = features.map((_, i) => i).filter((i) => observed[i]);
  const base = features.reduce((s, f, i) => (observed[i] ? s : s + f.w * q[i]), 0);
  let ceiling = 0, positive = 0, clipped = false;
  for (let mask = 0; mask < 1 << obs.length; mask++) {
    let prob = 1, p = base;
    obs.forEach((i, b) => { const on = (mask >> b) & 1; prob *= on ? q[i] : 1 - q[i]; if (on) p += features[i].w; });
    if (p > 1 || p < 0) clipped = true;
    p = clamp01(p);
    ceiling += prob * Math.max(p, 1 - p);
    positive += prob * p;
  }
  return { ceiling, positive, clipped };
}

// Wilson score interval for a proportion.
export function wilson(p, n, z = 1.959964) {
  const d = 1 + (z * z) / n, c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [c - h, c + h];
}

// Small seeded PRNG (mulberry32). Not numpy's MT19937, so draws differ from the notebook's.
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Same rules as generate_synthetic_data: uniform integer features, Bernoulli label.
export function generate(features, n, seed) {
  const r = rng(seed);
  const X = [], y = [];
  for (let i = 0; i < n; i++) {
    const x = features.map((f) => f.lo + Math.floor(r() * (f.hi - f.lo)));
    const p = clamp01(features.reduce((s, f, j) => s + (x[j] > f.thr ? f.w : 0), 0));
    X.push(x); y.push(r() < p ? 1 : 0);
  }
  return { X, y };
}

// Standardize with the training rows' mean and sd only (the notebook fits its scaler on all rows).
export function scaler(rows) {
  const d = rows[0].length, n = rows.length;
  const mu = Array.from({ length: d }, (_, j) => rows.reduce((s, r) => s + r[j], 0) / n);
  const sd = mu.map((m, j) => Math.sqrt(rows.reduce((s, r) => s + (r[j] - m) ** 2, 0) / n) || 1);
  return (r) => r.map((v, j) => (v - mu[j]) / sd[j]);
}

// Two-feature LDA with pooled covariance, closed form. Returns predict([a, b]) -> 0 | 1.
export function fitLDA(X, y) {
  const mu = [0, 1].map((c) => { const pts = X.filter((_, i) => y[i] === c); return [0, 1].map((j) => pts.reduce((s, p) => s + p[j], 0) / pts.length); });
  const n1 = y.filter(Boolean).length, n0 = y.length - n1;
  let a = 0, b = 0, d = 0;
  X.forEach((p, i) => { const m = mu[y[i]], u = p[0] - m[0], v = p[1] - m[1]; a += u * u; b += u * v; d += v * v; });
  const k = y.length - 2; a /= k; b /= k; d /= k;
  const det = a * d - b * b, inv = [d / det, -b / det, -b / det, a / det];
  const score = (p, m, prior) => {
    const s0 = inv[0] * m[0] + inv[1] * m[1], s1 = inv[2] * m[0] + inv[3] * m[1];
    return p[0] * s0 + p[1] * s1 - 0.5 * (m[0] * s0 + m[1] * s1) + Math.log(prior);
  };
  return (p) => (score(p, mu[1], n1 / y.length) > score(p, mu[0], n0 / y.length) ? 1 : 0);
}

// Brute-force kNN on 2 features (Euclidean). k is odd so votes never tie.
export function fitKNN(X, y, k) {
  return (p) => {
    const best = [];
    for (let i = 0; i < X.length; i++) {
      const dd = (X[i][0] - p[0]) ** 2 + (X[i][1] - p[1]) ** 2;
      if (best.length < k || dd < best[best.length - 1][0]) {
        best.push([dd, y[i]]); best.sort((u, v) => u[0] - v[0]); if (best.length > k) best.pop();
      }
    }
    return best.reduce((s, b) => s + b[1], 0) * 2 > k ? 1 : 0;
  };
}

export const accuracy = (predict, X, y) => X.reduce((s, p, i) => s + (predict(p) === y[i] ? 1 : 0), 0) / X.length;
