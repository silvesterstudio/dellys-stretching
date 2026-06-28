"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localized } from "@/lib/i18n-data";
import { formatPrice } from "@/lib/format";
import { requestMembershipAction } from "@/app/[lang]/memberships/actions";

export type PlanCard = {
  id: string;
  audience: "adult" | "child";
  name_ro: string;
  name_ru: string;
  session_count: number;
  price: number;
  currency: string;
  validity_days: number;
  featured: boolean;
};

export function MembershipPlans({
  lang,
  dict,
  plans,
  loggedIn,
  loginHref,
  initialPending,
}: {
  lang: Locale;
  dict: Dictionary;
  plans: PlanCard[];
  loggedIn: boolean;
  loginHref: string;
  initialPending: string[];
}) {
  const [pending, setPending] = useState<Set<string>>(new Set(initialPending));
  const [justSent, setJustSent] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function buy(planId: string) {
    setBusyId(planId);
    setErrorId(null);
    const { error } = await requestMembershipAction(planId);
    setBusyId(null);
    if (error) {
      setErrorId(planId);
      return;
    }
    setPending((prev) => new Set(prev).add(planId));
    setJustSent((prev) => new Set(prev).add(planId));
  }

  const groups: { audience: "adult" | "child"; items: PlanCard[] }[] = [
    { audience: "adult", items: plans.filter((p) => p.audience === "adult") },
    { audience: "child", items: plans.filter((p) => p.audience === "child") },
  ];

  return (
    <div className="space-y-10">
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.audience}>
              <h2 className="section-title mb-4">{dict.audience[g.audience]}</h2>
              <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((p) => {
                  const isPending = pending.has(p.id);
                  const sent = justSent.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`card relative flex flex-col p-5 ${
                        p.featured
                          ? "ring-2 ring-brand-400 shadow-lg shadow-brand-500/15"
                          : ""
                      }`}
                    >
                      {p.featured && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm shadow-brand-500/40">
                          ★ {dict.memberships.featured}
                        </span>
                      )}

                      <div
                        className={`text-lg font-semibold text-mauve-900 ${p.featured ? "mt-2" : ""}`}
                      >
                        {localized(p, "name", lang)}
                      </div>

                      <div className="mt-2 text-3xl font-bold text-brand-600">
                        {formatPrice(p.price, p.currency, lang)}
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-mauve-500">
                        <div>
                          {p.session_count} {dict.memberships.sessions}
                        </div>
                        <div>
                          {dict.memberships.validity}: {p.validity_days}{" "}
                          {dict.memberships.days}
                        </div>
                      </div>

                      <div className="mt-4 flex-1" />

                      {sent && (
                        <p className="alert-success mb-2">{dict.memberships.requestSent}</p>
                      )}
                      {errorId === p.id && (
                        <p className="alert-error mb-2">{dict.common.error}</p>
                      )}

                      {!loggedIn ? (
                        <Link
                          href={loginHref}
                          className="btn-secondary w-full"
                        >
                          {dict.memberships.loginToBuy}
                        </Link>
                      ) : isPending ? (
                        <button
                          disabled
                          className="btn-secondary w-full opacity-70"
                        >
                          ⏳ {dict.memberships.requestPending}
                        </button>
                      ) : (
                        <button
                          onClick={() => buy(p.id)}
                          disabled={busyId === p.id}
                          className={`w-full ${p.featured ? "btn-primary" : "btn-secondary"}`}
                        >
                          {busyId === p.id
                            ? dict.common.processing
                            : dict.memberships.buyOnline}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ),
      )}

      <p className="rounded-2xl bg-mauve-50 px-4 py-3 text-center text-xs text-mauve-500">
        {dict.memberships.reception}
      </p>
    </div>
  );
}
