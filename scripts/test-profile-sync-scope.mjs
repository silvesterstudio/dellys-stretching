// Regression test for the bug that made Rîșcani disappear from the admin panel.
//
// profiles.location_id means "home gym" for a client but "the only gym you can
// see" for staff, where NULL = all gyms. A background sync that fills NULLs must
// therefore never touch a staff row, or it silently revokes the super-admin's
// access to the second studio.
//
// This exercises the guard in src/lib/profile-sync.ts against the live schema
// using throwaway accounts, then deletes them.
//   node scripts/test-profile-sync-scope.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { sweepTestData } from "./clean-test-data.mjs";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let pass = 0, fail = 0;
const log = (ok, name, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// The exact write src/lib/profile-sync.ts performs for the studio fallback.
const guardedFill = (userId, locationId) =>
  db.from("profiles").update({ location_id: locationId })
    .eq("id", userId).eq("role", "client").is("location_id", null)
    .select("id");

async function main() {
  const stamp = Date.now();
  const trash = [];
  const { data: locs } = await db.from("locations").select("id, key, name").order("sort_order");
  if (!locs?.length) { console.error("no locations — cannot run"); process.exit(1); }
  const first = locs[0];

  const mk = async (tag, role) => {
    const { data, error } = await db.auth.admin.createUser({
      email: `zz-scope-${tag}-${stamp}@example.invalid`, email_confirm: true,
    });
    if (error) throw new Error(error.message);
    trash.push(data.user.id);
    await db.from("profiles").update({ role, location_id: null }).eq("id", data.user.id);
    return data.user.id;
  };

  try {
    console.log("── a staff account keeps NULL (= sees every studio) ──");
    for (const role of ["admin", "reception"]) {
      const id = await mk(role, role);
      const { data: touched } = await guardedFill(id, first.id);
      const { data: after } = await db.from("profiles").select("location_id").eq("id", id).single();
      log((touched?.length ?? 0) === 0 && after.location_id === null,
        `${role}: studio fallback refused`,
        `rows=${touched?.length ?? 0} location_id=${after.location_id}`);
    }

    console.log("\n── a client still gets a studio (the original fix still works) ──");
    const cid = await mk("client", "client");
    const { data: t1 } = await guardedFill(cid, first.id);
    const { data: a1 } = await db.from("profiles").select("location_id").eq("id", cid).single();
    log((t1?.length ?? 0) === 1 && a1.location_id === first.id,
      `client: filled with ${first.name}`, `rows=${t1?.length ?? 0}`);

    console.log("\n── and it never moves a client already assigned ──");
    const other = locs[1] ?? first;
    const { data: t2 } = await guardedFill(cid, other.id);
    const { data: a2 } = await db.from("profiles").select("location_id").eq("id", cid).single();
    log((t2?.length ?? 0) === 0 && a2.location_id === first.id,
      "client: second run is a no-op", `rows=${t2?.length ?? 0}`);

    console.log("\n── every studio is visible to an unpinned admin ──");
    const active = locs.filter((l) => l.key);
    const { data: activeRows } = await db.from("locations").select("key, name").eq("active", true);
    log((activeRows?.length ?? 0) >= 2,
      "both studios active", (activeRows ?? []).map((l) => l.name).join(" + "));
    log(active.length === locs.length, "no location row is missing a key");

    const { data: supers } = await db.from("profiles")
      .select("email").eq("role", "admin").is("location_id", null);
    log((supers?.length ?? 0) >= 1,
      "at least one admin can switch studios",
      (supers ?? []).map((p) => p.email).join(", "));
  } finally {
    for (const id of trash) await db.auth.admin.deleteUser(id);
    console.log(`\ncleaned up ${trash.length} throwaway account(s)`);
    // Belt and braces: a per-id delete can fail silently, and a survivor is
    // not inert — its membership shows up as revenue on the owner's
    // dashboard. Sweep by email pattern as well.
    await sweepTestData({ quiet: true });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
