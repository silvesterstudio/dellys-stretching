"use client";

import { useState, useTransition } from "react";
import { TIMEZONE, type Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localized } from "@/lib/i18n-data";
import { formatDate, formatTime, formatPrice } from "@/lib/format";
import {
  searchMembersAction,
  getMemberDetailAction,
  assignMembershipAction,
  transferMembershipAction,
  decideMembershipRequestAction,
  setMembershipFrozenAction,
  addMembershipSessionsAction,
  updateMembershipExpiryAction,
  deleteMembershipAction,
  type AdminMemberRow,
  type AdminMemberDetail,
} from "@/app/[lang]/admin/actions";

type MembershipDetail = AdminMemberDetail["memberships"][number];

// ISO instant -> "YYYY-MM-DD" in the studio timezone, for <input type="date">.
function toDateInput(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

// Local Date -> "YYYY-MM-DD" using its calendar fields (no timezone shift), for
// dates the admin builds from date-picker inputs in the transfer form.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

type Plan = {
  id: string;
  name_ro: string;
  name_ru: string;
  audience: "adult" | "child";
  session_count: number;
};

const BOOKING_BADGE: Record<string, string> = {
  attended: "bg-green-50 text-green-700",
  booked: "bg-brand-50 text-brand-700",
  pending: "bg-amber-50 text-amber-700",
  no_show: "bg-mauve-100 text-mauve-500",
  cancelled: "bg-mauve-100 text-mauve-400",
};
const REQUEST_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-mauve-100 text-mauve-400",
  cancelled: "bg-mauve-100 text-mauve-400",
};

export function MembersExplorer({
  lang,
  dict,
  plans,
  initialMembers,
}: {
  lang: Locale;
  dict: Dictionary;
  plans: Plan[];
  initialMembers: AdminMemberRow[];
}) {
  const m = dict.admin.member;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminMemberRow[]>(initialMembers);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminMemberDetail | null>(null);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [searching, startSearch] = useTransition();
  const [loadingDetail, startDetail] = useTransition();
  const [busy, startAction] = useTransition();

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => setResults(await searchMembersAction(query)));
  }

  function open(id: string) {
    setSelectedId(id);
    setDetail(null);
    startDetail(async () => setDetail(await getMemberDetailAction(id)));
  }

  function activate() {
    if (!detail || !planId) return;
    const uid = detail.profile.id;
    startAction(async () => {
      await assignMembershipAction(uid, planId, null);
      setDetail(await getMemberDetailAction(uid));
    });
  }

  function decide(requestId: string, approve: boolean) {
    if (!detail) return;
    const uid = detail.profile.id;
    startAction(async () => {
      await decideMembershipRequestAction(requestId, approve);
      setDetail(await getMemberDetailAction(uid));
    });
  }

  // Re-fetch the selected member after a membership-management action.
  function reload() {
    if (!detail) return;
    const uid = detail.profile.id;
    startAction(async () => setDetail(await getMemberDetailAction(uid)));
  }

  const statusLabel = (map: Record<string, string>, key: string) =>
    (map as Record<string, string>)[key] ?? key;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      {/* ---- List ---- */}
      <div className="space-y-3">
        <form onSubmit={runSearch} className="flex gap-2">
          <input
            className="input"
            placeholder={m.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={searching} className="btn-primary">
            {dict.admin.search.split(" ")[0]}
          </button>
        </form>

        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-mauve-400">{dict.admin.noResults}</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => open(r.id)}
                className={`card card-hover block w-full p-3 text-left ${
                  selectedId === r.id ? "ring-2 ring-brand-300" : ""
                }`}
              >
                <div className="truncate font-medium text-mauve-900">
                  {r.full_name || r.email}
                </div>
                <div className="truncate text-xs text-mauve-400">
                  {r.full_name ? r.email : m.noPhone}
                  {r.phone ? ` · ${r.phone}` : ""}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ---- Detail ---- */}
      <div>
        {!selectedId ? (
          <div className="card grid place-items-center p-12 text-center text-sm text-mauve-400">
            {m.select}
          </div>
        ) : loadingDetail || !detail ? (
          <div className="card animate-pulse space-y-3 p-6">
            <div className="h-6 w-1/2 rounded bg-mauve-100" />
            <div className="h-4 w-2/3 rounded bg-mauve-100" />
            <div className="h-20 w-full rounded bg-mauve-100" />
          </div>
        ) : (
          <div className={`space-y-5 ${busy ? "opacity-60" : ""}`}>
            {/* Profile header */}
            <div className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-xl font-bold text-mauve-900">
                    {detail.profile.full_name || detail.profile.email}
                  </h3>
                  <div className="mt-1 space-y-0.5 text-sm text-mauve-500">
                    <div className="truncate">{detail.profile.email}</div>
                    <div>{detail.profile.phone || m.noPhone}</div>
                    <div className="text-xs text-mauve-400">
                      {m.joined} {formatDate(detail.profile.created_at, lang)} ·{" "}
                      {detail.profile.preferred_lang.toUpperCase()}
                    </div>
                  </div>
                </div>
                {detail.profile.role === "admin" && (
                  <span className="badge bg-brand-50 text-brand-700">admin</span>
                )}
              </div>

              {/* Stats */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label={m.totalSpent}
                  value={formatPrice(detail.stats.totalSpent, detail.stats.currency, lang)}
                  accent
                />
                <Stat label={m.sessionsAttended} value={detail.stats.sessionsAttended} />
                <Stat label={m.activeMemberships} value={detail.stats.activeMemberships} />
                <Stat label={m.upcoming} value={detail.stats.upcoming} />
              </div>
            </div>

            {/* Activate membership */}
            <div className="card p-4">
              <label className="label">{m.activate}</label>
              <div className="flex flex-wrap gap-2">
                <select
                  className="input sm:max-w-xs"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {localized(p, "name", lang)} ({dict.audience[p.audience]}) · {p.session_count}
                    </option>
                  ))}
                </select>
                <button onClick={activate} disabled={busy} className="btn-primary whitespace-nowrap">
                  {dict.admin.assign}
                </button>
              </div>
            </div>

            {/* Transfer an existing (offline) membership */}
            <TransferForm
              userId={detail.profile.id}
              lang={lang}
              dict={dict}
              busy={busy}
              onDone={reload}
            />

            {/* Requests */}
            <Section title={m.requests}>
              {detail.requests.length === 0 ? (
                <Empty text={m.noRequests} />
              ) : (
                <div className="space-y-2">
                  {detail.requests.map((r) => (
                    <div
                      key={r.id}
                      className="card flex flex-wrap items-center justify-between gap-2 p-3"
                    >
                      <div className="text-sm">
                        <span className="font-medium text-mauve-800">
                          {r.plan ? localized(r.plan, "name", lang) : "—"}
                        </span>
                        <span className="ml-2 text-xs text-mauve-400">
                          {formatDate(r.created_at, lang)}
                        </span>
                      </div>
                      {r.status === "pending" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => decide(r.id, true)}
                            disabled={busy}
                            className="btn-primary px-3 py-1.5 text-xs"
                          >
                            ✓ {dict.admin.approve}
                          </button>
                          <button
                            onClick={() => decide(r.id, false)}
                            disabled={busy}
                            className="btn-secondary px-3 py-1.5 text-xs"
                          >
                            {dict.admin.reject}
                          </button>
                        </div>
                      ) : (
                        <span className={`badge ${REQUEST_BADGE[r.status] ?? ""}`}>
                          {statusLabel(dict.admin.requestStatus, r.status)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Memberships */}
            <Section title={m.memberships}>
              {detail.memberships.length === 0 ? (
                <Empty text={dict.dashboard.noMemberships} />
              ) : (
                <div className="space-y-2">
                  {detail.memberships.map((mem) => (
                    <MembershipRow
                      key={mem.id}
                      mem={mem}
                      lang={lang}
                      dict={dict}
                      busy={busy}
                      onChanged={reload}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Booking history */}
            <Section title={m.history}>
              {detail.bookings.length === 0 ? (
                <Empty text={m.noHistory} />
              ) : (
                <div className="space-y-1.5">
                  {detail.bookings.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-3 border-b border-mauve-100 py-2 last:border-0"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: b.session?.class_type?.color || "#cbc4ca" }}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-mauve-800">
                            {b.session?.class_type
                              ? localized(b.session.class_type, "name", lang)
                              : "—"}
                            {b.child_name && (
                              <span className="ml-1.5 text-xs text-mauve-400">· {b.child_name}</span>
                            )}
                          </div>
                          <div className="text-xs text-mauve-400">
                            {b.session
                              ? `${formatDate(b.session.starts_at, lang)} · ${formatTime(b.session.starts_at, lang)}`
                              : formatDate(b.created_at, lang)}
                          </div>
                        </div>
                      </div>
                      <span className={`badge shrink-0 ${BOOKING_BADGE[b.status] ?? ""}`}>
                        {statusLabel(dict.admin.bookingStatus, b.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Children */}
            {detail.children.length > 0 && (
              <Section title={m.children}>
                <div className="flex flex-wrap gap-2">
                  {detail.children.map((c) => (
                    <span key={c.id} className="badge bg-mauve-100 text-mauve-700">
                      {c.name}
                      {c.birth_year ? ` · ${c.birth_year}` : ""}
                    </span>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-sand-50 px-3 py-2.5">
      <div
        className={`font-display text-lg font-bold leading-tight ${
          accent ? "text-brand-600" : "text-mauve-900"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-medium text-mauve-500">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-mauve-700">{title}</h4>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-mauve-400">{text}</p>;
}

function MembershipRow({
  mem,
  lang,
  dict,
  busy,
  onChanged,
}: {
  mem: MembershipDetail;
  lang: Locale;
  dict: Dictionary;
  busy: boolean;
  onChanged: () => void;
}) {
  const m = dict.admin.member;
  const [delta, setDelta] = useState(1);
  const [expiry, setExpiry] = useState(toDateInput(mem.expires_at));
  const [working, setWorking] = useState(false);
  const expired = new Date(mem.expires_at).getTime() <= Date.now();
  const usable = !expired && mem.sessions_remaining > 0 && !mem.frozen;
  const disabled = busy || working;

  async function run(fn: () => Promise<unknown>) {
    setWorking(true);
    await fn();
    setWorking(false);
    onChanged();
  }

  return (
    <div className="card p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-mauve-800">
            {mem.plan ? localized(mem.plan, "name", lang) : "—"}
            {mem.frozen && (
              <span className="badge ml-2 bg-mauve-100 text-mauve-500">{m.frozen}</span>
            )}
          </div>
          <div className="text-xs text-mauve-400">
            {m.joined} {formatDate(mem.created_at, lang)}
          </div>
        </div>
        <div className="shrink-0 text-right text-sm">
          <div className={usable ? "font-semibold text-brand-600" : "text-mauve-400"}>
            {mem.sessions_remaining} {m.sessionsShort}
          </div>
          <div className={`text-xs ${expired ? "text-red-500" : "text-mauve-400"}`}>
            {expired ? m.expired : m.active} · {formatDate(mem.expires_at, lang)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-mauve-100 pt-3">
        <button
          onClick={() => run(() => setMembershipFrozenAction(mem.id, !mem.frozen))}
          disabled={disabled}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          {mem.frozen ? m.unfreeze : m.freeze}
        </button>

        <div className="inline-flex items-center gap-1">
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
            className="input w-16 px-2 py-1.5 text-sm"
            aria-label={m.addSessions}
          />
          <button
            onClick={() => run(() => addMembershipSessionsAction(mem.id, delta))}
            disabled={disabled || !delta}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            {m.addSessions}
          </button>
        </div>

        <div className="inline-flex items-center gap-1">
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="input px-2 py-1.5 text-sm"
            aria-label={m.editExpiry}
          />
          <button
            onClick={() => run(() => updateMembershipExpiryAction(mem.id, expiry))}
            disabled={disabled || !expiry}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            {dict.common.save}
          </button>
        </div>

        <button
          onClick={() => {
            if (window.confirm(m.deleteConfirm)) run(() => deleteMembershipAction(mem.id));
          }}
          disabled={disabled}
          className="btn-ghost-danger px-3 py-1.5 text-xs"
        >
          {dict.admin.delete}
        </button>
      </div>
    </div>
  );
}

const DURATIONS = [
  { months: 1, key: "month1" as const },
  { months: 6, key: "months6" as const },
  { months: 12, key: "months12" as const },
];

// Transfer an existing offline membership onto this member: enter sessions/month
// + start date + duration (+ how many were already used this month) and it
// computes the real remaining balance and expiry, then activates it.
function TransferForm({
  userId,
  lang,
  dict,
  busy,
  onDone,
}: {
  userId: string;
  lang: Locale;
  dict: Dictionary;
  busy: boolean;
  onDone: () => void;
}) {
  const t = dict.admin.member.transfer;
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<"adult" | "child">("adult");
  const [sessions, setSessions] = useState(10);
  const [unlimited, setUnlimited] = useState(false);
  const [start, setStart] = useState(""); // YYYY-MM-DD
  const [months, setMonths] = useState(1);
  const [used, setUsed] = useState(0);
  const [label, setLabel] = useState("");
  const [working, setWorking] = useState(false);

  // Month math (mirrors the Impuls custom-transfer flow).
  const startDate =
    start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? new Date(start + "T00:00:00") : null;
  const expiry = startDate
    ? (() => {
        const e = new Date(startDate);
        e.setMonth(e.getMonth() + months);
        return e;
      })()
    : null;
  // Full calendar months already elapsed since the start date (those months'
  // sessions are gone if the admin records the transfer mid-plan).
  const completedMonths = startDate
    ? (() => {
        const now = new Date();
        const elapsed =
          (now.getFullYear() - startDate.getFullYear()) * 12 +
          (now.getMonth() - startDate.getMonth());
        return Math.min(Math.max(elapsed, 0), months - 1);
      })()
    : 0;
  const usedN = Math.max(0, Math.trunc(used) || 0);
  const effectiveSessions = unlimited
    ? 999
    : Math.max(0, sessions * (months - completedMonths) - usedN);
  const expiresOn = expiry ? ymd(expiry) : "";
  const daysRemaining = expiry
    ? Math.ceil((expiry.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null;
  const canSubmit =
    !!expiry && daysRemaining !== null && daysRemaining > 0 && !working && !busy;

  async function submit() {
    if (!canSubmit) return;
    setWorking(true);
    await transferMembershipAction(userId, {
      audience,
      sessionsRemaining: effectiveSessions,
      expiresOn,
      label: label.trim() || null,
      startedOn: start || null,
    });
    setWorking(false);
    // Reset for the next entry.
    setSessions(10);
    setUnlimited(false);
    setStart("");
    setMonths(1);
    setUsed(0);
    setLabel("");
    setOpen(false);
    onDone();
  }

  const seg = (active: boolean) =>
    `flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
      active
        ? "border-brand-300 bg-brand-50 text-brand-700"
        : "border-mauve-200 bg-white text-mauve-500 hover:bg-sand-50"
    }`;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary w-full">
        + {t.open}
      </button>
    );
  }

  return (
    <div className="card space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-mauve-800">{t.title}</h4>
          <p className="mt-0.5 text-xs text-mauve-400">{t.subtitle}</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="shrink-0 text-mauve-400 hover:text-mauve-700"
          aria-label={dict.common.cancel}
        >
          ✕
        </button>
      </div>

      {/* Audience */}
      <div>
        <label className="label">{t.audience}</label>
        <div className="flex gap-2">
          <button onClick={() => setAudience("adult")} className={seg(audience === "adult")}>
            {t.adult}
          </button>
          <button onClick={() => setAudience("child")} className={seg(audience === "child")}>
            {t.child}
          </button>
        </div>
      </div>

      {/* Sessions per month + unlimited */}
      <div>
        <label className="label">{t.sessionsPerMonth}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={unlimited ? "" : sessions}
            disabled={unlimited}
            placeholder={unlimited ? "∞" : ""}
            onChange={(e) => setSessions(Math.max(1, parseInt(e.target.value) || 1))}
            className="input w-24 disabled:opacity-50"
          />
          <button
            onClick={() => setUnlimited((v) => !v)}
            className={seg(unlimited) + " max-w-[9rem]"}
          >
            ∞ {t.unlimited}
          </button>
        </div>
      </div>

      {/* Start date */}
      <div>
        <label className="label">{t.startDate}</label>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="input"
        />
      </div>

      {/* Duration */}
      <div>
        <label className="label">{t.duration}</label>
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <button key={d.months} onClick={() => setMonths(d.months)} className={seg(months === d.months)}>
              {t[d.key]}
            </button>
          ))}
        </div>
      </div>

      {/* Already used this month (skipped when unlimited) */}
      {!unlimited && (
        <div>
          <label className="label">{t.usedThisMonth}</label>
          <input
            type="number"
            min={0}
            value={used}
            onChange={(e) => setUsed(Math.max(0, parseInt(e.target.value) || 0))}
            className="input w-24"
          />
        </div>
      )}

      {/* Optional plan label */}
      <div>
        <label className="label">{t.label}</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t.labelPlaceholder}
          className="input"
        />
      </div>

      {/* Computed preview */}
      {expiry ? (
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-sand-50 p-3 text-center">
          <div>
            <div className="font-display text-lg font-bold text-brand-600">
              {unlimited ? "∞" : effectiveSessions}
            </div>
            <div className="text-[11px] font-medium text-mauve-500">{t.remaining}</div>
          </div>
          <div>
            <div className="font-display text-sm font-bold text-mauve-900">
              {formatDate(expiry.toISOString(), lang)}
            </div>
            <div className="text-[11px] font-medium text-mauve-500">{t.expiresOn}</div>
          </div>
          <div>
            <div
              className={`font-display text-lg font-bold ${
                daysRemaining !== null && daysRemaining <= 0
                  ? "text-red-500"
                  : "text-mauve-900"
              }`}
            >
              {daysRemaining !== null && daysRemaining <= 0 ? t.expired : daysRemaining}
            </div>
            <div className="text-[11px] font-medium text-mauve-500">{t.daysRemaining}</div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-mauve-400">{t.needStart}</p>
      )}

      <button onClick={submit} disabled={!canSubmit} className="btn-primary w-full">
        {working ? "…" : t.submit}
      </button>
    </div>
  );
}
