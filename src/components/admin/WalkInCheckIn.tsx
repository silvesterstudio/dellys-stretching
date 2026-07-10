"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  searchMembersAction,
  getUsableMembershipsAction,
  walkInCheckInAction,
  type AdminMemberRow,
} from "@/app/[lang]/admin/actions";
import { checkInErrorMessage } from "@/lib/booking-errors";

// Roster add-on: find a member who didn't pre-book and attend them on the spot.
export function WalkInCheckIn({
  sessionId,
  audience,
  lang,
  dict,
}: {
  sessionId: string;
  audience: "adult" | "child";
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.admin.walkIn;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminMemberRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<AdminMemberRow | null>(null);
  const [memberships, setMemberships] = useState<{ id: string; label: string }[]>([]);
  const [membershipId, setMembershipId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [loadingMems, startMems] = useTransition();
  const [attending, startAttend] = useTransition();

  function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSearch(async () => {
      setResults(await searchMembersAction(query));
      setSearched(true);
    });
  }

  function pick(m: AdminMemberRow) {
    setSelected(m);
    setMembershipId("");
    startMems(async () => {
      const mems = await getUsableMembershipsAction(m.id, audience, lang);
      setMemberships(mems);
      setMembershipId(mems[0]?.id ?? "");
    });
  }

  function reset() {
    setSelected(null);
    setMemberships([]);
    setResults([]);
    setQuery("");
    setSearched(false);
    setOpen(false);
  }

  function attend() {
    if (!selected) return;
    setError(null);
    startAttend(async () => {
      const { error } = await walkInCheckInAction(sessionId, selected.id, membershipId || null);
      if (error) {
        setError(checkInErrorMessage(error, dict));
        return;
      }
      reset();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary w-full">
        + {t.open}
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-mauve-800">{t.title}</h3>
        <button
          onClick={() => { setOpen(false); setSelected(null); }}
          className="text-mauve-400 hover:text-mauve-700"
          aria-label={dict.common.cancel}
        >
          ✕
        </button>
      </div>

      {!selected ? (
        <>
          <form onSubmit={search} className="flex gap-2">
            <input
              className="input"
              placeholder={dict.admin.member.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" disabled={searching} className="btn-primary whitespace-nowrap">
              {dict.admin.search.split(" ")[0]}
            </button>
          </form>
          {searched && results.length === 0 ? (
            <p className="text-sm text-mauve-400">{dict.admin.noResults}</p>
          ) : (
            <div className="space-y-1">
              {results.map((m) => (
                <button
                  key={m.id}
                  onClick={() => pick(m)}
                  className="card card-hover block w-full p-2.5 text-left"
                >
                  <div className="truncate text-sm font-medium text-mauve-900">
                    {m.full_name || m.email}
                  </div>
                  <div className="truncate text-xs text-mauve-400">
                    {m.phone || m.email}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg bg-sand-50 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-mauve-900">
                {selected.full_name || selected.email}
              </div>
              <div className="truncate text-xs text-mauve-400">{selected.phone || selected.email}</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="shrink-0 text-xs text-mauve-500 hover:text-mauve-800"
            >
              {dict.common.back}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input max-w-52 py-1.5 text-sm"
              value={membershipId}
              onChange={(e) => setMembershipId(e.target.value)}
              disabled={loadingMems}
            >
              <option value="">{dict.admin.noMembershipDeduct}</option>
              {memberships.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button onClick={attend} disabled={attending} className="btn-primary py-1.5 text-sm">
              {dict.admin.markAttended}
            </button>
          </div>
          {error && <div className="text-xs text-red-700">{error}</div>}
        </>
      )}
    </div>
  );
}
