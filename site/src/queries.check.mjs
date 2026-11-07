// Known-answer check for the SQL runner: node src/queries.check.mjs (runs inside npm test / npm run build).
// Expected rows are what Oracle returns for these statements on the SCOTT data in scott.sql.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseScott, parseQueries, fmtDate } from './parse.js';
import { QUERIES, roundDiv, addMonths, review, nextDay, monthsBetween, raise, grade } from './oracle.js';

const read = (f) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const db = parseScott(read('scott.sql'));
const qs = parseQueries(read('all_queries.sql'));

assert.equal(db.emp.length, 14); assert.equal(db.dept.length, 4); assert.equal(db.salgrade.length, 5);
assert.deepEqual(db.tables.map((t) => t.name), ['DEPT', 'EMP', 'BONUS', 'SALGRADE']);
assert.equal(fmtDate(db.emp.find((e) => e.ENAME === 'SCOTT').HIREDATE), '19-APR-87'); // 13-JUL-87 minus 85 days
assert.equal(fmtDate(db.emp.find((e) => e.ENAME === 'ADAMS').HIREDATE), '23-MAY-87'); // minus 51
assert.equal(qs.length, 27);
assert.deepEqual([2, 4, 6].map((l) => qs.filter((q) => q.lecture === l).length), [6, 11, 10]);
assert.ok(!qs.some((q) => q.id === '4.4'), 'exercise 4.4 is absent from the file');
assert.deepEqual(Object.keys(QUERIES).sort(), qs.map((q) => q.id).sort(), 'one JS equivalent per exercise');

const now = new Date(2026, 10, 7, 12, 0, 0);
const run = (id) => QUERIES[id](db, now);
for (const q of qs) for (const row of run(q.id)) assert.equal(row.length, q.cols.length, `${q.id} width`);
const col = (id, i = 0) => run(id).map((r) => r[i]);

assert.deepEqual(col('4.1').sort(), ['FORD', 'JONES', 'KING', 'SCOTT']);
assert.deepEqual(run('4.8'), [['KING', 'PRESIDENT']]);
assert.deepEqual(run('4.2'), [['JONES', 20]]);
assert.deepEqual(col('4.3'), ['ALLEN', 'WARD', 'JONES', 'BLAKE']);
assert.deepEqual(col('4.5'), ['ALLEN', 'BLAKE', 'CLARK', 'JAMES', 'KING', 'MARTIN', 'MILLER', 'TURNER', 'WARD']);
assert.deepEqual(col('4.6').sort(), ['ALLEN', 'BLAKE', 'CLARK', 'KING']);
assert.deepEqual(run('4.7'), [['MILLER', '23-JAN-82']]);
assert.deepEqual(col('4.9'), ['ALLEN', 'TURNER', 'MARTIN', 'WARD']);
assert.deepEqual(col('4.10'), ['BLAKE', 'CLARK', 'ADAMS']);
assert.deepEqual(col('4.11'), ['ALLEN', 'MILLER']);
assert.deepEqual(col('4.12'), ['SMITH', 'ADAMS', 'JAMES', 'MILLER']);
assert.deepEqual(col('2.2.1').sort(), ['CLERK', 'MANAGER', 'SALESMAN']);
assert.deepEqual(run('2.2.2'), [['CHICAGO']]);
assert.deepEqual(col('2.3.1'), ['ALLEN', 'WARD', 'MARTIN', 'TURNER']);
assert.deepEqual(col('2.3.2'), ['ALLEN', 'WARD', 'MARTIN', 'BLAKE', 'CLARK', 'ADAMS', 'JAMES']);
// 6.2: ROUND(1250 * 1.15) is 1438 in Oracle (exact decimal), not 1437 as naive float rounding gives.
assert.equal(roundDiv(1250 * 115, 100), 1438);
assert.deepEqual(run('6.3').find((r) => r[1] === 'WARD'), [7521, 'WARD', 1250, 1438, 188]);
assert.equal(review(nextDay(addMonths(db.emp[0].HIREDATE, 6), 'MONDAY')), 'Monday   , the Twenty-Second of June     , 1981.');
assert.equal(fmtDate(addMonths(Date.UTC(1981, 0, 31) / 86400000, 1)), '28-FEB-81'); // end-of-month rule
assert.equal(review(Date.UTC(1981, 10, 2) / 86400000), 'Monday   , the Second of November , 1981.');
assert.equal(Math.round(monthsBetween(now, db.emp.find((e) => e.ENAME === 'KING').HIREDATE)), 540);
assert.deepEqual(run('6.7'), [['Allen', 5], ['Jones', 5], ['Martin', 6], ['Adams', 5], ['James', 5], ['Miller', 6]]);
assert.equal(run('6.8.1').find((r) => r[0] === 'TURNER')[1], '0');
assert.equal(run('6.8.2').find((r) => r[0] === 'TURNER')[1], 'No Commission');
assert.equal(run('6.9')[0][0], `KING    ${'*'.repeat(50)}`);
assert.equal(run('6.6')[0][0], 'SMITH earns 800 monthly but wants 2400');
// Raise calculator at 15% matches exercise 6.2, and SALGRADE bands are read from the file.
assert.deepEqual(db.emp.map((e) => raise(e.SAL, 15)), run('6.2').map((r) => r[3]));
assert.deepEqual(db.emp.map((e) => grade(e.SAL, db.salgrade)), [1, 3, 2, 4, 2, 4, 4, 4, 5, 3, 1, 1, 4, 2]);
console.log('queries ok', { exercises: qs.length, emp: db.emp.length, dept: db.dept.length, salgrade: db.salgrade.length });
