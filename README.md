# Database coursework: Oracle SQL on SCOTT and a loan classifier

Live dashboard: https://jesunahmadushno.github.io/Database/

Two pieces of database and data-mining coursework.

| File | What it is |
| --- | --- |
| `scott.sql` | The classic Oracle SCOTT schema: DEPT (4 rows), EMP (14), BONUS (empty) and SALGRADE (5). |
| `all_queries.sql` | 27 SQL exercise answers from Lectures 2, 4 and 6 (Lecture 4 has no exercise 4). |
| `decision_boundaries_analysis_feature_pairs.ipynb` | LDA, QDA, kNN and Random Forest compared on a seeded synthetic loan-approval dataset, with saved outputs and 9 figures. |
| `site/` | The dashboard. It parses the three files above at build time and runs the SQL answers and the statistics live in the browser. |
| `docs/research-review.md` | A graded review of the work and its remaining gaps. |

## Running the SQL

`scott.sql` starts with a few lines of setup prose (create the `scott` user, then log in as it). Run the
`CREATE USER` and `GRANT` statements as a privileged user, log in as `scott`, then run everything from
`CREATE TABLE DEPT` down to `COMMIT`. The prose lines themselves are not SQL and will error if pasted.

Exercise 4.3 compares a DATE to the string `'20-FEB-1981'`, so it depends on the session
`NLS_DATE_FORMAT`; `TO_DATE('20-FEB-1981', 'DD-MON-YYYY')` is the portable form. Exercises 6.1 and 6.5
use `SYSDATE`, so their output changes with the date.

## Rerunning the notebook

Open it in Colab (badge in the notebook) or locally with numpy, pandas, scikit-learn, matplotlib and
seaborn. It uses `np.random.seed(42)` and `random_state=42`, so a rerun on the same library versions
should reproduce the saved outputs. Versions are not pinned in this repo.

## What the results do and do not show

- Best test accuracy: LDA 0.715. Best ROC AUC: QDA 0.769.
- Always predicting "approved" scores 0.645 on the same 200-row test split (129 of 200). Random Forest's
  0.645 equals that baseline.
- The data generator makes the label a coin flip with a probability set by four threshold rules, so no
  model can exceed about 0.719 accuracy (exact value 0.71873, computed in `site/src/stats.js` and checked
  by simulation). LDA is already within noise of that ceiling.
- With 200 test rows, a 95% interval on accuracy is roughly plus or minus 0.065, so the four models
  cannot be ranked from this split. The cross-validation ranking (Random Forest first) disagrees with
  the test ranking (Random Forest last).

See `docs/research-review.md` for the full list of limitations and what each would need.

## Building the dashboard

```bash
cd site
npm ci
npm test        # known-answer checks for the SQL equivalents and the statistics
npm run build   # runs the checks, then builds site/dist
```

The GitHub Pages workflow in `.github/workflows/pages.yml` runs the same build on pushes to `master`.
