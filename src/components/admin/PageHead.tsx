// The heading of an admin screen: what this page is, one line on why, and the
// controls that belong to it on the right.
//
// The admin layout used to print one generic <h1> ("Panou de administrare") for
// every screen, so no page said what it was — you knew where you were only from
// the nav. Each page now names itself, and the actions that act on the WHOLE
// page (period, export, search) sit beside the title instead of floating above
// the content they govern.
export function PageHead({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Page-level controls, right-aligned on wide screens. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold tracking-tight text-mauve-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-mauve-400">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">{children}</div>
      )}
    </div>
  );
}
