"use client";

import { useEffect } from "react";

// Arriving at /landing#preturi from another page (the footer and header links
// all do) leaves the browser at the top: the App Router restores scroll to 0
// after navigating, and `scroll-behavior: smooth` means the native fragment
// jump loses that race. Nothing scrolls, so the link reads as broken.
//
// Re-apply the fragment once the section has been laid out.
export function HashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!id) return;

    let frame = 0;
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        // scrollIntoView honours the html{scroll-padding-top} the header needs.
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      // Images above the fold can still be settling — retry briefly, then stop.
      if (attempts++ < 20) frame = requestAnimationFrame(tryScroll);
    };
    frame = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(frame);
  }, []);

  return null;
}
