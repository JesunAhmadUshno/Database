// Hand-written JS equivalents of the 27 answers in all_queries.sql, run over the rows parsed from
// scott.sql. The SQL text shown on the page is the file's own; these functions reproduce Oracle
// semantics (half-away-from-zero ROUND, padded TO_CHAR 'Day'/'Month', ADD_MONTHS end-of-month rule).
// Statements without ORDER BY return rows in insert order, which Oracle does not guarantee.
import { ymd, fmtDate } from './parse.js';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const ORD = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth'];
const cap = (s) => s[0] + s.slice(1).toLowerCase();

// ROUND(a / b) for integers, half away from zero, exact (avoids 1250 * 1.15 = 1437.4999...).
export const roundDiv = (a, b) => Math.sign(a) * Math.floor((Math.abs(a) * 2 + b) / (2 * b));
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dn = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000;
export function addMonths(day, n) {
  const [y, m, d] = ymd(day);
  const t = new Date(Date.UTC(y, m - 1 + n, 1)), ty = t.getUTCFullYear(), tm = t.getUTCMonth() + 1;
  return dn(ty, tm, d === daysIn(y, m) ? daysIn(ty, tm) : Math.min(d, daysIn(ty, tm)));
}
export const dow = (day) => new Date(day * 86400000).getUTCDay();
export const nextDay = (day, name) => { const want = DAYS.indexOf(name); return day + (((want - dow(day) + 7) % 7) || 7); };
export const ordinal = (d) => (d <= 20 ? ORD[d - 1] : d % 10 === 0 ? (d === 30 ? 'Thirtieth' : 'Twentieth') : `${d < 30 ? 'Twenty' : 'Thirty'}-${ORD[(d % 10) - 1]}`);
// TO_CHAR(day, 'Day, "the" Ddspth "of" Month, YYYY.'): Oracle pads Day and Month to their longest names (9).
export function review(day) {
  const [y, m, d] = ymd(day);
  return `${cap(DAYS[dow(day)]).padEnd(9)}, the ${ordinal(d)} of ${cap(MONTHS[m - 1]).padEnd(9)}, ${y}.`;
}
// MONTHS_BETWEEN(now, day) with now as a JS Date in the viewer's local time (standing in for SYSDATE).
export function monthsBetween(now, day) {
  const [y2, m2, d2] = ymd(day);
  const y1 = now.getFullYear(), m1 = now.getMonth() + 1, d1 = now.getDate();
  const whole = (y1 - y2) * 12 + (m1 - m2);
  if (d1 === d2 || (d1 === daysIn(y1, m1) && d2 === daysIn(y2, m2))) return whole;
  const frac = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  return whole + (d1 - d2 + frac) / 31;
}
export const like = (s, pat) => new RegExp(`^${pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, 's').test(s);
const by = (...keys) => (a, b) => { for (const [k, dir] of keys) { const x = a[k], y = b[k]; if (x !== y) return (x < y ? -1 : 1) * dir; } return 0; };
const today = (now) => dn(now.getFullYear(), now.getMonth() + 1, now.getDate());

// Each entry returns rows (arrays) in the column order of the SQL's AS "..." aliases.
export const QUERIES = {
  '2.1.1': ({ emp }) => emp.map((e) => [e.ENAME, e.DEPTNO]),
  '2.1.2': ({ dept }) => dept.map((d) => [d.DNAME]),
  '2.2.1': ({ emp }) => [...new Set(emp.filter((e) => e.DEPTNO === 30).map((e) => e.JOB))].map((j) => [j]),
  '2.2.2': ({ dept }) => dept.filter((d) => d.DEPTNO === 30).map((d) => [d.LOC]),
  '2.3.1': ({ emp }) => emp.filter((e) => e.COMM !== null).map((e) => [e.ENAME, e.DEPTNO]),
  '2.3.2': ({ emp }) => emp.filter((e) => like(e.ENAME, '%A%')).map((e) => [e.ENAME, e.DEPTNO]),
  '4.1': ({ emp }) => emp.filter((e) => e.SAL > 2850).map((e) => [e.ENAME, e.SAL]),
  '4.2': ({ emp }) => emp.filter((e) => e.EMPNO === 7566).map((e) => [e.ENAME, e.DEPTNO]),
  // The file compares a DATE to the string '20-FEB-1981'; Oracle converts it with the session's
  // NLS_DATE_FORMAT. Under the default DD-MON-RR that reads as 20 Feb 1981 and 1 May 1981.
  '4.3': ({ emp }) => emp.filter((e) => e.HIREDATE >= dn(1981, 2, 20) && e.HIREDATE <= dn(1981, 5, 1)).sort(by(['HIREDATE', 1])).map((e) => [e.ENAME, e.JOB, fmtDate(e.HIREDATE)]),
  '4.5': ({ emp }) => emp.filter((e) => e.DEPTNO === 10 || e.DEPTNO === 30).sort(by(['ENAME', 1])).map((e) => [e.ENAME, e.DEPTNO]),
  '4.6': ({ emp }) => emp.filter((e) => e.SAL > 1500 && (e.DEPTNO === 10 || e.DEPTNO === 30)).map((e) => [e.ENAME, e.SAL]),
  '4.7': ({ emp }) => emp.filter((e) => ymd(e.HIREDATE)[0] === 1982).map((e) => [e.ENAME, fmtDate(e.HIREDATE)]),
  '4.8': ({ emp }) => emp.filter((e) => e.MGR === null).map((e) => [e.ENAME, e.JOB]),
  '4.9': ({ emp }) => emp.filter((e) => e.COMM !== null).sort(by(['SAL', -1], ['COMM', -1])).map((e) => [e.ENAME, e.SAL, e.COMM]),
  '4.10': ({ emp }) => emp.filter((e) => like(e.ENAME, '__A%')).map((e) => [e.ENAME]),
  '4.11': ({ emp }) => emp.filter((e) => like(e.ENAME, '%L%L%') && (e.DEPTNO === 30 || e.MGR === 7782)).map((e) => [e.ENAME]),
  '4.12': ({ emp }) => emp.filter((e) => ['CLERK', 'ANALYST'].includes(e.JOB) && ![1000, 3000, 5000].includes(e.SAL)).map((e) => [e.ENAME, e.JOB, e.SAL]),
  '6.1': (_, now) => [[fmtDate(today(now))]],
  '6.2': ({ emp }) => emp.map((e) => [e.EMPNO, e.ENAME, e.SAL, roundDiv(e.SAL * 115, 100)]),
  '6.3': ({ emp }) => emp.map((e) => [e.EMPNO, e.ENAME, e.SAL, roundDiv(e.SAL * 115, 100), roundDiv(e.SAL * 115, 100) - e.SAL]),
  '6.4': ({ emp }) => emp.map((e) => [e.ENAME, fmtDate(e.HIREDATE), review(nextDay(addMonths(e.HIREDATE, 6), 'MONDAY'))]),
  '6.5': ({ emp }, now) => emp.map((e) => ({ n: e.ENAME, m: Math.round(monthsBetween(now, e.HIREDATE)) })).sort(by(['m', -1])).map((r) => [r.n, r.m]),
  '6.6': ({ emp }) => emp.map((e) => [`${e.ENAME} earns ${e.SAL} monthly but wants ${e.SAL * 3}`]),
  '6.7': ({ emp }) => emp.filter((e) => ['j', 'a', 'm'].includes(e.ENAME.toLowerCase()[0])).map((e) => [cap(e.ENAME), e.ENAME.length]),
  '6.8.1': ({ emp }) => emp.map((e) => [e.ENAME, e.COMM === null ? 'No Commission.' : String(e.COMM)]),
  '6.8.2': ({ emp }) => emp.map((e) => [e.ENAME, e.COMM === null ? 'No Commission.' : e.COMM === 0 ? 'No Commission' : String(e.COMM)]),
  '6.9': ({ emp }) => [...emp].sort(by(['SAL', -1])).map((e) => [`${e.ENAME}    ${'*'.repeat(roundDiv(e.SAL, 100))}`]),
};

// Exercises whose answer depends on the clock (SYSDATE).
export const USES_SYSDATE = new Set(['6.1', '6.5']);

// Raise calculator: ROUND(sal * (1 + pct/100)), pct a whole number, and its SALGRADE band.
export const raise = (sal, pct) => roundDiv(sal * (100 + pct), 100);
export const grade = (sal, salgrade) => salgrade.find((g) => sal >= g.LOSAL && sal <= g.HISAL)?.GRADE ?? null;
