import { TIMEZONE } from "@/lib/constants";

// Timezone-correct week math, pinned to Europe/Bucharest. Avoids DST bugs by
// resolving wall-clock times to UTC instants using the zone's actual offset.

interface WallParts {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  s: number;
}

function partsInTz(date: Date, tz: string): WallParts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  // Intl can emit hour "24" at midnight; normalize to 0.
  return {
    y: p.year,
    m: p.month,
    d: p.day,
    h: p.hour === 24 ? 0 : p.hour,
    min: p.minute,
    s: p.second,
  };
}

function tzOffsetMs(date: Date, tz: string): number {
  const w = partsInTz(date, tz);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s);
  return asUtc - date.getTime();
}

// The UTC instant corresponding to a given wall-clock time in `tz`.
function zonedWallToUtc(
  y: number,
  m: number,
  d: number,
  h: number,
  tz: string,
): Date {
  const guess = Date.UTC(y, m - 1, d, h, 0, 0);
  const offset = tzOffsetMs(new Date(guess), tz);
  return new Date(guess - offset);
}

// Convert a Bucharest wall-clock date+time to the corresponding UTC instant.
// dateStr "YYYY-MM-DD", timeStr "HH:MM". Used by admin session creation.
export function bucharestWallToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min, 0);
  const offset = tzOffsetMs(new Date(guess), TIMEZONE);
  return new Date(guess - offset);
}

export interface WeekRange {
  start: Date; // Monday 00:00 Bucharest, as a UTC instant
  end: Date; // next Monday 00:00 Bucharest
  days: Date[]; // 7 instants: Mon..Sun at 00:00 Bucharest
}

// offsetWeeks: 0 = current week, 1 = next, -1 = previous.
export function getWeekRange(offsetWeeks: number, now: Date = new Date()): WeekRange {
  const today = partsInTz(now, TIMEZONE);
  // JS weekday (0=Sun..6=Sat) of "today" in Bucharest.
  const jsDow = new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay();
  // Days back to Monday (treat Sunday as 7).
  const backToMon = (jsDow === 0 ? 7 : jsDow) - 1;

  const todayMidnight = zonedWallToUtc(today.y, today.m, today.d, 0, TIMEZONE);
  // Shift to the correct Monday accounting for offset weeks.
  const mondayStart = new Date(
    todayMidnight.getTime() - backToMon * 86400000 + offsetWeeks * 7 * 86400000,
  );
  // Re-resolve to a clean Bucharest midnight (handles DST shift within the week).
  const mp = partsInTz(mondayStart, TIMEZONE);
  const start = zonedWallToUtc(mp.y, mp.m, mp.d, 0, TIMEZONE);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const dayGuess = new Date(start.getTime() + i * 86400000);
    const dp = partsInTz(dayGuess, TIMEZONE);
    days.push(zonedWallToUtc(dp.y, dp.m, dp.d, 0, TIMEZONE));
  }
  const endGuess = new Date(start.getTime() + 7 * 86400000);
  const ep = partsInTz(endGuess, TIMEZONE);
  const end = zonedWallToUtc(ep.y, ep.m, ep.d, 0, TIMEZONE);

  return { start, end, days };
}

// "YYYY-MM-DD" of an instant in Bucharest — stable key for grouping by day.
export function dayKey(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const p = partsInTz(date, TIMEZONE);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}
