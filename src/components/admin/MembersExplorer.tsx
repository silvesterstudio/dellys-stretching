"use client";

import { useEffect, useState, useTransition } from "react";
import type { MemberStatus } from "@/lib/member-status";
import { TIMEZONE, type Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localized } from "@/lib/i18n-data";
import { formatDate, formatTime, formatPrice } from "@/lib/format";
import {
  listMembersAction,
  createMemberAction,
  getMemberDetailAction,
  assignMembershipAction,
  transferMembershipAction,
  updateMemberNotesAction,
  setStaffRoleAction,
  decideMembershipRequestAction,
  setMembershipFrozenAction,
  setMembershipSessionsAction,
  updateMembershipStartAction,
  updateMembershipExpiryAction,
  deleteMembershipAction,
  type AdminMemberRow,
  type AdminMemberDetail,
  type MemberListRow,
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
  price: number;
  currency: string;
};

const BOOKING_BADGE: Record<string, string> = {
  attended: "badge-success",
  booked: "badge-brand",
  pending: "badge-warning",
  no_show: "badge-muted",
  cancelled: "badge-muted",
};
const REQUEST_BADGE: Record<string, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-muted",
  cancelled: "badge-muted",
};

export function MembersExplorer({
  lang,
  dict,
  plans,
  initialMembers,
  counts,
}: {
  lang: Locale;
  dict: Dictionary;
  plans: Plan[];
  initialMembers: MemberListRow[];
  counts: Record<MemberStatus | "all", number>;
}) {
  const m = dict.admin.member;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberListRow[]>(initialMembers);
  // Filtering happens here rather than on the server: the whole roster is
  // already loaded, so switching tabs is instant and the counts beside each
  // label always match what the list shows.
  const [filter, setFilter] = useState<MemberStatus | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminMemberDetail | null>(null);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const [amount, setAmount] = useState<string>(String(plans[0]?.price ?? ""));
  const [method, setMethod] = useState("cash");
  const [loadingDetail, startDetail] = useTransition();
  const [busy, startAction] = useTransition();
  // Every membership write used to discard its ActionResult, so a refusal
  // (USER_NOT_FOUND, PLAN_INACTIVE, ASSIGN_FAILED…) looked exactly like a
  // success: spinner stops, nothing changes. Surface the code instead.
  const [err, setErr] = useState<string | null>(null);
  // Set when loading the member sheet itself fails, so the sheet can say so
  // instead of standing there shimmering.
  const [detailErr, setDetailErr] = useState(false);
  // Creating an account at the desk. Deliberately email-free — see
  // createMemberAction: the built-in mailer allows 2 messages an hour for the
  // whole project, so registering people through /register stalls after two.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [justCreated, setJustCreated] = useState(false);

  // A server action that throws — a staff session that expired mid-shift, a
  // dropped connection — used to take the whole screen down with it: the
  // rejection escaped the transition and React fell through to the error
  // boundary, so clicking a member replaced the admin with "something went
  // wrong". Every call below goes through this instead.
  async function guard<T>(work: () => Promise<T>): Promise<T | null> {
    try {
      return await work();
    } catch {
      setErr("CONNECTION");
      return null;
    }
  }

  function createMember(e: React.FormEvent) {
    e.preventDefault();
    startAction(async () => {
      setErr(null);
      const res = await guard(() =>
        createMemberAction({
          fullName: newName,
          email: newEmail,
          phone: newPhone || null,
        }),
      );
      if (!res) return;
      if (res.error || !res.userId) {
        setErr(res.error === "EMAIL_TAKEN" ? m.errEmailTaken : (res.error ?? "CREATE_FAILED"));
        return;
      }
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setCreating(false);
      setJustCreated(true);
      setResults((await guard(() => listMembersAction())) ?? []);
      setSelectedId(res.userId);
      setDetail(await guard(() => getMemberDetailAction(res.userId!)));
    });
  }

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    // Kept for the Enter key; the list already filters as you type.
    setQ(query);
  }

  const visible = results.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    const needle = (q || query).trim().toLowerCase();
    if (!needle) return true;
    return (
      (r.full_name ?? "").toLowerCase().includes(needle) ||
      r.email.toLowerCase().includes(needle) ||
      (r.phone ?? "").toLowerCase().includes(needle)
    );
  });

  const selected = results.find((r) => r.id === selectedId) ?? null;

  const FILTERS: { key: MemberStatus | "all"; label: string }[] = [
    { key: "all", label: m.filterAll },
    { key: "active", label: m.statusActive },
    { key: "pending", label: m.statusPending },
    { key: "frozen", label: m.statusFrozen },
    { key: "inactive", label: m.statusInactive },
  ];

  function open(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailErr(false);
    setErr(null);
    startDetail(async () => {
      try {
        setDetail(await getMemberDetailAction(id));
      } catch {
        setDetailErr(true);
      }
    });
  }

  function selectPlan(id: string) {
    setPlanId(id);
    const p = plans.find((pl) => pl.id === id);
    if (p) setAmount(String(p.price)); // prefill with list price; admin can edit
  }

  function activate() {
    if (!detail || !planId) return;
    const uid = detail.profile.id;
    const parsed = parseFloat(amount);
    const payment = {
      amount: amount.trim() !== "" && Number.isFinite(parsed) ? parsed : null,
      method,
    };
    startAction(async () => {
      setErr(null);
      const res = await guard(() => assignMembershipAction(uid, planId, null, payment));
      if (!res) return;
      if (res?.error) {
        setErr(res.error);
        return;
      }
      const both = await guard(() =>
        Promise.all([getMemberDetailAction(uid), listMembersAction()]),
      );
      if (!both) return;
      setDetail(both[0]);
      setResults(both[1]);
    });
  }

  function decide(requestId: string, approve: boolean) {
    if (!detail) return;
    const uid = detail.profile.id;
    startAction(async () => {
      setErr(null);
      const res = await guard(() => decideMembershipRequestAction(requestId, approve));
      if (!res) return;
      if (res?.error) {
        setErr(res.error);
        return;
      }
      const both = await guard(() =>
        Promise.all([getMemberDetailAction(uid), listMembersAction()]),
      );
      if (!both) return;
      setDetail(both[0]);
      setResults(both[1]);
    });
  }

  // Re-fetch the selected member after a membership-management action, and the
  // roster with it: freezing or topping up a bundle changes the badge in the
  // list, and a list that disagrees with the sheet that changed it is worse
  // than a slightly slower save.
  function reload() {
    if (!detail) return;
    const uid = detail.profile.id;
    startAction(async () => {
      const both = await guard(() =>
        Promise.all([getMemberDetailAction(uid), listMembersAction()]),
      );
      if (!both) return;
      setDetail(both[0]);
      setResults(both[1]);
    });
  }

  function toggleReception(makeReception: boolean) {
    if (!detail) return;
    const uid = detail.profile.id;
    startAction(async () => {
      setErr(null);
      const res = await guard(() => setStaffRoleAction(uid, makeReception));
      if (!res) return;
      if (res?.error) {
        setErr(res.error);
        return;
      }
      setDetail(await guard(() => getMemberDetailAction(uid)));
    });
  }

  // Escape closes the sheet, and the page behind it stops scrolling while it
  // is open — a modal you can scroll away from loses the member you opened.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [selectedId]);

  const statusLabel = (map: Record<string, string>, key: string) =>
    (map as Record<string, string>)[key] ?? key;

  return (
    <div className="space-y-4">
      {/* Toolbar: what this list is, and the two things you do to it. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
            aria-haspopup="menu"
            className="seg-item seg-item-on border border-mauve-200/70"
          >
            <span aria-hidden>&#9776;</span>
            {FILTERS.find((f) => f.key === filter)?.label ?? m.filterAll}
            <span className="ml-1 tabular-nums text-mauve-400">{counts[filter] ?? 0}</span>
            <span aria-hidden className="ml-0.5 text-mauve-400">
              &#9662;
            </span>
          </button>
          {filterOpen && (
            <>
              {/* Click-away. A menu that only closes via its own button strands
                  people who tapped elsewhere expecting it to shut. */}
              <button
                aria-hidden
                tabIndex={-1}
                onClick={() => setFilterOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="menu-panel" role="menu">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    role="menuitem"
                    onClick={() => {
                      setFilter(f.key);
                      setFilterOpen(false);
                    }}
                    className={`menu-item ${f.key === filter ? "bg-brand-50 text-brand-700" : ""}`}
                  >
                    <span>{f.label}</span>
                    <span className="tabular-nums text-mauve-400">{counts[f.key] ?? 0}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* On a phone the search drops to its own line: sharing one row with the
            filter and the new-member button squeezed it down to the width of the
            word "Search". */}
        <form
          onSubmit={runSearch}
          className="order-last flex w-full min-w-0 gap-2 sm:order-none sm:ml-auto sm:w-auto sm:max-w-sm sm:flex-1"
        >
          <input
            className="input h-11 w-full min-w-0"
            placeholder={m.searchLabel}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setQ(e.target.value);
            }}
            aria-label={m.searchLabel}
          />
        </form>

        <button
          onClick={() => {
            setCreating((v) => !v);
            setJustCreated(false);
          }}
          className="btn-secondary h-11 px-4 text-sm"
        >
          + {m.newMember}
        </button>
      </div>

      {creating && (
        <form onSubmit={createMember} className="panel space-y-2 p-4">
          <div className="text-sm font-semibold text-mauve-800">{m.newMember}</div>
          <p className="text-xs text-mauve-400">{m.newMemberHint}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="input h-11 w-full px-3 text-base"
              placeholder={m.fullName}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <input
              className="input h-11 w-full px-3 text-base"
              type="email"
              placeholder={m.email}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <input
              className="input h-11 w-full px-3 text-base"
              placeholder={m.phone}
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary h-11 px-5 text-sm">
              {m.createMember}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setErr(null);
              }}
              className="btn-secondary h-11 px-4 text-sm"
            >
              {dict.common.cancel}
            </button>
          </div>
          {/* A refused registration used to fail silently here: the only place
              errors were shown was the sheet, which is not open while you are
              typing a new member in. */}
          {err && (
            <p className="text-xs font-semibold text-red-600" role="alert">
              {err === "CONNECTION" ? m.saveFailed : err}
            </p>
          )}
        </form>
      )}

      {/* One full-width list. The old two-column layout gave the roster a 22rem
          gutter and the detail a permanent half of the screen even when nothing
          was selected; the detail is a modal now, so the list gets the room. */}
      <div className="panel divide-y divide-mauve-100">
        {visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-mauve-400">{m.noMatches}</p>
        ) : (
          visible.map((r) => (
            <button key={r.id} onClick={() => open(r.id)} className="list-row hover:bg-mauve-50">
              <span className="avatar" aria-hidden>
                {(r.full_name || r.email || "?").trim().charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-mauve-900">
                  {r.full_name || r.email}
                </span>
                <span className="block truncate text-xs text-mauve-400">
                  {/* The name is the row's title, so the email only
                      repeats underneath when it is not already the title. */}
                  {[r.full_name ? r.email : null, r.phone].filter(Boolean).join(" \u00b7 ") ||
                    m.noPhone}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {r.expiresAt && (
                  <span className="hidden text-xs tabular-nums text-mauve-400 sm:inline">
                    {formatDate(r.expiresAt, lang)}
                  </span>
                )}
                <StatusBadge row={r} m={m} />
              </span>
            </button>
          ))
        )}
      </div>

      {/* ---- Detail, in a modal ---- */}
      {selectedId && (
        <div
          className="modal-scrim"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <div className="modal-panel">
            {/* Sticky header: the sheet is long, and scrolling to the bottom of
                a member's history used to mean scrolling back up to leave. */}
            <div className="sticky top-0 z-10 flex items-center gap-3 rounded-t-2xl border-b border-mauve-100 bg-white/95 px-5 py-3.5 backdrop-blur">
              <span className="avatar" aria-hidden>
                {(selected?.full_name || selected?.email || "?").trim().charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg font-bold text-mauve-900">
                  {selected?.full_name || selected?.email || m.memberDetail}
                </span>
                {selected && (
                  <span className="block truncate text-xs text-mauve-400">{selected.email}</span>
                )}
              </span>
              {selected && <StatusBadge row={selected} m={m} />}
              <button
                onClick={() => setSelectedId(null)}
                aria-label={dict.common.close}
                className="btn-secondary h-9 w-9 shrink-0 px-0 py-0 text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-5 sm:p-6">
              {detailErr ? (
                <div className="card space-y-3 p-6 text-center">
                  <p className="text-sm font-semibold text-mauve-800">{m.loadFailed}</p>
                  <button onClick={() => selectedId && open(selectedId)} className="btn-secondary">
                    {m.retry}
                  </button>
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
                        <div className="space-y-0.5 text-sm text-mauve-500">
                          <div>{detail.profile.phone || m.noPhone}</div>
                          <div className="text-xs text-mauve-400">
                            {m.joined} {formatDate(detail.profile.created_at, lang)} ·{" "}
                            {detail.profile.preferred_lang.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      {detail.profile.role === "admin" ? (
                        <span className="badge-brand">{m.adminRole}</span>
                      ) : detail.profile.role === "reception" ? (
                        <span className="badge-brand">{m.receptionRole}</span>
                      ) : null}
                    </div>

                    {/* The door credential. An account made at the desk never gets an
                        email, so this is how the member leaves with something that
                        works at the tablet. */}
                    {detail.profile.qr_uuid && (
                      <MemberQrPanel
                        token={detail.profile.qr_uuid}
                        label={m.memberQr}
                        showLabel={m.showQr}
                        hideLabel={m.hideQr}
                        highlight={justCreated}
                        note={justCreated ? m.createdNoEmail : null}
                      />
                    )}

                    {/* Reception (front-desk staff) toggle — never shown for admins. */}
                    {detail.profile.role !== "admin" && (
                      <div className="mt-4 flex items-center justify-between border-t border-mauve-100 pt-3">
                        <div className="text-xs text-mauve-500">{m.receptionHint}</div>
                        {detail.profile.role === "reception" ? (
                          <button
                            onClick={() => toggleReception(false)}
                            disabled={busy}
                            className="btn-ghost-danger px-3 py-1.5 text-xs"
                          >
                            {m.removeReception}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              // Grants desk access AND changes how this person is
                              // listed — worth one confirmation before clicking.
                              if (window.confirm(m.receptionHint)) toggleReception(true);
                            }}
                            disabled={busy}
                            className="btn-secondary px-3 py-1.5 text-xs"
                          >
                            {m.makeReception}
                          </button>
                        )}
                      </div>
                    )}

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

                  {/* Activate membership (sell a plan + record payment) */}
                  <div className="card space-y-3 p-4">
                    <div>
                      <label className="label">{m.activate}</label>
                      <select
                        className="input"
                        value={planId}
                        onChange={(e) => selectPlan(e.target.value)}
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {localized(p, "name", lang)} ({dict.audience[p.audience]}) · {p.session_count}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label">{m.amountPaid}</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="input"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                          <span className="text-xs text-mauve-400">{selectedPlan?.currency ?? "MDL"}</span>
                        </div>
                      </div>
                      <div>
                        <label className="label">{m.paymentMethod}</label>
                        <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                          <option value="cash">{m.payCash}</option>
                          <option value="card">{m.payCard}</option>
                          <option value="transfer">{m.payTransfer}</option>
                          <option value="free">{m.payFree}</option>
                        </select>
                      </div>
                    </div>
                    <button onClick={activate} disabled={busy} className="btn-primary w-full">
                      {dict.admin.assign}
                    </button>
                    {err && (
                      <p className="mt-2 text-xs font-semibold text-red-600" role="alert">
                        {dict.common.error} ({err})
                      </p>
                    )}
                  </div>

                  {/* Transfer an existing (offline) membership */}
                  <TransferForm
                    userId={detail.profile.id}
                    lang={lang}
                    dict={dict}
                    busy={busy}
                    onDone={reload}
                  />

                  {/* Staff notes */}
                  <NotesCard
                    key={detail.profile.id}
                    userId={detail.profile.id}
                    initial={detail.profile.notes}
                    dict={dict}
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
                              <span className={REQUEST_BADGE[r.status] ?? "badge-muted"}>
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
                            <span className={`shrink-0 ${BOOKING_BADGE[b.status] ?? "badge-muted"}`}>
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
        </div>
      )}
    </div>
  );
}

// The one-word state of a member, on the row and in the sheet header. Active
// carries the sessions left, because that is the number reception is asked for.
const STATUS_BADGE: Record<MemberStatus, string> = {
  active: "badge-success",
  frozen: "badge bg-sky-100 text-sky-700",
  pending: "badge-warning",
  inactive: "badge-muted",
};

function StatusBadge({
  row,
  m,
}: {
  row: MemberListRow;
  m: Dictionary["admin"]["member"];
}) {
  const label: Record<MemberStatus, string> = {
    active: m.badgeActive,
    frozen: m.badgeFrozen,
    pending: m.badgePending,
    inactive: m.badgeInactive,
  };
  return (
    <span className={`${STATUS_BADGE[row.status]} shrink-0 whitespace-nowrap`}>
      {label[row.status]}
      {row.status === "active" && row.sessionsRemaining !== null
        ? ` \u00b7 ${row.sessionsRemaining} ${m.sessionsShort}`
        : ""}
    </span>
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

// The member's door credential, rendered on demand.
//
// Collapsed by default: this is a bearer token — whoever shows it gets checked
// in — so it should not sit open on a screen at a front desk all day. It is
// drawn in the browser from the raw uuid, so the image is never stored or
// served, and it opens by itself right after an account is created, which is
// the one moment somebody is standing there waiting for it.
function MemberQrPanel({
  token,
  label,
  showLabel,
  hideLabel,
  highlight,
  note,
}: {
  token: string;
  label: string;
  showLabel: string;
  hideLabel: string;
  highlight: boolean;
  note: string | null;
}) {
  const [open, setOpen] = useState(highlight);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    setOpen(highlight);
  }, [highlight, token]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const QRCode = (await import("qrcode")).default;
      // High error correction: this gets photographed off a monitor at an angle.
      const url = await QRCode.toDataURL(token, {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 512,
        color: { dark: "#16151b", light: "#ffffff" },
      });
      if (!cancelled) setSrc(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  return (
    <div className={`mt-4 rounded-2xl border p-3 ${highlight ? "border-brand-300 bg-brand-50" : "border-mauve-100"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-mauve-600">{label}</span>
        <button onClick={() => setOpen((v) => !v)} className="btn-ghost h-11 shrink-0 px-4 text-xs">
          {open ? hideLabel : showLabel}
        </button>
      </div>
      {note && <p className="mt-1 text-xs font-medium text-brand-700">{note}</p>}
      {open && (
        <div className="mt-3 flex justify-center">
          {src ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={src} alt={label} className="h-44 w-44 rounded-xl bg-white p-2" />
          ) : (
            <div className="h-44 w-44 animate-pulse rounded-xl bg-mauve-100" />
          )}
        </div>
      )}
    </div>
  );
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
  // The editable figure is the TOTAL left, not a delta: the desk thinks "she
  // should have 8", and a wrong total is visible before saving where a wrong
  // delta is not.
  const [sessions, setSessions] = useState(mem.sessions_remaining);
  const [start, setStart] = useState(toDateInput(mem.starts_at));
  const [expiry, setExpiry] = useState(toDateInput(mem.expires_at));
  const [working, setWorking] = useState(false);
  const expired = new Date(mem.expires_at).getTime() <= Date.now();
  const notStarted = new Date(mem.starts_at).getTime() > Date.now();
  const usable = !expired && !notStarted && mem.sessions_remaining > 0 && !mem.frozen;
  const disabled = busy || working;
  const sessionsDirty = sessions !== mem.sessions_remaining;

  // Re-sync when the row is refetched, or the inputs keep a stale figure after
  // somebody else changes it.
  useEffect(() => {
    setSessions(mem.sessions_remaining);
    setStart(toDateInput(mem.starts_at));
    setExpiry(toDateInput(mem.expires_at));
  }, [mem.sessions_remaining, mem.starts_at, mem.expires_at]);

  async function run(fn: () => Promise<unknown>) {
    setWorking(true);
    try {
      await fn();
    } finally {
      // Without this the row stayed disabled for good on a failed call, and
      // the rejection took the whole admin down with it.
      setWorking(false);
    }
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
          {notStarted ? (
            <div className="text-xs font-medium text-amber-600">
              {m.notStarted} {formatDate(mem.starts_at, lang)}
            </div>
          ) : (
            <div className={`text-xs ${expired ? "text-red-500" : "text-mauve-400"}`}>
              {expired ? m.expired : m.active} · {formatDate(mem.expires_at, lang)}
            </div>
          )}
        </div>
      </div>

      {/* The admin runs this from a phone. These used to be ten controls
          wrapping through one flex row on a 375px screen, several of them under
          30px tall. Each job now gets its own full-width row with a label, and
          nothing is smaller than a thumb. */}
      <div className="mt-3 space-y-2 border-t border-mauve-100 pt-3">
        {/* Sessions left: minus, the figure, plus — then Save, which only
            lights up once the number differs from what is stored. */}
        <div>
          <div className="mb-1 text-xs font-medium text-mauve-500">{m.setSessions}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSessions((n) => Math.max(0, n - 1))}
              disabled={disabled || sessions <= 0}
              className="btn-secondary h-11 w-12 shrink-0 px-0 py-0 text-lg leading-none"
              aria-label="-1"
            >
              &minus;
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={sessions}
              onChange={(e) => setSessions(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
              className="input h-11 w-full min-w-0 px-2 text-center text-base tabular-nums"
              aria-label={m.setSessions}
            />
            <button
              onClick={() => setSessions((n) => n + 1)}
              disabled={disabled}
              className="btn-secondary h-11 w-12 shrink-0 px-0 py-0 text-lg leading-none"
              aria-label="+1"
            >
              +
            </button>
            <button
              onClick={() => run(() => setMembershipSessionsAction(mem.id, sessions))}
              disabled={disabled || !sessionsDirty}
              className="btn-primary h-11 shrink-0 px-4 text-xs"
            >
              {m.applySessions}
            </button>
          </div>
        </div>

        {/* When it begins — a bundle dated forward cannot be spent until then. */}
        <div>
          <div className="mb-1 text-xs font-medium text-mauve-500">{m.startsOn}</div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="input h-11 w-full min-w-0 px-2 text-base"
              aria-label={m.editStart}
            />
            <button
              onClick={() => run(() => updateMembershipStartAction(mem.id, start))}
              disabled={disabled || !start || start === toDateInput(mem.starts_at)}
              className="btn-primary h-11 shrink-0 px-4 text-xs"
            >
              {dict.common.save}
            </button>
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-mauve-500">{m.expires}</div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="input h-11 w-full min-w-0 px-2 text-base"
              aria-label={m.editExpiry}
            />
            <button
              onClick={() => run(() => updateMembershipExpiryAction(mem.id, expiry))}
              disabled={disabled || !expiry || expiry === toDateInput(mem.expires_at)}
              className="btn-primary h-11 shrink-0 px-4 text-xs"
            >
              {dict.common.save}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => run(() => setMembershipFrozenAction(mem.id, !mem.frozen))}
            disabled={disabled}
            className="btn-secondary h-11 flex-1 px-3 text-xs"
          >
            {mem.frozen ? m.unfreeze : m.freeze}
          </button>
          <button
            onClick={() => {
              if (window.confirm(m.deleteConfirm)) run(() => deleteMembershipAction(mem.id));
            }}
            disabled={disabled}
            className="btn-ghost-danger h-11 shrink-0 px-4 text-xs"
          >
            {dict.admin.delete}
          </button>
        </div>
      </div>
    </div>
  );
}

// Free-text staff notes on a member.
function NotesCard({
  userId,
  initial,
  dict,
}: {
  userId: string;
  initial: string | null;
  dict: Dictionary;
}) {
  const m = dict.admin.member;
  const [notes, setNotes] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const dirty = notes !== (initial ?? "");

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await updateMemberNotesAction(userId, notes);
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card space-y-2 p-4">
      <label className="label">{m.notes}</label>
      <textarea
        className="input min-h-[72px] resize-y"
        placeholder={m.notesPlaceholder}
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
          setFailed(false);
        }}
      />
      <div className="flex items-center justify-end gap-2">
        {failed && (
          <span className="text-xs font-semibold text-red-600" role="alert">
            {m.saveFailed}
          </span>
        )}
        {saved && !dirty && <span className="text-xs text-green-600">{dict.common.save} ✓</span>}
        <button onClick={save} disabled={saving || !dirty} className="btn-secondary text-sm">
          {saving ? "…" : dict.common.save}
        </button>
      </div>
    </div>
  );
}

// Transfer an existing offline membership onto this member: enter the remaining
// sessions + a start date (DD/MM/YYYY) + a duration in months, and it computes
// the expiry, then activates the membership.
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
  const [day, setDay] = useState("01");
  const [month, setMonth] = useState("01");
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [months, setMonths] = useState(1);
  const [used, setUsed] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // Build the start date from the DD / MM / YYYY boxes; expiry = start + months.
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
  // Impuls month model: `sessions` is the monthly frequency, so the plan is
  // worth sessions × months loaded upfront. Full calendar months already
  // elapsed since the start date are dropped (their sessions are gone), and
  // whatever was used in the current month is subtracted too.
  const completedMonths = startDate
    ? (() => {
        const today = new Date();
        let elapsed =
          (today.getFullYear() - startDate.getFullYear()) * 12 +
          (today.getMonth() - startDate.getMonth());
        // A month isn't fully elapsed until its day-of-month is reached, so a
        // start of Jun 30 viewed on Jul 1 is 0 completed months, not 1.
        if (today.getDate() < startDate.getDate()) elapsed -= 1;
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
  // A 0-session (non-unlimited) transfer would create an unusable membership;
  // block it so the admin fixes the sessions / used inputs first.
  const hasBalance = unlimited || effectiveSessions > 0;
  const canSubmit =
    !!expiry && daysRemaining !== null && daysRemaining > 0 && hasBalance && !working && !busy;

  async function submit() {
    if (!canSubmit) return;
    setWorking(true);
    setErr(null);
    let res: { error: string | null } | null = null;
    try {
      res = await transferMembershipAction(userId, {
        audience,
        sessionsRemaining: effectiveSessions,
        expiresOn,
        label: null,
        startedOn: startDate ? ymd(startDate) : null,
      });
    } catch {
      res = { error: "CONNECTION" };
    }
    setWorking(false);
    // A refusal used to close the form and reset the inputs exactly like a
    // success, so the balance was silently never transferred. Keep the form
    // open with what was typed so it can be retried.
    if (res?.error) {
      setErr(res.error);
      return;
    }
    // Reset for the next entry.
    setSessions(10);
    setUnlimited(false);
    setDay("01");
    setMonth("01");
    setMonths(1);
    setUsed(0);
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

      {/* Start date (DD / MM / YYYY) */}
      <div>
        <label className="label">{t.startDate}</label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-mauve-400">{t.day}</label>
            <input
              type="number"
              min={1}
              max={31}
              placeholder="01"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="input text-center"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-mauve-400">{t.month}</label>
            <input
              type="number"
              min={1}
              max={12}
              placeholder="01"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="input text-center"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-mauve-400">{t.year}</label>
            <input
              type="number"
              min={2015}
              max={2100}
              placeholder="2026"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="input text-center"
            />
          </div>
        </div>
      </div>

      {/* Duration (custom months) */}
      <div>
        <label className="label">{t.duration}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={months}
            onChange={(e) => setMonths(Math.max(1, parseInt(e.target.value) || 1))}
            className="input w-24 text-center"
          />
          <span className="text-sm text-mauve-500">{t.monthsUnit}</span>
        </div>
      </div>

      {/* Sessions already used this month (skipped when unlimited) */}
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
          {validStart && (
            <p className="mt-1.5 text-[11px] text-mauve-400">
              {sessions} × {months - completedMonths} {t.monthsUnit}
              {usedN > 0 ? ` − ${usedN}` : ""} ={" "}
              <span className="font-semibold text-brand-600">{effectiveSessions}</span>{" "}
              {t.remaining.toLowerCase()}
            </p>
          )}
        </div>
      )}

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

      {validStart && !!expiry && !hasBalance && (
        <p className="text-[11px] text-red-500">{t.zeroBalance}</p>
      )}
      <button onClick={submit} disabled={!canSubmit} className="btn-primary w-full">
        {working ? "…" : t.submit}
      </button>
      {err && (
        <p className="text-xs font-semibold text-red-600" role="alert">
          {dict.common.error} ({err})
        </p>
      )}
    </div>
  );
}
