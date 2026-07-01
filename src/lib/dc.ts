// Design tokens ported verbatim from the "Dellys Home.dc.html" design source, so
// the implemented pages match it exactly. Used in inline styles across the
// landing page, header, footer, and schedule.
export const DC = {
  accent: "#E0115F",
  ink: "#16151B",
  sub: "#5A5962",
  muted: "#6C6B74",
  muted2: "#7A7981",
  faint: "#94939C",
  border: "#ECEAEF",
  border2: "#EFEDF1",
  band: "#FAFAFB",
  bandBorder: "#F0EFF2",
  chip: "#F5F4F7",
  green: "#2FBF71",
  radius: "20px",
  display: "'Space Grotesk', 'Manrope', system-ui, sans-serif",
  sans: "'Manrope', system-ui, -apple-system, sans-serif",
} as const;

// accent mixed p% with white — the design's `color-mix(in srgb, accent p%, #fff)`.
export const tint = (p: number) => `color-mix(in srgb, ${DC.accent} ${p}%, #fff)`;
