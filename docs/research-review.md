# Research review

A review of this repository against a doctoral-level research rubric, with engineering rigor for the
code. The repo is coursework, so the bar is applied to show where it stands, not to fault it for being
coursework. Every number below comes from the repo files; the dashboard and its build checks
(`site/src/queries.check.mjs`, `site/src/stats.check.mjs`) reproduce them.

**Overall grade: C+ before this review, B- after the cheap fixes below.** The SQL is correct and
readable and the notebook runs cleanly with seeds, but the model comparison has no baseline, no
ceiling, no uncertainty and a small leak, so it cannot support a ranking of the four models.

## Rubric

| Criterion | Grade | Notes |
| --- | --- | --- |
| Research question | C | Implicit: "which of LDA, QDA, kNN and Random Forest classifies this loan data best?" Never stated. The SQL part has no question; it is a set of exercise answers without the exercise statements. |
| Hypotheses | D | None stated. A natural one (a flexible model beats LDA) is not testable here because LDA is already at the ceiling. |
| Method | C+ | Seeded synthetic data (1,000 rows), 80/20 split, 5-fold CV, ROC, confusion matrices, decision-boundary plots for all 6 feature pairs. StandardScaler is fitted on all rows before the split and before `cross_val_score` (mild leakage), and the boundary plots refit every model on all 1,000 rows. |
| Baselines | F → B | The notebook has none. The dashboard now shows the majority-class rate on the test split, 129/200 = 0.645, read from the classification report's support counts. Random Forest's test accuracy (0.645) equals it. |
| Theoretical ceiling | F → A | Not in the notebook. The label is Bernoulli(p) with p a weighted sum of four threshold indicators on independent uniform integers, so the Bayes-optimal accuracy is E[max(p, 1 − p)] = 0.71873 (exact; positive rate 0.58253). Computed in closed form from the generator constants parsed from the notebook and confirmed by a 200,000-row simulation in the build check. LDA's 0.715 is at the ceiling. |
| Statistics and uncertainty | D → C+ | The notebook reports point estimates on one 200-row split and CV mean ± 2 sd. The dashboard adds Wilson 95% intervals (for example LDA 0.649 to 0.773, Random Forest 0.577 to 0.708): every pair overlaps. Paired tests are still missing (see gaps). |
| Reproducibility | C → B- | Seeds are fixed, but library versions are not pinned and there was no README. Added: README with run instructions, a build that parses the notebook outputs and the SQL files and fails if the known answers change. |
| Threats to validity | D → B | Now stated on the dashboard and here: small test split, scaler leakage, rankings that flip between CV and test, synthetic data with known structure, Oracle-specific SQL behaviour (NLS dates, SYSDATE, unordered results without ORDER BY). |
| Related work | N/A | Coursework; the methods are textbook (Hastie, Tibshirani and Friedman, *The Elements of Statistical Learning*, chapters 4 and 13, covers LDA, QDA and kNN). No novelty is claimed, so no literature review is expected. |
| Limitations | D → B | The notebook states none. Listed below and on the dashboard's review window. |
| Engineering rigor | C → B | No tests, no README, a one-cell notebook. Added: node known-answer checks for all 27 SQL equivalents and the statistics, run by `npm test` and before every build; CI build on GitHub Pages. |

## Fixed in this pass (no new experiments)

1. **Majority baseline** shown next to every recorded accuracy (0.645).
2. **Exact Bayes ceiling** (0.71873) with a live calculator that recomputes it when the rules change,
   and the per-pair ceiling in the playground (for example 0.704 for income and credit score alone).
3. **Wilson 95% intervals** for each recorded test accuracy, computed live from accuracy and n = 200.
4. **README** with what each file is, how to load `scott.sql` around its prose header, and the honest
   findings.
5. **Tests**: `site/src/queries.check.mjs` checks known Oracle results for the SQL answers (for example
   4.1 returns JONES, SCOTT, KING and FORD; 4.8 returns KING; 6.2 rounds WARD's 1,437.5 to 1,438;
   6.4's TO_CHAR pads day and month names). `site/src/stats.check.mjs` checks the ceiling, the parsed
   recorded results and the baseline.
6. **SQL gaps made visible**: the runner marks exercise 4.4 as not in the file and flags 4.3's NLS date
   dependence and the SYSDATE exercises.

## Remaining gaps and exactly what each needs

| Gap | What it needs |
| --- | --- |
| Scaler leakage | One CPU rerun of the notebook (seconds) with `StandardScaler` inside a scikit-learn `Pipeline`, for both the split and `cross_val_score`, writing results to `results/*.json`. |
| No paired comparison between models | The same rerun, saving per-row test predictions, then McNemar tests for each pair (6 tests, Holm-corrected). The notebook does not save predictions, so this cannot be done from the repo today. |
| Single small test split | The same rerun with repeated stratified CV (for example 10 × 5 folds) and the corrected resampled t-test, or simply a larger generated test set (the generator is free to sample). |
| No tuning or calibration | A small grid search in the same rerun (k for kNN, `reg_param` for QDA, depth and leaf size for the forest) and Brier scores, since ROC uses predicted probabilities. |
| Model choice not discussed | The label depends only on four threshold indicators, so a logistic regression on those indicators (or a depth-4 tree) should reach the ceiling. Worth one extra model in the rerun. |
| "Imbalanced classes" claim | The analytic positive rate is 0.58, which is mild. Either drop the claim from the docstring or test class weighting in the rerun. |
| Environment not pinned | A `requirements.txt` with the versions used for the saved outputs. Those versions are not recorded anywhere in the repo, so they would have to come from the original Colab session. |
| SQL exercise statements and expected outputs | The original exercise sheet for Lectures 2, 4 and 6; exercise 4.4 is missing from the answers. |
| Hygiene | Comment typo "decisionDeploy boundary", the "[Jesun Ushno]" placeholder brackets, and the setup prose (with the "logint" typo) at the top of `scott.sql`. Left as is in this pass to keep the original files unchanged; each is a one-line edit. |
