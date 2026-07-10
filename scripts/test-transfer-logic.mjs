// Exhaustive test of the TransferForm computation logic (mirrors
// src/components/admin/MembersExplorer.tsx exactly). Deterministic: "today" is
// injected per case instead of new Date().

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// Exact port of the component's derived values.
function compute({ sessionsPerMonth = 10, unlimited = false, day, month, year, months, used = 0, today }) {
  const dd = parseInt(day, 10);
  const mm = parseInt(month, 10);
  const yy = parseInt(year, 10);
  const validStart =
    dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 2015 && yy <= 2100 && months >= 1;
  const startDate = validStart ? new Date(yy, mm - 1, dd) : null;
  const expiry = startDate
    ? (() => {
        const e = new Date(startDate);
        e.setMonth(e.getMonth() + months);
        return e;
      })()
    : null;
  const completedMonths = startDate
    ? (() => {
        const t = today;
        const elapsed =
          (t.getFullYear() - startDate.getFullYear()) * 12 + (t.getMonth() - startDate.getMonth());
        return Math.min(Math.max(elapsed, 0), months - 1);
      })()
    : 0;
  const usedN = Math.max(0, Math.trunc(used) || 0);
  const effectiveSessions = unlimited
    ? 999
    : Math.max(0, sessionsPerMonth * (months - completedMonths) - usedN);
  const expiresOn = expiry ? ymd(expiry) : "";
  const midnight = (() => {
    const t2 = new Date(today);
    t2.setHours(0, 0, 0, 0);
    return t2.getTime();
  })();
  const daysRemaining = expiry ? Math.ceil((expiry.getTime() - midnight) / 86400000) : null;
  const hasBalance = unlimited || effectiveSessions > 0;
  const canSubmit = !!expiry && daysRemaining !== null && daysRemaining > 0 && hasBalance;
  return { validStart, completedMonths, effectiveSessions, expiresOn, daysRemaining, canSubmit };
}

const T = (y, m, d) => new Date(y, m - 1, d); // helper for "today"
let pass = 0, fail = 0;
const rows = [];

function check(name, input, expect) {
  const r = compute(input);
  const got = {};
  const problems = [];
  for (const k of Object.keys(expect)) {
    got[k] = r[k];
    if (JSON.stringify(r[k]) !== JSON.stringify(expect[k])) {
      problems.push(`${k}: expected ${JSON.stringify(expect[k])}, got ${JSON.stringify(r[k])}`);
    }
  }
  if (problems.length) { fail++; rows.push(["FAIL", name, problems.join(" | ")]); }
  else { pass++; rows.push(["ok", name, `sess=${r.effectiveSessions} exp=${r.expiresOn} days=${r.daysRemaining} submit=${r.canSubmit}`]); }
}

// ── 1-month plans ──────────────────────────────────────────────────────────
check("1mo fresh 10/mo, used 0", { months: 1, day: "10", month: "07", year: "2026", used: 0, today: T(2026, 7, 10) },
  { effectiveSessions: 10, completedMonths: 0, expiresOn: "2026-08-10", canSubmit: true });
check("1mo used 3", { months: 1, day: "10", month: "07", year: "2026", used: 3, today: T(2026, 7, 10) },
  { effectiveSessions: 7, canSubmit: true });
check("1mo used equals all -> 0, submit BLOCKED", { months: 1, sessionsPerMonth: 10, day: "10", month: "07", year: "2026", used: 10, today: T(2026, 7, 10) },
  { effectiveSessions: 0, canSubmit: false });
check("1mo used MORE than all -> clamp 0, submit BLOCKED", { months: 1, sessionsPerMonth: 10, day: "10", month: "07", year: "2026", used: 15, today: T(2026, 7, 10) },
  { effectiveSessions: 0, canSubmit: false });
check("unlimited with 0-ish inputs still submits", { months: 1, unlimited: true, sessionsPerMonth: 1, day: "10", month: "07", year: "2026", used: 999, today: T(2026, 7, 10) },
  { effectiveSessions: 999, canSubmit: true });

// ── 2-month plans (the user's key scenario) ────────────────────────────────
check("2mo fresh 10/mo", { months: 2, day: "10", month: "07", year: "2026", used: 0, today: T(2026, 7, 10) },
  { effectiveSessions: 20, completedMonths: 0, expiresOn: "2026-09-10", canSubmit: true });
check("2mo fresh, used 3", { months: 2, day: "10", month: "07", year: "2026", used: 3, today: T(2026, 7, 10) },
  { effectiveSessions: 17, canSubmit: true });
check("2mo started 1 month ago (1 month left)", { months: 2, day: "10", month: "06", year: "2026", used: 0, today: T(2026, 7, 10) },
  { effectiveSessions: 10, completedMonths: 1, expiresOn: "2026-08-10", canSubmit: true });
check("2mo started 1 month ago, used 3", { months: 2, day: "10", month: "06", year: "2026", used: 3, today: T(2026, 7, 10) },
  { effectiveSessions: 7, completedMonths: 1, canSubmit: true });
check("2mo started 2 months ago -> EXPIRED, cannot submit", { months: 2, day: "10", month: "05", year: "2026", used: 0, today: T(2026, 7, 10) },
  { completedMonths: 1, expiresOn: "2026-07-10", daysRemaining: 0, canSubmit: false });

// ── 6 & 12 month ───────────────────────────────────────────────────────────
check("6mo fresh 10/mo", { months: 6, day: "01", month: "07", year: "2026", used: 0, today: T(2026, 7, 1) },
  { effectiveSessions: 60, completedMonths: 0, expiresOn: "2027-01-01", canSubmit: true });
check("6mo started 3 months ago", { months: 6, day: "01", month: "04", year: "2026", used: 0, today: T(2026, 7, 1) },
  { effectiveSessions: 30, completedMonths: 3, canSubmit: true });
check("12mo fresh 8/mo", { months: 12, sessionsPerMonth: 8, day: "01", month: "07", year: "2026", used: 0, today: T(2026, 7, 1) },
  { effectiveSessions: 96, completedMonths: 0, expiresOn: "2027-07-01", canSubmit: true });

// ── Unlimited ──────────────────────────────────────────────────────────────
check("unlimited 1mo -> 999", { months: 1, unlimited: true, day: "10", month: "07", year: "2026", used: 0, today: T(2026, 7, 10) },
  { effectiveSessions: 999, canSubmit: true });
check("unlimited ignores used", { months: 3, unlimited: true, day: "10", month: "07", year: "2026", used: 50, today: T(2026, 7, 10) },
  { effectiveSessions: 999, canSubmit: true });

// ── Validation / edge dates ────────────────────────────────────────────────
check("invalid day 32 -> no submit", { months: 1, day: "32", month: "07", year: "2026", today: T(2026, 7, 10) },
  { validStart: false, canSubmit: false, expiresOn: "" });
check("invalid month 13 -> no submit", { months: 1, day: "10", month: "13", year: "2026", today: T(2026, 7, 10) },
  { validStart: false, canSubmit: false });
check("year too old 2014 -> no submit", { months: 1, day: "10", month: "07", year: "2014", today: T(2026, 7, 10) },
  { validStart: false, canSubmit: false });
check("expiry == today -> daysRemaining 0 -> no submit", { months: 1, day: "10", month: "06", year: "2026", today: T(2026, 7, 10) },
  { daysRemaining: 0, canSubmit: false });
check("future start (starts next month)", { months: 1, day: "10", month: "08", year: "2026", today: T(2026, 7, 10) },
  { completedMonths: 0, effectiveSessions: 10, canSubmit: true });

// ── Month-length rollover behaviour (documented) ───────────────────────────
check("Jan 31 + 1mo -> JS rolls to Mar 3 (2026)", { months: 1, day: "31", month: "01", year: "2026", today: T(2026, 1, 31) },
  { expiresOn: "2026-03-03" });
check("Jan 31 + 1mo leap 2028 -> Mar 2", { months: 1, day: "31", month: "01", year: "2028", today: T(2028, 1, 31) },
  { expiresOn: "2028-03-02" });

console.log("SCEN".padEnd(6), "RESULT".padEnd(46), "DETAIL");
for (const [status, name, detail] of rows) {
  console.log((status === "FAIL" ? "✗ " : "✓ ").padEnd(6), name.padEnd(46), detail);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
