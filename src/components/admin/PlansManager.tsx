"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  upsertPlanAction,
  deletePlanAction,
  type PlanInput,
} from "@/app/[lang]/admin/actions";

export type AdminPlan = PlanInput & { id: string };

const blankPlan = (sort: number): PlanInput => ({
  audience: "adult",
  name_ro: "",
  name_ru: "",
  session_count: 8,
  price: 0,
  currency: "MDL",
  validity_days: 30,
  featured: false,
  active: true,
  sort_order: sort,
});

export function PlansManager({
  lang,
  dict,
  initial,
}: {
  lang: Locale;
  dict: Dictionary;
  initial: AdminPlan[];
}) {
  const [adding, setAdding] = useState(false);
  const nextSort = (initial.at(-1)?.sort_order ?? 0) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-mauve-900">
          {dict.admin.plansTitle}
        </h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-secondary text-sm">
            + {dict.admin.newPlan}
          </button>
        )}
      </div>

      {adding && (
        <PlanRow
          lang={lang}
          dict={dict}
          id={null}
          initialData={blankPlan(nextSort)}
          onDone={() => setAdding(false)}
        />
      )}

      <div className="space-y-3">
        {initial.map((p) => (
          <PlanRow key={p.id} lang={lang} dict={dict} id={p.id} initialData={p} />
        ))}
      </div>
    </div>
  );
}

function PlanRow({
  dict,
  id,
  initialData,
  onDone,
}: {
  lang: Locale;
  dict: Dictionary;
  id: string | null;
  initialData: PlanInput;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [d, setD] = useState<PlanInput>(initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof PlanInput>(k: K, v: PlanInput[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  async function save() {
    setBusy(true);
    setError(null);
    const { error } = await upsertPlanAction(id, d);
    setBusy(false);
    if (error) {
      setError(dict.common.error);
      return;
    }
    onDone?.();
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const { error } = await deletePlanAction(id!);
    setBusy(false);
    if (error) {
      setError(dict.common.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className={`card p-4 ${!d.active ? "opacity-60" : ""}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">{dict.admin.planNameRo}</span>
          <input
            className="input"
            value={d.name_ro}
            onChange={(e) => set("name_ro", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">{dict.admin.planNameRu}</span>
          <input
            className="input"
            value={d.name_ru}
            onChange={(e) => set("name_ru", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">{dict.audience.adult} / {dict.audience.child}</span>
          <select
            className="input"
            value={d.audience}
            onChange={(e) => set("audience", e.target.value as "adult" | "child")}
          >
            <option value="adult">{dict.audience.adult}</option>
            <option value="child">{dict.audience.child}</option>
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="label">{dict.memberships.sessions}</span>
            <input
              type="number"
              min={1}
              className="input"
              value={d.session_count}
              onChange={(e) => set("session_count", Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="label">{dict.admin.planPrice}</span>
            <input
              type="number"
              min={0}
              className="input"
              value={d.price}
              onChange={(e) => set("price", Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="label">{dict.memberships.validity}</span>
            <input
              type="number"
              min={1}
              className="input"
              value={d.validity_days}
              onChange={(e) => set("validity_days", Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-mauve-700">
          <input
            type="checkbox"
            checked={d.featured}
            onChange={(e) => set("featured", e.target.checked)}
          />
          ★ {dict.memberships.featured}
        </label>
        <label className="flex items-center gap-2 text-sm text-mauve-700">
          <input
            type="checkbox"
            checked={d.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          {dict.admin.active}
        </label>
        <label className="flex items-center gap-2 text-sm text-mauve-700">
          {dict.admin.sortOrder}
          <input
            type="number"
            className="input w-16 px-2 py-1"
            value={d.sort_order}
            onChange={(e) => set("sort_order", Number(e.target.value))}
          />
        </label>

        <div className="ml-auto flex items-center gap-2">
          {error && <span className="text-xs text-red-600">{error}</span>}
          {id && (
            <button onClick={remove} disabled={busy} className="btn-ghost text-sm text-red-600">
              {dict.admin.delete}
            </button>
          )}
          {onDone && (
            <button onClick={onDone} disabled={busy} className="btn-ghost text-sm">
              {dict.common.cancel}
            </button>
          )}
          <button
            onClick={save}
            disabled={busy || !d.name_ro || !d.name_ru}
            className="btn-primary text-sm"
          >
            {busy ? dict.common.processing : dict.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
