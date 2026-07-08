"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import {
  importLegacyMembershipsAction,
  adminClaimLegacyAction,
  deleteLegacyAction,
  type ImportResult,
} from "@/app/[lang]/admin/transfers/actions";
import { searchMembersAction, type AdminMemberRow } from "@/app/[lang]/admin/actions";
import type { PendingLegacy, ClaimedLegacy } from "@/app/[lang]/admin/transfers/page";

export function LegacyTransfers({
  lang,
  dict,
  pending,
  claimed,
}: {
  lang: Locale;
  dict: Dictionary;
  pending: PendingLegacy[];
  claimed: ClaimedLegacy[];
}) {
  const t = dict.admin.transfers;
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [audience, setAudience] = useState<"adult" | "child">("adult");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, startImport] = useTransition();

  function runImport() {
    setResult(null);
    startImport(async () => {
      const r = await importLegacyMembershipsAction(raw, audience);
      setResult(r);
      if (r.inserted > 0 || r.linked > 0) {
        setRaw("");
        router.refresh();
      }
    });
  }

  const fatal =
    result?.errors.some((e) =>
      ["EMPTY", "NO_SERVICE_KEY", "INSERT_FAILED"].includes(e),
    ) ?? false;

  return (
    <div className="space-y-8">
      {/* ── Import ─────────────────────────────────────────────────────── */}
      <section className="card p-5">
        <h2 className="font-display text-lg font-semibold text-mauve-900">{t.title}</h2>
        <p className="mt-1 text-sm text-mauve-500">{t.hint}</p>
        <p className="mt-2 text-xs text-mauve-400">{t.formatHint}</p>

        <textarea
          className="input mt-4 h-40 font-mono text-[13px] leading-relaxed"
          placeholder={t.placeholder}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label">{t.defaultAudience}</span>
            <select
              className="input"
              value={audience}
              onChange={(e) => setAudience(e.target.value as "adult" | "child")}
            >
              <option value="adult">{t.adult}</option>
              <option value="child">{t.child}</option>
            </select>
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={importing || raw.trim().length === 0}
            onClick={runImport}
          >
            {importing ? t.importing : t.import}
          </button>
        </div>

        {result && (
          <div className="mt-4">
            {fatal ? (
              <div className="alert-error">{t.importError}</div>
            ) : (
              <div className="alert-success">
                {result.inserted} {t.resultInserted} · {result.linked}{" "}
                {t.resultLinked} · {result.skipped} {t.resultSkipped}
              </div>
            )}
            {result.errors.length > 0 && !fatal && (
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-red-600">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ── Pending ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-mauve-900">
          {t.pending}{" "}
          <span className="text-mauve-400">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-mauve-400">{t.none}</p>
        ) : (
          <div className="space-y-2">
            {pending.map((row) => (
              <PendingRow key={row.id} lang={lang} dict={dict} row={row} />
            ))}
          </div>
        )}
      </section>

      {/* ── Claimed ────────────────────────────────────────────────────── */}
      {claimed.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-mauve-900">
            {t.claimed} <span className="text-mauve-400">({claimed.length})</span>
          </h2>
          <div className="space-y-2">
            {claimed.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0 text-mauve-600">
                  <span className="font-medium text-mauve-800">
                    {row.full_name || "—"}
                  </span>{" "}
                  · {row.sessions_remaining} {t.sessions} · {t.expires}{" "}
                  {formatDate(row.expires_at, lang)}
                </div>
                <div className="shrink-0 text-xs text-mauve-400">
                  {t.claimedBy} {row.claimed_to}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PendingRow({
  lang,
  dict,
  row,
}: {
  lang: Locale;
  dict: Dictionary;
  row: PendingLegacy;
}) {
  const t = dict.admin.transfers;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminMemberRow[]>([]);
  const [busy, startTransition] = useTransition();

  function search() {
    startTransition(async () => {
      setResults(await searchMembersAction(query));
    });
  }

  function assign(userId: string) {
    startTransition(async () => {
      const { error } = await adminClaimLegacyAction(row.id, userId);
      if (!error) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const { error } = await deleteLegacyAction(row.id);
      if (!error) router.refresh();
    });
  }

  const contact = row.phone || row.email || t.noPhone;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-mauve-900">
            {row.full_name || "—"}
            <span className="ml-2 text-xs font-normal text-mauve-400">{contact}</span>
          </div>
          <div className="mt-0.5 text-sm text-mauve-500">
            {row.sessions_remaining} {t.sessions} · {t.expires}{" "}
            {formatDate(row.expires_at, lang)}
            {row.plan_label ? ` · ${row.plan_label}` : ""}
            <span className="ml-2 badge badge-muted">
              {row.audience === "child" ? t.child : t.adult}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="btn-secondary py-1.5 text-sm"
            disabled={busy}
            onClick={() => setOpen((o) => !o)}
          >
            {t.assignTo}
          </button>
          <button
            type="button"
            className="btn-ghost-danger py-1.5 text-sm"
            disabled={busy}
            onClick={remove}
          >
            {t.delete}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 border-t border-mauve-100 pt-3">
          <div className="flex gap-2">
            <input
              className="input"
              placeholder={t.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search();
                }
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={search}
            >
              🔍
            </button>
          </div>
          {results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={busy}
                  onClick={() => assign(m.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-mauve-50"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-mauve-800">
                      {m.full_name || m.email}
                    </span>
                    <span className="ml-2 text-xs text-mauve-400">
                      {m.phone || m.email}
                    </span>
                  </span>
                  <span className="shrink-0 text-brand-600">{t.assign} →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
