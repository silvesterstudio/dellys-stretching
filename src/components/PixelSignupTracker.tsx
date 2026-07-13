"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trackPixel } from "@/components/MetaPixel";

// Fires the Meta "CompleteRegistration" conversion exactly once, when the auth
// callback lands a brand-new account here with ?welcome=1, then strips the param
// so a refresh/back doesn't double-count.
export function PixelSignupTracker() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (params.get("welcome") !== "1") return;
    fired.current = true;
    trackPixel("CompleteRegistration");
    // Clean the URL (keep any other params).
    const rest = new URLSearchParams(params.toString());
    rest.delete("welcome");
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [params, pathname, router]);

  return null;
}
