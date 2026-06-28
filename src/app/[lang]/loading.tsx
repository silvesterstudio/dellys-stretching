// Instant navigation feedback (Suspense fallback for every route under [lang]
// that lacks its own). Kept route-agnostic — a centered heading + a few neutral
// cards — so it reads as "loading" on the schedule, memberships, dashboard and
// the auth pages alike, rather than flashing a schedule-shaped grid everywhere.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-7" aria-busy="true" aria-label="Se încarcă · Загрузка">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-8 w-56 max-w-[70%] rounded-2xl bg-mauve-100" />
        <div className="mx-auto h-3 w-40 max-w-[50%] rounded-full bg-mauve-100/70" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="h-4 w-1/3 rounded-full bg-mauve-100" />
            <div className="mt-3 h-3 w-2/3 rounded-full bg-mauve-100/70" />
            <div className="mt-2 h-3 w-1/2 rounded-full bg-mauve-100/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
