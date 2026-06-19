"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localized } from "@/lib/i18n-data";
import { formatDate } from "@/lib/format";
import { assignMembershipAction } from "@/app/[lang]/admin/actions";

type Plan = {
  id: string;
  name_ro: string;
  name_ru: string;
  audience: "adult" | "child";
  session_count: number;
  validity_days: number;
};
interface Member {
  id: string;
  email: string;
  full_name: string | null;
}
interface Mem {
  id: string;
  sessions_remaining: number;
  expires_at: string;
  plan: { name_ro: string; name_ru: string } | null;
}

export function MembersManager({
  lang,
  dict,
  plans,
}: {
  lang: Locale;
  dict: Dictionary;
  plans: Plan[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [mems, setMems] = useState<Mem[]>([]);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .ilike("email", `%${query.trim()}%`)
      .order("email")
      .limit(20);
    setBusy(false);
    setResults((data ?? []) as Member[]);
  }

  async function loadMember(m: Member) {
    setSelected(m);
    setMsg(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("user_memberships")
      .select(
        `id, sessions_remaining, expires_at, plan:membership_plans ( name_ro, name_ru )`,
      )
      .eq("user_id", m.id)
      .order("created_at", { ascending: false });
    setMems(
      (data ?? []).map((x: Record<string, unknown>) => ({
        id: x.id as string,
        sessions_remaining: x.sessions_remaining as number,
        expires_at: x.expires_at as string,
        plan: one(x.plan) as Mem["plan"],
      })),
    );
  }

  async function assign() {
    if (!selected || !planId) return;
    setBusy(true);
    setMsg(null);
    const { error } = await assignMembershipAction(selected.id, planId, null);
    setBusy(false);
    if (error) {
      setMsg(dict.common.error);
      return;
    }
    setMsg(dict.booking.success);
    await loadMember(selected);
  }

  const now = Date.now();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <form onSubmit={search} className="flex gap-2">
          <input
            className="input"
            placeholder={dict.admin.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={busy} className="btn-primary">
            {dict.common.confirm}
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-mauve-400">{dict.admin.noResults}</p>
          ) : (
            results.map((m) => (
              <button
                key={m.id}
                onClick={() => loadMember(m)}
                className={`card block w-full p-3 text-left hover:bg-mauve-50 ${
                  selected?.id === m.id ? "ring-2 ring-brand-300" : ""
                }`}
              >
                <div className="font-medium text-mauve-900">
                  {m.full_name || m.email}
                </div>
                {m.full_name && (
                  <div className="text-xs text-mauve-400">{m.email}</div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <div>
        {selected ? (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="font-semibold text-mauve-900">
                {selected.full_name || selected.email}
              </div>
              <div className="text-xs text-mauve-400">{selected.email}</div>
            </div>

            <div className="card p-4">
              <label className="label">{dict.admin.assignMembership}</label>
              <div className="flex gap-2">
                <select
                  className="input"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {localized(p, "name", lang)} ({dict.audience[p.audience]}) ·{" "}
                      {p.session_count}
                    </option>
                  ))}
                </select>
                <button onClick={assign} disabled={busy} className="btn-primary whitespace-nowrap">
                  {dict.admin.assign}
                </button>
              </div>
              {msg && <div className="mt-2 text-sm text-mauve-600">{msg}</div>}
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-mauve-700">
                {dict.admin.currentMemberships}
              </h3>
              {mems.length === 0 ? (
                <p className="text-sm text-mauve-400">{dict.dashboard.noMemberships}</p>
              ) : (
                <div className="space-y-2">
                  {mems.map((m) => {
                    const expired = new Date(m.expires_at).getTime() <= now;
                    return (
                      <div key={m.id} className="card flex items-center justify-between p-3 text-sm">
                        <span className="text-mauve-800">
                          {m.plan ? localized(m.plan, "name", lang) : "—"}
                        </span>
                        <span className={expired ? "text-red-500" : "text-brand-600"}>
                          {m.sessions_remaining} · {formatDate(m.expires_at, lang)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-mauve-400">{dict.admin.search}</p>
        )}
      </div>
    </div>
  );
}
