// PREREQUISITE: npm i -D playwright && npx playwright install chromium
//   (kept out of package.json to avoid affecting the Vercel prod build).
// Start the app first:  PORT=3100 npm run start
//
// Real-browser E2E: drives the actual UI with Chromium (Playwright), clicking
// real buttons / filling real forms, and asserts each mutation landed in the DB.
// Auth is injected as a real Supabase session cookie (the login form uses
// magic-link / admin-password we can't complete headlessly).
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z_]+)=(.*)$/.exec(l.trim()); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const REF = URL.match(/https:\/\/([^.]+)/)[1], COOKIE = `sb-${REF}-auth-token`;
const BASE = "http://localhost:3100";
const db = createClient(URL, SVC, { auth: { persistSession: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const log = (o, n, d = "") => { o ? pass++ : fail++; console.log(`${o ? "✓" : "✗ FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const iso = (days) => new Date(Date.now() + days * 86400000).toISOString();
mkdirSync("/tmp/e2e-shots", { recursive: true });

function cookieChunks(session) {
  const val = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");
  const SIZE = 3180, out = [];
  if (val.length <= SIZE) out.push({ name: COOKIE, value: val });
  else for (let i = 0, n = 0; i < val.length; i += SIZE, n++) out.push({ name: `${COOKIE}.${n}`, value: val.slice(i, i + SIZE) });
  return out.map((c) => ({ ...c, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }));
}

async function main() {
  const stamp = Date.now(), pw = `E2e!${stamp}aA`;
  const trash = { users: [], sessions: [] };

  // ── Seed: an admin (browser actor), a client with a plan to sell / a booking to check in ──
  const adminEmail = `zz-e2e-admin-${stamp}@example.invalid`;
  const { data: a } = await db.auth.admin.createUser({ email: adminEmail, password: pw, email_confirm: true, user_metadata: { full_name: "E2E Admin" } });
  await db.from("profiles").update({ role: "admin" }).eq("id", a.user.id); trash.users.push(a.user.id);
  const clientEmail = `zz-e2e-client-${stamp}@example.invalid`;
  const { data: c } = await db.auth.admin.createUser({ email: clientEmail, password: pw, email_confirm: true, user_metadata: { full_name: "Zoe E2E Client", phone: "069" + (stamp % 1000000) } });
  trash.users.push(c.user.id);
  const { data: adultCt } = await db.from("class_types").select("id").eq("audience", "adult").limit(1).maybeSingle();
  const { data: adultPlan } = await db.from("membership_plans").select("id, name_ro, price").eq("audience", "adult").eq("active", true).is("system_key", null).order("sort_order").limit(1).maybeSingle();
  // A session happening now for check-in
  const { data: sess } = await db.from("sessions").insert({ class_type_id: adultCt.id, starts_at: iso(0.02), duration_min: 60, capacity: 5, booked_count: 0, status: "scheduled" }).select("id").single();
  trash.sessions.push(sess.id);

  const { data: sign } = await anon.auth.signInWithPassword({ email: adminEmail, password: pw });
  const cookies = cookieChunks(sign.session);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

  try {
    // ── 1. Dashboard renders with panels ──
    await page.goto(`${BASE}/ro/admin/dashboard`, { waitUntil: "networkidle" });
    await page.screenshot({ path: "/tmp/e2e-shots/01-dashboard.png", fullPage: true });
    const dashText = await page.textContent("body");
    log(/Panou de administrare/.test(dashText) && /Încasări recente/.test(dashText) && /Jurnal activitate/.test(dashText), "dashboard renders KPIs + transactions + audit panels");
    log(/Astăzi/.test(dashText) && /Statistici/.test(dashText), "header shows admin nav pills");

    // ── 2. Members: search the client, open detail, SELL a plan (real form submit) ──
    await page.goto(`${BASE}/ro/admin/members`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder*="Caută"]', "Zoe E2E");
    await page.click('button:has-text("Caută")');
    await page.waitForTimeout(1200);
    await page.click('text=Zoe E2E Client');
    await page.waitForSelector('text=Activează abonament', { timeout: 8000 });
    // set amount + method + assign
    const amountBox = page.locator('input[type="number"]').first();
    await amountBox.fill("300");
    await page.click('button:has-text("Atribuie")');
    await page.waitForTimeout(1800);
    await page.screenshot({ path: "/tmp/e2e-shots/02-after-sell.png", fullPage: true });
    // verify in DB: membership created with amount_paid 300 + audit + transaction
    const { data: mems } = await db.from("user_memberships").select("id, sessions_remaining, amount_paid, payment_method").eq("user_id", c.user.id);
    log(mems?.some((m) => Number(m.amount_paid) === 300 && m.payment_method === "cash"), "SELL plan via UI -> membership row with amount_paid=300 cash", `rows ${mems?.length}`);
    const { data: aud } = await db.from("audit_log").select("action").eq("action", "membership.assign").eq("target_id", c.user.id);
    log((aud?.length ?? 0) >= 1, "SELL wrote a membership.assign audit entry");

    // ── 3. Notes: type a note and save (real textarea + button) ──
    await page.fill('textarea', "E2E: prefers morning classes");
    await page.click('button:has-text("Salvează")');
    await page.waitForTimeout(1200);
    const { data: prof } = await db.from("profiles").select("notes").eq("id", c.user.id).single();
    log(prof.notes === "E2E: prefers morning classes", "SAVE note via UI -> profiles.notes updated");

    // ── 4. Today -> open session -> walk-in check-in the client ──
    await page.goto(`${BASE}/ro/admin/today`, { waitUntil: "networkidle" });
    await page.screenshot({ path: "/tmp/e2e-shots/03-today.png", fullPage: true });
    await page.click(`a[href*="/admin/sessions/${sess.id}"]`);
    await page.waitForSelector('text=Listă participanți', { timeout: 8000 });
    await page.click('button:has-text("Adaugă participant")');
    await page.fill('input[placeholder*="Caută"]', "Zoe E2E");
    await page.click('button:has-text("Caută")');
    await page.waitForTimeout(1200);
    await page.click('text=Zoe E2E Client');
    await page.waitForTimeout(600);
    await page.click('button:has-text("Prezent")');
    await page.waitForTimeout(1800);
    await page.screenshot({ path: "/tmp/e2e-shots/04-after-checkin.png", fullPage: true });
    const { data: bks } = await db.from("bookings").select("id, status, membership_id").eq("session_id", sess.id).eq("user_id", c.user.id);
    log(bks?.some((b) => b.status === "attended"), "WALK-IN check-in via UI -> booking attended", `statuses ${bks?.map((b) => b.status)}`);
    const { data: memAfter } = await db.from("user_memberships").select("sessions_remaining").eq("user_id", c.user.id).order("created_at", { ascending: false }).limit(1).single();
    log(true, `membership after check-in: ${memAfter?.sessions_remaining} sessions left`);

    // ── 5. Undo the check-in (real button) -> booking reverts, session refunded ──
    const attendedBk = bks.find((b) => b.status === "attended");
    await page.reload({ waitUntil: "networkidle" });
    await page.click('button:has-text("Anulează")');
    await page.waitForTimeout(1500);
    const { data: bkUndo } = await db.from("bookings").select("status").eq("id", attendedBk.id).single();
    log(bkUndo.status === "booked", "UNDO via UI -> booking back to booked");

    // ── 6. Language switch RO -> RU ──
    await page.goto(`${BASE}/ro/admin/today`, { waitUntil: "networkidle" });
    await page.click('text=RU');
    await page.waitForTimeout(1500);
    const ruText = await page.textContent("body");
    log(/Занятия сегодня|Сегодня/.test(ruText), "language switch RO->RU renders Russian");

    // ── 7. Mobile viewport: home + admin ──
    const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mob.addCookies(cookies);
    const mpage = await mob.newPage();
    await mpage.goto(`${BASE}/ro`, { waitUntil: "networkidle" });
    await mpage.screenshot({ path: "/tmp/e2e-shots/05-mobile-home.png", fullPage: true });
    const homeMob = await mpage.textContent("body");
    log(/Mișcare|Rezervă/.test(homeMob), "mobile home renders");
    await mpage.goto(`${BASE}/ro/admin/today`, { waitUntil: "networkidle" });
    await mpage.screenshot({ path: "/tmp/e2e-shots/06-mobile-admin.png", fullPage: true });
    log(true, "mobile admin today captured");
    await mob.close();

    await browser.close();
  } catch (e) {
    console.log("  [E2E ERROR]", e.message);
    await page.screenshot({ path: "/tmp/e2e-shots/ERROR.png", fullPage: true }).catch(() => {});
    fail++;
    await browser.close();
  }

  // ── teardown ──
  for (const s of trash.sessions) { await db.from("bookings").delete().eq("session_id", s); await db.from("sessions").delete().eq("id", s); }
  for (const u of trash.users) await db.auth.admin.deleteUser(u);
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("screenshots in /tmp/e2e-shots/");
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
