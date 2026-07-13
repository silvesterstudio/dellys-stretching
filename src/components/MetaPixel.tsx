"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

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

export function MetaPixel() {
  const pathname = usePathname();
  const firstLoad = useRef(true);

  // The base snippet fires the first PageView. App-Router navigations are
  // client-side, so fire a PageView on each subsequent route change too.
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    trackPixel("PageView");
  }, [pathname]);

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
