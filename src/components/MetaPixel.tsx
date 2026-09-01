"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useConsent } from "@/components/ConsentBanner";

// Facebook / Meta Pixel. The id is public (it ships in the browser either way),
// so it's fine to hardcode with an env override for other environments.
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "1934391913925341";

// Fire a Meta standard/custom event (e.g. "Lead") from anywhere client-side.
// No-ops safely before the pixel script has loaded.
export function trackPixel(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
  if (fbq) fbq("track", event, params);
}

// Staff surfaces are not marketing traffic. Loading the pixel there would put
// our own admins into the site-visitor audiences we retarget (and into the
// lookalike seeds), so those routes get no pixel at all.
const PRIVATE_SEGMENTS = ["admin", "staff"];

function isTrackedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  // Strip the locale prefix: /ro/admin/members -> /admin/members
  const rest = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
  const first = rest.split("/")[1];
  return !PRIVATE_SEGMENTS.includes(first ?? "");
}

export function MetaPixel() {
  const pathname = usePathname();
  // No consent, no pixel. Until Law 195/2024 this loaded for everyone on every
  // public page, with no notice and no way to refuse.
  const consent = useConsent();
  const tracked = isTrackedPath(pathname) && consent === "granted";
  // The snippet is mounted lazily on the first *public* page, and never
  // unmounted after that (fbq stays loaded for the rest of the visit anyway).
  const [armed, setArmed] = useState(false);
  const lastTracked = useRef<string | null>(null);

  // Fire exactly one PageView per public route. The base snippet fires the one
  // for the page that arms it; App-Router navigations are client-side, so each
  // later public route needs its own.
  useEffect(() => {
    if (!tracked) return;
    if (!armed) {
      // The snippet is about to mount and will fire this page's PageView.
      lastTracked.current = pathname;
      setArmed(true);
      return;
    }
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    trackPixel("PageView");
  }, [pathname, tracked, armed]);

  if (!armed) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${FB_PIXEL_ID}');
fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
