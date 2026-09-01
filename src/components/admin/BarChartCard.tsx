"use client";

import type { SeriesBucket } from "@/lib/admin-analytics";

// A bar chart with no charting library.
//
// The project has no chart dependency and this needs one shape: vertical bars,
// a few y ticks, a sparse x axis. Pulling in a library for that would cost more
// kilobytes than the whole admin bundle, so it is plain SVG — which also means
// it inherits the page's colours and scales with the container for free.

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  // Round the top of the axis up to something a person would choose: 1, 2, 5,
  // 10, 20, 50 … Otherwise the labels read 0 / 1.37 / 2.74.
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

export function BarChartCard({
  title,
  total,
  buckets,
  pick,
  color,
  footer,
}: {
  title: string;
  /** Already formatted — the caller knows whether this is money or a count. */
  total: string;
  buckets: SeriesBucket[];
  pick: (b: SeriesBucket) => number;
  color: string;
  footer?: React.ReactNode;
}) {
  const values = buckets.map(pick);
  const max = Math.max(0, ...values);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;

  // Label every Nth bar: 24 hourly labels overlap on a phone, and a chart whose
  // axis is unreadable is decoration.
  const every = buckets.length > 12 ? Math.ceil(buckets.length / 4) : 1;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-base font-bold text-mauve-900">{title}</h3>
        <span className="font-display text-2xl font-bold leading-none tabular-nums text-mauve-900 sm:text-3xl">
          {total}
        </span>
      </div>

      <div className="mt-5 flex gap-3">
        {/* Y axis, drawn top-down so the largest tick sits at the top. */}
        <div className="flex w-8 shrink-0 flex-col justify-between py-0.5 text-right text-[11px] tabular-nums text-mauve-400">
          {[...ticks].reverse().map((t) => (
            <span key={t}>{t >= 1000 ? `${Math.round(t / 1000)}k` : t}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-40">
            {/* Gridlines behind the bars, one per tick. */}
            <div className="absolute inset-0 flex flex-col justify-between">
              {ticks.map((t) => (
                <span key={t} className="h-px w-full bg-mauve-100" />
              ))}
            </div>

            <div className="relative flex h-full items-end gap-[3px]">
              {buckets.map((b, i) => {
                const v = pick(b);
                const pct = top > 0 ? (v / top) * 100 : 0;
                return (
                  <div key={b.label + i} className="group relative flex-1" style={{ height: "100%" }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t-[3px] transition-all"
                      style={{
                        height: `${pct}%`,
                        background: color,
                        // A zero bar still shows a hairline: "nothing happened
                        // at 04:00" and "no data" must not look the same.
                        minHeight: v > 0 ? 2 : 1,
                        opacity: v > 0 ? 1 : 0.18,
                      }}
                    />
                    <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-mauve-900 px-2 py-1 text-[11px] font-semibold text-white group-hover:block">
                      {b.label} · {v}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex gap-[3px]">
            {buckets.map((b, i) => (
              <span
                key={b.label + i}
                className="flex-1 text-center text-[10px] tabular-nums text-mauve-400"
              >
                {i % every === 0 ? b.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      {footer}
    </div>
  );
}
