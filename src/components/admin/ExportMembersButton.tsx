"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { exportMembersCsvAction } from "@/app/[lang]/admin/actions";

// Downloads the members list as a CSV file (built server-side).
export function ExportMembersButton({ dict }: { dict: Dictionary }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const { csv } = await exportMembersCsvAction();
      if (!csv) return;
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dellys-membri-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={download} disabled={busy} className="btn-secondary whitespace-nowrap text-sm">
      {busy ? "…" : dict.admin.member.exportCsv}
    </button>
  );
}
