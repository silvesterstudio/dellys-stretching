import type { Dictionary } from "@/i18n/get-dictionary";

// The two rules that govern a seat, wherever a seat is taken: on the member's
// confirm screen and inside the guest pop-up. Written once so the schedule, the
// confirm screen and the pop-up can never drift into quoting different hours —
// and kept to two short lines, because a rule nobody reads is not a rule.
//
// These numbers are enforced by the database (migration 0037). This is the
// notice, not the gate.
export function BookingRules({ dict }: { dict: Dictionary }) {
  const b = dict.booking;
  return (
    <div className="rounded-xl border border-mauve-200 bg-sand-50 px-3.5 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-mauve-500">
        {b.rulesTitle}
      </div>
      <ul className="mt-1.5 space-y-1">
        {[b.ruleBook, b.ruleCancel].map((line) => (
          <li key={line} className="flex gap-2 text-sm leading-snug text-mauve-700">
            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
