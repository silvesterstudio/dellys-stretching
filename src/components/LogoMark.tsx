import { DC } from "@/lib/dc";

// The Dellys wordmark from the design: a ruby ring + smile stroke, plus the
// "DELLYS" text in Space Grotesk.
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden>
        <circle cx="13" cy="13" r="11" stroke={DC.accent} strokeWidth="2" />
        <path d="M8.4 14.4c2.7 2 6.2 2 9-.9" stroke={DC.accent} strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span
        style={{
          fontFamily: DC.display,
          fontWeight: 700,
          fontSize: 19,
          letterSpacing: ".05em",
          color: DC.ink,
        }}
      >
        DELLYS
      </span>
    </span>
  );
}
