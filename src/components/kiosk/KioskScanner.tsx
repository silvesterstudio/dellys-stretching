"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/constants";
import { TIMEZONE } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { KioskScanResult } from "@/lib/types";

type KioskDict = Dictionary["kiosk"];
type ErrKey = keyof KioskDict["err"];

// Narrow any code coming off the wire to one we actually have copy for, so an
// unrecognised code shows a generic error instead of a blank screen.
function errKey(code: string, dict: KioskDict): ErrKey {
  return (code in dict.err ? code : "server_error") as ErrKey;
}

// The tablet remembers which device it is, so the token only has to be entered
// once (or passed once as ?token=... when the admin sets the tablet up).
const TOKEN_KEY = "dellys_kiosk_token";

// How long each outcome stays on screen before returning to the camera.
const HOLD_OK_MS = 3500;
const HOLD_ERR_MS = 9000;

// Three visual registers, so staff can read the outcome across the room without
// reading any words: green = go in, amber = see the front desk, ruby = refused.
const TONE: Record<string, "ok" | "warn" | "deny" | "info"> = {
  ok: "ok",
  already_checked_in: "info",
  no_membership: "warn",
  class_full: "warn",
  no_class: "warn",
  not_found: "deny",
  wrong_location: "deny",
  device_unknown: "deny",
  bad_request: "deny",
  rate_limited: "warn",
  connection: "info",
  server_error: "info",
};

const TONE_STYLE = {
  ok: { bg: "#07231A", ring: "#22c55e", text: "#4ade80", glow: "rgba(34,197,94,.55)" },
  warn: { bg: "#2A1C05", ring: "#f59e0b", text: "#fbbf24", glow: "rgba(245,158,11,.5)" },
  deny: { bg: "#2A0715", ring: "#e0115f", text: "#f9739f", glow: "rgba(224,17,95,.5)" },
  info: { bg: "#16151B", ring: "#8b8593", text: "#c9c5cf", glow: "rgba(139,133,147,.4)" },
} as const;

// Two short rising tones for success, two falling for refusal. Built with the
// WebAudio API so the kiosk needs no audio assets.
class Chime {
  private ctx: AudioContext | null = null;

  private get context(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  private tone(freq: number, at: number, dur: number, peak = 0.32) {
    const ctx = this.context;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  success() {
    this.tone(784, 0, 0.18);
    this.tone(1175, 0.14, 0.26);
  }

  failure() {
    this.tone(520, 0, 0.22);
    this.tone(360, 0.26, 0.3);
  }
}

type View =
  | { kind: "waiting" }
  | { kind: "result"; result: KioskScanResult }
  | { kind: "error"; code: ErrKey };

export function KioskScanner({
  lang,
  ro,
  ru,
  signupQr,
  signupLabel,
}: {
  lang: Locale;
  ro: KioskDict;
  ru: KioskDict;
  // Data-URI QR pointing at the public sign-up page, rendered on the server.
  signupQr: string;
  signupLabel: string;
}) {
  const dict = lang === "ru" ? ru : ro;

  const [locationName, setLocationName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [ready, setReady] = useState(false); // token resolved from storage/URL
  const [view, setView] = useState<View>({ kind: "waiting" });
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCamera, setActiveCamera] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [hintIdx, setHintIdx] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<{ destroy: () => void; setCamera: (id: string) => Promise<void> } | null>(null);
  const chimeRef = useRef<Chime | null>(null);
  const busyRef = useRef(false);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tapsRef = useRef(0);
  const adminHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- device token -------------------------------------------------------
  // ?token=... lets the admin provision a tablet by opening one link; it is
  // moved into localStorage and stripped from the URL so it isn't left on
  // screen or in history for a passer-by to copy.
  useEffect(() => {
    let value: string | null = null;
    try {
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get("token");
      if (fromUrl) {
        value = fromUrl.trim();
        localStorage.setItem(TOKEN_KEY, value);
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.toString());
      } else {
        value = localStorage.getItem(TOKEN_KEY);
      }
    } catch {
      /* private mode / storage disabled — fall back to manual entry */
    }
    setToken(value && value.length > 0 ? value : null);
    setReady(true);
  }, []);

  useEffect(() => {
    chimeRef.current = new Chime();
  }, []);

  // Confirm the token is live and learn which studio this tablet belongs to.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/kiosk/device", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_token: token }),
        });
        const data = (await res.json()) as { ok?: boolean; locationName?: string };
        if (!cancelled && res.ok && data.ok) setLocationName(data.locationName ?? "");
      } catch {
        /* offline — the name is decoration, scanning still reports the truth */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Alternate the standby hint between Romanian and Russian.
  useEffect(() => {
    const id = setInterval(() => setHintIdx((i) => (i + 1) % 2), 2600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const reset = useCallback(() => {
    if (holdRef.current) clearTimeout(holdRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    setView({ kind: "waiting" });
    setCountdown(0);
    busyRef.current = false;
  }, []);

  const finish = useCallback((next: View, ok: boolean) => {
    setView(next);
    if (ok) chimeRef.current?.success();
    else chimeRef.current?.failure();

    if (holdRef.current) clearTimeout(holdRef.current);
    if (tickRef.current) clearInterval(tickRef.current);

    const hold = ok ? HOLD_OK_MS : HOLD_ERR_MS;
    let left = Math.round(hold / 1000);
    setCountdown(left);
    tickRef.current = setInterval(() => {
      left -= 1;
      setCountdown(left);
      if (left <= 0 && tickRef.current) clearInterval(tickRef.current);
    }, 1000);

    holdRef.current = setTimeout(() => {
      if (tickRef.current) clearInterval(tickRef.current);
      setView({ kind: "waiting" });
      setCountdown(0);
      busyRef.current = false;
    }, hold);
  }, []);

  const submit = useCallback(
    async (qr: string, deviceToken: string) => {
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qr_uuid: qr, device_token: deviceToken }),
        });
        const data = (await res.json()) as KioskScanResult & { code?: string };
        if (res.ok && data.ok) {
          finish({ kind: "result", result: data }, true);
        } else {
          const code = errKey(data.code ?? "server_error", dict);
          finish({ kind: "result", result: { ...data, ok: false, code } }, false);
        }
      } catch {
        finish({ kind: "error", code: "connection" }, false);
      }
    },
    [dict, finish],
  );

  // --- scanner ------------------------------------------------------------
  useEffect(() => {
    if (!ready || !token || !videoRef.current) return;
    let destroyed = false;

    (async () => {
      const QrScanner = (await import("qr-scanner")).default;
      if (destroyed || !videoRef.current) return;

      const scanner = new QrScanner(
        videoRef.current,
        (result: { data: string } | string) => {
          const raw = typeof result === "string" ? result : result.data;
          const qr = raw.trim();
          if (!qr || busyRef.current) return;
          busyRef.current = true;
          void submit(qr, token);
        },
        {
          preferredCamera: "user",
          highlightScanRegion: false,
          highlightCodeOutline: true,
          maxScansPerSecond: 20,
          returnDetailedScanResult: true,
          overlay: overlayRef.current ?? undefined,
          // Decode only the middle of the frame (where the reticle is) and
          // downscale it — far fewer pixels per frame, much faster on a cheap
          // tablet.
          calculateScanRegion: (video: HTMLVideoElement) => {
            const size = Math.round(Math.min(video.videoWidth, video.videoHeight) * 0.55);
            return {
              x: Math.round((video.videoWidth - size) / 2),
              y: Math.round((video.videoHeight - size) / 2),
              width: size,
              height: size,
              downScaledWidth: 320,
              downScaledHeight: 320,
            };
          },
        },
      );

      scannerRef.current = scanner as unknown as typeof scannerRef.current;

      try {
        await scanner.start();
        if (destroyed) {
          scanner.destroy();
          return;
        }
        setCameraReady(true);
        setCameraError(null);
        const list = await QrScanner.listCameras(true);
        setCameras(list);
      } catch (err) {
        if (!destroyed) {
          setCameraError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      destroyed = true;
      if (holdRef.current) clearTimeout(holdRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      if (adminHideRef.current) clearTimeout(adminHideRef.current);
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [ready, token, submit]);

  // --- hidden admin controls (ten taps) -----------------------------------
  function handleTap() {
    tapsRef.current += 1;
    if (tapsRef.current >= 10) {
      tapsRef.current = 0;
      setAdminOpen(true);
      if (adminHideRef.current) clearTimeout(adminHideRef.current);
      adminHideRef.current = setTimeout(() => setAdminOpen(false), 6000);
    }
  }

  function keepAdminOpen() {
    if (!adminOpen) return;
    if (adminHideRef.current) clearTimeout(adminHideRef.current);
    adminHideRef.current = setTimeout(() => setAdminOpen(false), 6000);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen();
    }
  }

  async function nextCamera() {
    if (!scannerRef.current || cameras.length < 2) return;
    const i = cameras.findIndex((c) => c.id === activeCamera);
    const next = cameras[(i + 1) % cameras.length];
    await scannerRef.current.setCamera(next.id);
    setActiveCamera(next.id);
  }

  function forgetDevice() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  }

  // --- setup screen -------------------------------------------------------
  if (ready && !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mauve-900 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <h1 className="font-display text-2xl font-bold text-mauve-900">
            {dict.setupTitle}
          </h1>
          <p className="mt-2 text-sm text-mauve-500">{dict.setupHint}</p>
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const v = tokenInput.trim();
              if (!v) return;
              try {
                localStorage.setItem(TOKEN_KEY, v);
              } catch {
                /* ignore */
              }
              setToken(v);
            }}
          >
            <label className="label" htmlFor="kiosk-token">
              {dict.setupLabel}
            </label>
            <input
              id="kiosk-token"
              className="input font-mono"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="btn-primary w-full">
              {dict.setupSave}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!ready) {
    return <div className="min-h-screen bg-mauve-900" />;
  }

  // Standby copy alternates RO/RU on a timer so both languages are addressed;
  // the whole panel turns over at once rather than mixing the two on screen.
  const t = hintIdx === 0 ? ro : ru;

  const resultCode =
    view.kind === "result" ? view.result.code : view.kind === "error" ? view.code : null;
  const tone = resultCode ? (TONE[resultCode] ?? "info") : "info";
  const style = TONE_STYLE[tone];
  const showing = view.kind !== "waiting";

  return (
    <div className="relative h-screen w-screen select-none overflow-hidden bg-mauve-900">
      {/* Two jobs, side by side: make an account (left) and check in (right).
          Before, the camera filled the screen and a member without an account
          had nothing to act on — the tablet could refuse them but not enrol
          them. The sign-up code turns that dead end into the next step.

          Always mounted: the <video> is owned by qr-scanner and must survive a
          result being shown, so the outcome layer simply covers this. */}
      <div className="grid h-full w-full grid-rows-[auto_1fr] lg:grid-cols-[0.85fr_1.15fr] lg:grid-rows-1">
        {/* ── Sign up ─────────────────────────────────────────────────── */}
        <aside
          onClick={handleTap}
          className="relative flex flex-col items-center justify-center gap-[clamp(0.5rem,1.6vh,1.25rem)] border-b border-white/10 px-8 py-[clamp(1rem,3vh,2.5rem)] text-center lg:border-b-0 lg:border-r lg:px-10"
        >
          <p className="text-[clamp(0.6rem,1.4vh,0.8rem)] font-bold uppercase tracking-[0.22em] text-brand-300">
            {t.signupEyebrow}
          </p>
          <h2 className="font-display text-[clamp(1.35rem,3.6vh,2.4rem)] font-bold leading-tight tracking-tight text-white">
            {t.signupTitle}
          </h2>
          <p className="max-w-xs text-[clamp(0.8rem,1.7vh,1.05rem)] leading-snug text-white/55">
            {t.signupSub}
          </p>

          {/* White plate: a QR needs a quiet zone and maximum contrast to read
              off a screen from a metre away. */}
          <div className="rounded-[1.75rem] bg-white p-[clamp(0.6rem,1.4vh,1rem)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signupQr}
              alt={t.signupTitle}
              className="h-[clamp(110px,22vmin,240px)] w-[clamp(110px,22vmin,240px)]"
            />
          </div>

          <span className="rounded-full border border-white/15 bg-white/[0.07] px-5 py-2 text-[clamp(0.7rem,1.5vh,0.9rem)] font-semibold tracking-wide text-white/70">
            {signupLabel}
          </span>
        </aside>

        {/* ── Check in ────────────────────────────────────────────────── */}
        <section className="relative flex min-h-0 flex-col items-center justify-center gap-[clamp(0.6rem,2vh,1.5rem)] px-6 py-[clamp(1rem,3vh,2rem)]">
          {/* The viewfinder is square because the scan region is: qr-scanner
              decodes the middle 55% of the frame, and object-cover keeps that
              centre centred, so the brackets frame what is actually read.

              Sized off the height, per orientation, so it stays SQUARE. A
              portrait-mounted tablet stacks the two panels, leaving the scanner
              about half the screen; a viewport-width size overflowed it, and
              the body is overflow-hidden, so the amber note was silently cut
              off rather than scrolling. Clamping max-height instead kept the
              width and gave a rectangle — brackets that no longer matched the
              scan region. */}
          <div className="relative aspect-square w-[min(80%,32vh)] overflow-hidden rounded-[2rem] bg-black/60 ring-1 ring-white/10 lg:w-[min(88%,52vh)]">
            <video
              ref={videoRef}
              className="h-full w-full scale-105 object-cover"
              playsInline
              muted
            />
            {/* qr-scanner paints the detected code outline into this layer */}
            <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20" />

            <div className="pointer-events-none absolute inset-0 z-10">
              <span className="absolute left-3 top-3 h-14 w-14 rounded-tl-[1.5rem] border-l-[5px] border-t-[5px] border-white/85" />
              <span className="absolute right-3 top-3 h-14 w-14 rounded-tr-[1.5rem] border-r-[5px] border-t-[5px] border-white/85" />
              <span className="absolute bottom-3 left-3 h-14 w-14 rounded-bl-[1.5rem] border-b-[5px] border-l-[5px] border-white/85" />
              <span className="absolute bottom-3 right-3 h-14 w-14 rounded-br-[1.5rem] border-b-[5px] border-r-[5px] border-white/85" />
            </div>

            {!cameraReady && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-mauve-900/80">
                <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-white/80" />
              </div>
            )}
          </div>

          <div className="pointer-events-none rounded-[1.5rem] border border-white/20 bg-white/10 px-7 py-3 backdrop-blur-2xl">
            <p className="font-display text-[clamp(0.95rem,2.2vh,1.4rem)] font-bold text-white">
              {t.present}
            </p>
          </div>

          {/* Amber, not white: this is the one line that corrects a wrong
              assumption — people scan on the way out too, and that burns a
              session off their membership. */}
          <p className="flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-5 py-2 text-center text-[clamp(0.7rem,1.5vh,0.9rem)] font-semibold text-amber-200/90">
            <span aria-hidden>&#9888;</span>
            {t.note}
          </p>

          <p className="text-[clamp(0.6rem,1.3vh,0.78rem)] font-semibold uppercase tracking-[0.18em] text-white/35">
            {locationName}
          </p>
        </section>
      </div>

      {/* Outcome */}
      {showing && resultCode && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center px-8 text-center"
          style={{ background: style.bg }}
        >
          <div
            className="pointer-events-none absolute h-[520px] w-[520px] rounded-full opacity-25 blur-3xl"
            style={{ background: `radial-gradient(circle, ${style.ring} 0%, transparent 70%)` }}
          />

          <div
            className="relative mb-8 flex h-28 w-28 items-center justify-center rounded-full border-[3px]"
            style={{ borderColor: style.ring, boxShadow: `0 0 90px ${style.glow}` }}
          >
            <Glyph tone={tone} color={style.text} />
          </div>

          {view.kind === "result" && view.result.ok ? (
            <SuccessBody result={view.result} dict={dict} lang={lang} style={style} />
          ) : (
            <FailureBody
              code={errKey(resultCode, dict)}
              dict={dict}
              homeLocation={view.kind === "result" ? view.result.homeLocation : null}
              clientName={view.kind === "result" ? view.result.clientName : null}
              style={style}
            />
          )}

          <div className="relative mt-10 flex flex-col items-center gap-3">
            <p className="text-lg font-bold text-white/45">
              {dict.resetsIn} <span className="font-display text-white">{Math.max(countdown, 0)}</span>s
            </p>
            <button
              onClick={reset}
              className="rounded-2xl border border-white/25 bg-white/10 px-10 py-3 text-base font-bold text-white transition-all active:scale-95"
            >
              {dict.close}
            </button>
          </div>
        </div>
      )}

      {/* Hidden admin strip */}
      {adminOpen && !showing && (
        <div
          onClick={keepAdminOpen}
          className="absolute left-1/2 top-8 z-40 flex -translate-x-1/2 items-center gap-3"
        >
          {cameras.length > 1 && (
            <KioskChip onClick={() => void nextCamera()}>{dict.switchCamera}</KioskChip>
          )}
          <KioskChip onClick={toggleFullscreen}>
            {isFullscreen ? dict.exitFullscreen : dict.fullscreen}
          </KioskChip>
          <KioskChip onClick={forgetDevice}>{dict.setupLabel} ✕</KioskChip>
        </div>
      )}

      {/* Camera failure */}
      {cameraError && !cameraReady && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-mauve-900/95 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center">
            <h2 className="font-display text-xl font-bold text-mauve-900">
              {dict.cameraTitle}
            </h2>
            <p className="mt-2 break-words text-[13px] text-mauve-500">{cameraError}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary mt-6 w-full"
            >
              {dict.cameraReload}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KioskChip({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-white/20 bg-black/50 px-5 py-3 text-sm font-bold text-white/80 backdrop-blur-xl transition-all active:scale-95"
    >
      {children}
    </button>
  );
}

function Glyph({ tone, color }: { tone: "ok" | "warn" | "deny" | "info"; color: string }) {
  const common = { fill: "none", stroke: color, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg className="h-14 w-14" viewBox="0 0 24 24" aria-hidden="true">
      {tone === "ok" && <path d="M5 13l4 4L19 7" {...common} />}
      {tone === "warn" && (
        <>
          <path d="M12 8v5" {...common} />
          <path d="M12 17h.01" {...common} />
          <circle cx="12" cy="12" r="9" {...common} />
        </>
      )}
      {tone === "deny" && (
        <>
          <circle cx="12" cy="12" r="9" {...common} />
          <path d="M15.5 8.5l-7 7" {...common} />
        </>
      )}
      {tone === "info" && (
        <>
          <circle cx="12" cy="12" r="9" {...common} />
          <path d="M12 11v5" {...common} />
          <path d="M12 8h.01" {...common} />
        </>
      )}
    </svg>
  );
}

function SuccessBody({
  result,
  dict,
  lang,
  style,
}: {
  result: KioskScanResult;
  dict: KioskDict;
  lang: Locale;
  style: (typeof TONE_STYLE)[keyof typeof TONE_STYLE];
}) {
  const className = lang === "ru" ? result.className_ru : result.className_ro;
  const time = result.startsAt
    ? new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "ro-RO", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: TIMEZONE,
      }).format(new Date(result.startsAt))
    : null;
  const left = result.sessionsRemaining;

  return (
    <div className="relative flex flex-col items-center">
      <p
        className="mb-3 text-xl font-bold uppercase tracking-[0.15em]"
        style={{ color: style.text }}
      >
        {dict.welcome}
      </p>
      <h1
        className="mb-7 font-display font-bold leading-none tracking-tight text-white"
        style={{ fontSize: "clamp(2.75rem, 9vw, 5.5rem)" }}
      >
        {result.clientName || "—"}
      </h1>

      {(className || time) && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-7 py-4">
          {result.color && (
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: result.color }}
            />
          )}
          <span className="font-display text-2xl font-bold text-white">{className}</span>
          {time && <span className="text-2xl font-semibold text-white/60">{time}</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {typeof left === "number" ? (
          <Pill color={style.text}>
            {left} {left === 1 ? dict.sessionLeft : dict.sessionsLeft}
          </Pill>
        ) : null}
        {result.walkIn && <Pill color="#c9c5cf">{dict.walkIn}</Pill>}
      </div>
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="rounded-2xl border px-7 py-3 text-2xl font-extrabold tabular-nums"
      style={{ borderColor: `${color}55`, color, background: `${color}14` }}
    >
      {children}
    </span>
  );
}

function FailureBody({
  code,
  dict,
  homeLocation,
  clientName,
  style,
}: {
  code: ErrKey;
  dict: KioskDict;
  homeLocation?: string | null;
  clientName?: string | null;
  style: (typeof TONE_STYLE)[keyof typeof TONE_STYLE];
}) {
  const copy = dict.err[code] ?? dict.err.server_error;
  return (
    <div className="relative flex max-w-2xl flex-col items-center">
      {clientName && (
        <p className="mb-3 text-xl font-semibold text-white/50">{clientName}</p>
      )}
      <h1 className="mb-3 font-display text-5xl font-bold tracking-tight text-white">
        {copy.t}
      </h1>
      <p className="mb-8 text-2xl font-bold" style={{ color: style.text }}>
        {homeLocation && code === "wrong_location" ? homeLocation : copy.d}
      </p>
      {copy.h && (
        <div className="rounded-3xl border border-white/15 bg-white/5 px-8 py-6">
          <p className="text-lg font-medium text-white/75">{copy.h}</p>
        </div>
      )}
    </div>
  );
}
