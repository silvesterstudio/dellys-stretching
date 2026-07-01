// Line icons for the landing page (disciplines, benefits) — 24×24, stroke,
// currentColor. Kept in one place so the design language stays consistent.

type IconProps = { className?: string };

const base = "h-6 w-6";

function S({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ?? base}
    >
      {children}
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path
        d="M4 10.5l3.5 3.5L16 5.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Pilates — a body in a controlled pose.
export function PilatesIcon(p: IconProps) {
  return (
    <S {...p}>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v6" />
      <path d="M6 10c2 1.5 4 2 6 2s4-.5 6-2" />
      <path d="M12 13l-3 6M12 13l3 6" />
    </S>
  );
}

// Stretching — outward reach.
export function StretchIcon(p: IconProps) {
  return (
    <S {...p}>
      <path d="M4 12h16" />
      <path d="M7 8l-3 4 3 4" />
      <path d="M17 8l3 4-3 4" />
    </S>
  );
}

// Gymnastics — a spark of movement.
export function GymIcon(p: IconProps) {
  return (
    <S {...p}>
      <path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </S>
  );
}

// Fit Ball — the ball.
export function BallIcon(p: IconProps) {
  return (
    <S {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </S>
  );
}

// Benefits
export function GroupIcon(p: IconProps) {
  return (
    <S {...p}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 6.5a3 3 0 010 5.5M17 14c2.4.4 4 2.3 4 5" />
    </S>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <S {...p}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      <path d="M8.5 14.5l2 2 4-4" />
    </S>
  );
}

export function TagIcon(p: IconProps) {
  return (
    <S {...p}>
      <path d="M4 6.5A2.5 2.5 0 016.5 4H12l8 8-6 6-8-8V6.5z" />
      <circle cx="8.5" cy="8.5" r="1.2" />
    </S>
  );
}

export function GiftIcon(p: IconProps) {
  return (
    <S {...p}>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M4 13h16M12 9v11" />
      <path d="M12 9C10.5 5 6 5 6 7.5S9.5 9 12 9zM12 9c1.5-4 6-4 6-1.5S14.5 9 12 9z" />
    </S>
  );
}

export const DISCIPLINE_ICONS = [PilatesIcon, StretchIcon, GymIcon, BallIcon];
export const BENEFIT_ICONS = [GroupIcon, CalendarIcon, TagIcon, GiftIcon];
