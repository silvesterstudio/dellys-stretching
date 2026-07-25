"use client";

import { useState } from "react";
import type { Locale } from "@/lib/constants";
import { TIMEZONE } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";

export interface KioskDeviceInfo {
  label: string | null;
  token: string;
  lastSeenAt: string | null;
}

export interface CheckinLogRow {
  id: string;
  createdAt: string;
  result: string;
  member: string | null;
  className: string | null;
}

// Provisioning + a live tail of the door. Admin-only: the setup link contains
// the device token, which is a bearer credential — anyone holding it can record
// entries, so it must never reach the members' side of the desk.
export function KioskPanel({
  device,
  recent,
  lang,
  dict,
}: {
  device: KioskDeviceInfo | null;
  recent: CheckinLogRow[];
  lang: Locale;
  dict: Dictionary;
}) {
  const t = dict.admin.kiosk;
  const [copied, setCopied] = useState(false);

  const setupUrl =
    device && typeof window !== "undefined"
      ? `${window.location.origin}/kiosk?token=${encodeURIComponent(device.token)}`
      : null;

  async function copy() {
    if (!setupUrl) return;
    try {
      await navigator.clipboard.writeText(setupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the token is shown below to type by hand */
    }
  }

  const time = (iso: string) =>
    new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TIMEZONE,
    }).format(new Date(iso));

  const resultLabel = (r: string) =>
    (t.results as Record<string, string>)[r] ?? r;

  return (
    <div className="card space-y-5 p-5">
      <div>
        <h3 className="font-display text-lg font-bold text-mauve-900">{t.title}</h3>
        <p className="mt-1 text-sm text-mauve-500">{t.hint}</p>
      </div>

      {!device ? (
        <p className="text-sm text-mauve-400">{t.none}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={copy} className="btn-primary py-1.5 text-sm">
              {copied ? t.copied : t.copy}
            </button>
            <a
              href={`/kiosk?token=${encodeURIComponent(device.token)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary py-1.5 text-sm"
            >
              {t.open}
            </a>
            <span className="text-xs text-mauve-400">
              {t.lastSeen}:{" "}
              {device.lastSeenAt
                ? new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "ro-RO", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: TIMEZONE,
                  }).format(new Date(device.lastSeenAt))
                : t.never}
            </span>
          </div>

          <div>
            <div className="label">{t.token}</div>
            <code className="mt-1 block select-all break-all rounded-lg bg-mauve-50 px-3 py-2 font-mono text-xs text-mauve-700">
              {device.token}
            </code>
          </div>

          <div className="alert alert-warning text-xs">{t.warning}</div>
        </>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-mauve-800">{t.recent}</h4>
        {recent.length === 0 ? (
          <p className="text-sm text-mauve-400">{t.recentNone}</p>
        ) : (
          <ul className="divide-y divide-mauve-100">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 font-display font-bold text-mauve-900">
                    {time(r.createdAt)}
                  </span>
                  <span className="truncate text-mauve-700">{r.member ?? "—"}</span>
                  {r.className && (
                    <span className="truncate text-xs text-mauve-400">{r.className}</span>
                  )}
                </span>
                <span
                  className={`shrink-0 ${r.result === "ok" ? "badge-success" : "badge-muted"}`}
                >
                  {resultLabel(r.result)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
