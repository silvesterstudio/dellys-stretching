"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { bookingErrorMessage } from "@/lib/booking-errors";

interface Child {
  id: string;
  name: string;
}

export function BookingForm({
  lang,
  dict,
  sessionId,
  isChild,
  initialChildren,
}: {
  lang: Locale;
  dict: Dictionary;
  sessionId: string;
  isChild: boolean;
  initialChildren: Child[];
}) {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>(initialChildren);
  const [childId, setChildId] = useState<string | null>(
    initialChildren[0]?.id ?? null,
  );
  const [adding, setAdding] = useState(initialChildren.length === 0 && isChild);
  const [newChild, setNewChild] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function addChild() {
    const nameTrim = newChild.trim();
    if (!nameTrim) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      setError(dict.common.error);
      return;
    }
    const { data, error } = await supabase
      .from("children")
      .insert({ parent_id: user.id, name: nameTrim })
      .select("id, name")
      .single();
    setBusy(false);
    if (error || !data) {
      setError(dict.common.error);
      return;
    }
    setChildren((prev) => [...prev, data]);
    setChildId(data.id);
    setNewChild("");
    setAdding(false);
  }

  async function confirm() {
    setError(null);
    if (isChild && !childId) {
      setError(dict.booking.selectChild);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("book_session", {
      p_session_id: sessionId,
      p_child_id: isChild ? childId : null,
    });
    setBusy(false);
    if (error) {
      setError(bookingErrorMessage(error.message, dict));
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="mt-5 text-center">
        <div className="rounded-xl bg-green-50 px-4 py-3 text-green-700">
          {dict.booking.success}
        </div>
        <button
          onClick={() => router.replace(`/${lang}/dashboard`)}
          className="btn-primary mt-4 w-full"
        >
          {dict.nav.dashboard}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isChild && (
        <div className="mb-4">
          <label className="label">{dict.booking.selectChild}</label>
          <div className="space-y-2">
            {children.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  childId === c.id
                    ? "border-brand-400 bg-brand-50"
                    : "border-mauve-200"
                }`}
              >
                <input
                  type="radio"
                  name="child"
                  checked={childId === c.id}
                  onChange={() => setChildId(c.id)}
                />
                {c.name}
              </label>
            ))}
          </div>

          {adding ? (
            <div className="mt-2 flex gap-2">
              <input
                className="input"
                placeholder={dict.booking.childName}
                value={newChild}
                onChange={(e) => setNewChild(e.target.value)}
              />
              <button onClick={addChild} disabled={busy} className="btn-primary whitespace-nowrap">
                {dict.common.save}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="mt-2 text-sm text-brand-600 hover:text-brand-700"
            >
              + {dict.booking.addChild}
            </button>
          )}
        </div>
      )}

      <p className="mb-3 rounded-xl bg-mauve-50 px-3 py-2 text-xs text-mauve-600">
        {dict.booking.noMembershipNote}
      </p>

      <button
        onClick={confirm}
        disabled={busy || (isChild && !childId)}
        className="btn-primary w-full"
      >
        {busy ? dict.common.loading : dict.common.confirm}
      </button>
    </div>
  );
}
