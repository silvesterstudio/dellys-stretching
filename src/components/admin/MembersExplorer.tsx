"use client";

import { useEffect, useState, useTransition } from "react";
import { TIMEZONE, type Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localized } from "@/lib/i18n-data";
import { formatDate, formatTime, formatPrice } from "@/lib/format";
import {
  searchMembersAction,
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
  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const [amount, setAmount] = useState<string>(String(plans[0]?.price ?? ""));
  const [method, setMethod] = useState("cash");
  const [searching, startSearch] = useTransition();
  const [loadingDetail, startDetail] = useTransition();
  const [busy, startAction] = useTransition();
  // Every membership write used to discard its ActionResult, so a refusal
  // (USER_NOT_FOUND, PLAN_INACTIVE, ASSIGN_FAILED…) looked exactly like a
  // success: spinner stops, nothing changes. Surface the code instead.
  const [err, setErr] = useState<string | null>(null);
  // Creating an account at the desk. Deliberately email-free — see
  // createMemberAction: the built-in mailer allows 2 messages an hour for the
  // whole project, so registering people through /register stalls after two.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [justCreated, setJustCreated] = useState(false);

  function createMember(e: React.FormEvent) {
    e.preventDefault();
    startAction(async () => {
      setErr(null);
      const res = await createMemberAction({
        fullName: newName,
        email: newEmail,
        phone: newPhone || null,
      });
      if (res.error || !res.userId) {
        setErr(res.error === "EMAIL_TAKEN" ? m.errEmailTaken : (res.error ?? "CREATE_FAILED"));
        return;
      }
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setCreating(false);
      setJustCreated(true);
      setResults(await searchMembersAction(""));
      setSelectedId(res.userId);
      setDetail(await getMemberDetailAction(res.userId));
    });
  }

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => setResults(await searchMembersAction(query)));
  }

  function open(id: string) {
    setSelectedId(id);
    setDetail(null);
    startDetail(async () => setDetail(await getMemberDetailAction(id)));
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
      const res = await assignMembershipAction(uid, planId, null, payment);
      if (res?.error) {
        setErr(res.error);
        return;
      }
      setDetail(await getMemberDetailAction(uid));
    });
  }

  function decide(requestId: string, approve: boolean) {
    if (!detail) return;
    const uid = detail.profile.id;
    startAction(async () => {
      setErr(null);
      const res = await decideMembershipRequestAction(requestId, approve);
      if (res?.error) {
        setErr(res.error);
        return;
      }
      setDetail(await getMemberDetailAction(uid));
    });
  }

  // Re-fetch the selected member after a membership-management action.
  function reload() {
    if (!detail) return;
    const uid = detail.profile.id;
    startAction(async () => setDetail(await getMemberDetailAction(uid)));
  }

  function toggleReception(makeReception: boolean) {
    if (!detail) return;
    const uid = detail.profile.id;
    startAction(async () => {
      setErr(null);
      const res = await setStaffRoleAction(uid, makeReception);
      if (res?.error) {
        setErr(res.error);
        return;
      }
      setDetail(await getMemberDetailAction(uid));
    });
  }

  const statusLabel = (map: Record<string, string>, key: string) =>
    (map as Record<string, string>)[key] ?? key;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      {/* ---- List ---- */}
      <div className="space-y-3">
        <div className="mb-3">
          {creating ? (
            <form onSubmit={createMember} className="card space-y-2 p-3.5">
              <div className="text-sm font-semibold text-mauve-800">{m.newMember}</div>
              <p className="text-xs text-mauve-400">{m.newMemberHint}</p>
              <input
                className="input w-full px-2 py-1.5 text-sm"
                placeholder={m.fullName}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
              <input
                className="input w-full px-2 py-1.5 text-sm"
                type="email"
                placeholder={m.email}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
              <input
                className="input w-full px-2 py-1.5 text-sm"
                placeholder={m.phone}
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="btn-primary flex-1 px-3 py-1.5 text-xs">
                  {m.createMember}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setErr(null);
                  }}
                  className="btn-secondary px-3 py-1.5 text-xs"
                >
                  {dict.common.cancel}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => {
                setCreating(true);
                setJustCreated(false);
              }}
              className="btn-secondary w-full px-3 py-2 text-xs"
            >
              + {m.newMember}
            </button>
          )}
        </div>

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
        <button onClick={() => setOpen((v) => !v)} className="btn-ghost px-3 py-1 text-xs">
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

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-mauve-100 pt-3">
        <button
          onClick={() => run(() => setMembershipFrozenAction(mem.id, !mem.frozen))}
          disabled={disabled}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          {mem.frozen ? m.unfreeze : m.freeze}
        </button>

        {/* Sessions: minus and plus, and the figure itself is typeable. Save
            only lights up once it differs from what is stored, so a stray tap
            cannot quietly write the same number back. */}
        <div className="inline-flex items-center gap-1">
          <span className="mr-1 text-xs text-mauve-400">{m.setSessions}</span>
          <button
            onClick={() => setSessions((n) => Math.max(0, n - 1))}
            disabled={disabled || sessions <= 0}
            className="btn-secondary h-8 w-8 px-0 py-0 text-base leading-none"
            aria-label="-1"
          >
            &minus;
          </button>
          <input
            type="number"
            min={0}
            value={sessions}
            onChange={(e) => setSessions(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
            className="input w-16 px-2 py-1.5 text-center text-sm tabular-nums"
            aria-label={m.setSessions}
          />
          <button
            onClick={() => setSessions((n) => n + 1)}
            disabled={disabled}
            className="btn-secondary h-8 w-8 px-0 py-0 text-base leading-none"
            aria-label="+1"
          >
            +
          </button>
          <button
            onClick={() => run(() => setMembershipSessionsAction(mem.id, sessions))}
            disabled={disabled || !sessionsDirty}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            {m.applySessions}
          </button>
        </div>

        {/* When it begins. A bundle dated forward cannot be spent until then. */}
        <div className="inline-flex items-center gap-1">
          <span className="mr-1 text-xs text-mauve-400">{m.startsOn}</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="input px-2 py-1.5 text-sm"
            aria-label={m.editStart}
          />
          <button
            onClick={() => run(() => updateMembershipStartAction(mem.id, start))}
            disabled={disabled || !start || start === toDateInput(mem.starts_at)}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            {dict.common.save}
          </button>
        </div>

        <div className="inline-flex items-center gap-1">
          <span className="mr-1 text-xs text-mauve-400">{m.expires}</span>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="input px-2 py-1.5 text-sm"
            aria-label={m.editExpiry}
          />
          <button
            onClick={() => run(() => updateMembershipExpiryAction(mem.id, expiry))}
            disabled={disabled || !expiry || expiry === toDateInput(mem.expires_at)}
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
  const dirty = notes !== (initial ?? "");

  async function save() {
    setSaving(true);
    setSaved(false);
    await updateMemberNotesAction(userId, notes);
    setSaving(false);
    setSaved(true);
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
        }}
      />
      <div className="flex items-center justify-end gap-2">
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
    const res = await transferMembershipAction(userId, {
      audience,
      sessionsRemaining: effectiveSessions,
      expiresOn,
      label: null,
      startedOn: startDate ? ymd(startDate) : null,
    });
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
