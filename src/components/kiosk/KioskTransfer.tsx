"use client";

import { useEffect } from "react";
import { normalizeKioskToken } from "@/lib/kiosk-token";

const destination = "https://impulssport.md/classes/kiosk";

export function KioskTransfer() {
  useEffect(() => {
    const current = new URL(window.location.href);
    const next = new URL(destination);
    if (current.searchParams.get("lang") === "ru") next.searchParams.set("lang", "ru");
    let saved = current.searchParams.get("token");
    if (!saved) {
      try { saved = localStorage.getItem("dellys_kiosk_token"); } catch { /* Storage is unavailable. */ }
    }
    const token = normalizeKioskToken(saved ?? "");
    if (/^[a-f0-9]{32}$/.test(token)) {
      // The fragment is read and removed by the Impuls kiosk in the browser.
      next.hash = new URLSearchParams({ "dellys-device": token }).toString();
    }
    window.location.replace(next);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center text-white">
      <h1 className="text-2xl font-bold">Check-in Impuls Sport</h1>
      <a href={destination} className="underline">Deschide scannerul</a>
    </main>
  );
}
