"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { DC, tint } from "@/lib/dc";

type Plan = { name: string; meta: string; price: number; oldPrice?: number };

// Fixed price list (no DB round-trip): the landing teaser just shows the
// studio's standard packages. There are no buy buttons — a member reserves a
// plan from their account after signing up.
//
// ⚠ SUMMER 2026: temporary discounted prices; `oldPrice` is the standard price
// shown struck through. After the summer, drop `oldPrice` and restore the
// standard list (see supabase/migrations/0023_summer_prices_2026.sql).
export function PricingTeaser({ dict }: { dict: Dictionary }) {
  const p = dict.home.price;
  const [group, setGroup] = useState<"adult" | "child">("adult");

  const adults: Plan[] = [
    { name: p.oneSession, meta: p.single, price: 150 },
    { name: `4 ${p.sessions}`, meta: p.perMonth, price: 450, oldPrice: 650 },
    { name: `8 ${p.sessions}`, meta: p.perMonth, price: 700, oldPrice: 1050 },
    { name: `12 ${p.sessions}`, meta: p.perMonth, price: 850, oldPrice: 1300 },
    { name: p.unlimited, meta: p.perMonth, price: 1300, oldPrice: 1700 },
  ];
  const kids: Plan[] = [
    { name: p.kids37, meta: `12 ${p.sessions} · ${p.perMonth}`, price: 550 },
    { name: p.kids813, meta: `12 ${p.sessions} · ${p.perMonth}`, price: 600 },
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

      {/* Summer-promo note — the adult list is discounted for the season. */}
      {group === "adult" && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 32,
          }}
        >
          <span
            style={{
              background: DC.accent,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              padding: "5px 14px",
              borderRadius: 999,
              fontFamily: DC.sans,
              letterSpacing: ".02em",
            }}
          >
            ☀ {p.summer}
          </span>
          <span style={{ fontSize: 13.5, color: DC.muted, fontFamily: DC.sans }}>
            {p.summerNote}
          </span>
        </div>
      )}

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
        {plans.map((plan) => {
          const pct = plan.oldPrice
            ? Math.round((1 - plan.price / plan.oldPrice) * 100)
            : 0;
          return (
            <div
              key={plan.name}
              className="dc-lift"
              style={{
                position: "relative",
                background: plan.oldPrice ? tint(3) : "#fff",
                border: `1px solid ${plan.oldPrice ? tint(22) : DC.border}`,
                borderRadius: DC.radius,
                padding: "30px 28px",
              }}
            >
              {plan.oldPrice ? (
                <div
                  style={{
                    position: "absolute",
                    top: -11,
                    left: 24,
                    background: DC.accent,
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontFamily: DC.sans,
                  }}
                >
                  −{pct}%
                </div>
              ) : null}
              <div style={{ fontSize: 16, fontWeight: 700, color: DC.ink }}>{plan.name}</div>
              <div style={{ fontSize: 13.5, color: DC.faint, marginTop: 2 }}>{plan.meta}</div>
              <div style={{ margin: "16px 0 0", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                {plan.oldPrice && (
                  <span
                    style={{
                      fontFamily: DC.display,
                      fontWeight: 500,
                      fontSize: 20,
                      color: DC.faint,
                      textDecoration: "line-through",
                    }}
                  >
                    {plan.oldPrice}
                  </span>
                )}
                <span style={{ fontFamily: DC.display, fontWeight: 600, fontSize: 42, letterSpacing: "-.02em", color: DC.accent }}>
                  {plan.price}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: DC.faint }}>MDL</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
