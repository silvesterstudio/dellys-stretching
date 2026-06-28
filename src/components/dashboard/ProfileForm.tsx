"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import { updateProfileAction } from "@/app/[lang]/dashboard/actions";

export function ProfileForm({
  dict,
  initialName,
  initialPhone,
}: {
  dict: Dictionary;
  initialName: string | null;
  initialPhone: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const { error } = await updateProfileAction(name, phone);
    setBusy(false);
    if (error) {
      setError(dict.common.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card grid gap-3 p-4 sm:grid-cols-2">
      <label className="block">
        <span className="label">{dict.dashboard.yourName}</span>
        <input
          className="input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          placeholder={dict.dashboard.yourName}
        />
      </label>
      <label className="block">
        <span className="label">{dict.dashboard.yourPhone}</span>
        <input
          className="input"
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setSaved(false);
          }}
          placeholder="+373 ..."
        />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? dict.common.processing : dict.common.save}
        </button>
        {saved && <span className="text-sm text-green-700">{dict.dashboard.saved}</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </form>
  );
}
