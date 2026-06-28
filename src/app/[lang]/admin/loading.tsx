// Suspense fallback for the admin section — keeps navigation between admin
// tabs instant instead of blocking on the section's data fetches.
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Se încarcă · Загрузка">
      <div className="h-7 w-44 rounded-2xl bg-mauve-100" />
      <div className="card space-y-3 p-5">
        <div className="h-4 w-1/3 rounded-full bg-mauve-100" />
        <div className="h-3 w-2/3 rounded-full bg-mauve-100/70" />
        <div className="h-9 w-32 rounded-full bg-brand-100/70" />
      </div>
      <div className="card space-y-3 p-5">
        <div className="h-4 w-1/4 rounded-full bg-mauve-100" />
        <div className="h-3 w-1/2 rounded-full bg-mauve-100/70" />
        <div className="h-3 w-2/5 rounded-full bg-mauve-100/70" />
      </div>
    </div>
  );
}
