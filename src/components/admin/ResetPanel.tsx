"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  resetStatisticsAction,
  resetScheduleAction,
  resetMembersAction,
  resetPlansAction,
} from "@/app/[lang]/admin/actions";

// One reset action per admin page. Importing the server actions here (a client
// component) is supported — they run on the server when called.
const ACTIONS = {
  stats: resetStatisticsAction,
  schedule: resetScheduleAction,
  members: resetMembersAction,
  plans: resetPlansAction,
} as const;

type ResetKind = keyof typeof ACTIONS;

// A "danger zone" card shown at the bottom of an admin page. Resetting requires
// expanding the panel and typing the keyword, so it can't fire on a stray click.
export function ResetPanel({ kind, dict }: { kind: ResetKind; dict: Dictionary }) {
  const t = dict.admin.reset;
  const copy = t[kind];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<null | "ok" | "err">(null);
  const [errDetail, setErrDetail] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<number | null>(null);

  const armed = confirmText.trim().toUpperCase() === t.keyword.toUpperCase();

  async function run() {
    if (!armed || pending) return;
    setResult(null);
    setErrDetail(null);
    setPending(true);
    try {
      const { error, deleted } = await ACTIONS[kind]();
      if (error) {
        setResult("err");
        setErrDetail(error);
        return;
      }
      setResult("ok");
      setDeleted(typeof deleted === "number" ? deleted : null);
      setConfirmText("");
      setOpen(false);
      router.refresh();
    } catch (e) {
      // A thrown server action (e.g. auth/permission) would otherwise fail
      // silently — surface it so the admin sees what went wrong.
      setResult("err");
      setErrDetail(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  function close() {
    setOpen(false);
    setConfirmText("");
  }

  return (
    <section className="mt-10 rounded-2xl border border-red-200 bg-red-50/50 p-4">
      <h3 className="text-sm font-semibold text-red-700">{t.dangerZone}</h3>
      <p className="mt-1 max-w-prose text-sm text-red-900/75">{copy.desc}</p>

      {result === "ok" && (
        <p className="alert-success mt-3">
          {t.success}
          {deleted !== null && (
            <span className="ml-1">{t.removed.replace("{n}", String(deleted))}</span>
          )}
        </p>
      )}
      {result === "err" && (
        <p className="alert-error mt-3">
          {dict.common.error}
          {errDetail && (
            <span className="mt-1 block font-mono text-xs text-red-600">{errDetail}</span>
          )}
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setOpen(true);
          }}
          className="btn-secondary mt-3 text-sm text-red-700"
        >
          {copy.button}
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-sm text-red-900/80">
            {t.confirmPrompt.replace("{word}", t.keyword)}
          </label>
          <input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t.keyword}
            className="input max-w-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={run}
              disabled={!armed || pending}
              className="btn-danger text-sm"
            >
              {pending ? dict.common.processing : t.confirm}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="btn-secondary text-sm"
            >
              {dict.common.cancel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
