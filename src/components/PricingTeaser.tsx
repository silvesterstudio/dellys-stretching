"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { DC } from "@/lib/dc";

type Plan = { name: string; meta: string; price: number };

// Fixed price list (no DB round-trip): the landing teaser just shows the
// studio's standard packages. There are no buy buttons — a member reserves a
// plan from their account after signing up.
//
// These figures ARE the standard prices now — what used to run as the summer
// 2026 promotion was kept, so there is no struck-through "before" price and no
// promo badge. They match membership_plans (see 0023_summer_prices_2026.sql).
export function PricingTeaser({ dict }: { dict: Dictionary }) {
  const p = dict.home.price;
  const [group, setGroup] = useState<"adult" | "child">("adult");

  const adults: Plan[] = [
    { name: p.oneSession, meta: p.single, price: 150 },
    { name: `4 ${p.sessions}`, meta: p.perMonth, price: 450 },
    { name: `8 ${p.sessions}`, meta: p.perMonth, price: 700 },
    { name: `12 ${p.sessions}`, meta: p.perMonth, price: 850 },
    // The only bundle that runs longer than a month, so it says so rather than
    // "pe lună" like the rest.
    { name: `16 ${p.sessions}`, meta: p.twoMonths, price: 999 },
    { name: p.unlimited, meta: p.perMonth, price: 1300 },
  ];
  // Kids are priced by how many days a week they train, not by age group —
  // both age groups train on the same fixed days.
  const kids: Plan[] = [
    { name: p.kids2days, meta: p.kids2daysWhen, price: 550 },
    { name: p.kids3days, meta: p.kids3daysWhen, price: 700 },
  ];

  const groups: { key: "adult" | "child"; label: string }[] = [
    { key: "adult", label: dict.schedule.filterAdults },
    { key: "child", label: dict.schedule.filterKids },
  ];
  const plans = group === "adult" ? adults : kids;

  return (
    <div>
      {/* Same pill toggle as the schedule's audience filter. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div
          role="group"
          aria-label={p.title}
          style={{
            display: "inline-flex",
            background: "#fff",
            border: `1px solid ${DC.border}`,
            borderRadius: 999,
            padding: 5,
            gap: 2,
          }}
        >
          {groups.map((g) => {
            const active = group === g.key;
            return (
              <button
                key={g.key}
                type="button"
                aria-pressed={active}
                onClick={() => setGroup(g.key)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  padding: "9px 22px",
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: DC.sans,
                  background: active ? DC.accent : "transparent",
                  color: active ? "#fff" : DC.muted,
                  transition: "all .2s",
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 22,
          // Two kids cards read better narrower and centered.
          maxWidth: group === "child" ? 720 : undefined,
          margin: "0 auto",
        }}
      >
        {plans.map((plan) => (
          <div
            key={plan.name}
            className="dc-lift"
            style={{
              background: "#fff",
              border: `1px solid ${DC.border}`,
              borderRadius: DC.radius,
              padding: "30px 28px",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: DC.ink }}>{plan.name}</div>
            <div style={{ fontSize: 13.5, color: DC.faint, marginTop: 2 }}>{plan.meta}</div>
            <div style={{ margin: "16px 0 0", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: DC.display, fontWeight: 600, fontSize: 42, letterSpacing: "-.02em", color: DC.accent }}>
                {plan.price}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: DC.faint }}>MDL</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
