"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { DC } from "@/lib/dc";

type Plan = { name: string; meta: string; price: number };

// Fixed price list (no DB round-trip): the landing teaser shows the studio's
// standard packages; the full purchase flow stays on /memberships.
export function PricingTeaser({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const p = dict.home.price;
  const [group, setGroup] = useState<"adult" | "child">("adult");

  const adults: Plan[] = [
    { name: `4 ${p.sessions}`, meta: dict.audience.adult, price: 650 },
    { name: `8 ${p.sessions}`, meta: dict.audience.adult, price: 1050 },
    { name: `12 ${p.sessions}`, meta: dict.audience.adult, price: 1300 },
    { name: p.unlimited, meta: dict.audience.adult, price: 1700 },
  ];
  const kids: Plan[] = [
    { name: p.kids37, meta: `12 ${p.sessions}`, price: 550 },
    { name: p.kids813, meta: `12 ${p.sessions}`, price: 600 },
  ];

  const groups: { key: "adult" | "child"; label: string }[] = [
    { key: "adult", label: dict.schedule.filterAdults },
    { key: "child", label: dict.schedule.filterKids },
  ];
  const plans = group === "adult" ? adults : kids;

  return (
    <div>
      {/* Same pill toggle as the schedule's audience filter. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
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
            style={{ background: "#fff", border: `1px solid ${DC.border}`, borderRadius: DC.radius, padding: "30px 28px" }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: DC.ink }}>{plan.name}</div>
            <div style={{ fontSize: 13.5, color: DC.faint, marginTop: 2 }}>{plan.meta}</div>
            <div style={{ margin: "16px 0 0", display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: DC.display, fontWeight: 600, fontSize: 42, letterSpacing: "-.02em", color: DC.accent }}>
                {plan.price}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: DC.faint }}>MDL</span>
            </div>
            <div style={{ height: 1, background: DC.border2, margin: "20px 0" }} />
            <Link
              href={`/${lang}/memberships`}
              className="dc-btn"
              style={{
                display: "block",
                textAlign: "center",
                background: "#fff",
                color: DC.ink,
                fontWeight: 700,
                fontSize: 15,
                padding: 13,
                border: "1px solid #E2E0E6",
                borderRadius: 999,
                textDecoration: "none",
              }}
            >
              {p.choose}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
