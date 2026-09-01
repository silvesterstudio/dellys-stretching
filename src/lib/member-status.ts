// What state a member is in, for the roster's filter and badges.
//
// Deliberately NOT called "former member" anywhere: Dellys has no churn or
// lapse concept — nothing marks somebody as having left. All the data supports
// is "has nothing valid right now", which is what `inactive` says.

export type MemberStatus = "active" | "frozen" | "pending" | "inactive";

export interface MembershipLike {
  frozen: boolean;
  starts_at: string;
  expires_at: string;
  sessions_remaining: number;
}

export interface MemberStatusInfo {
  status: MemberStatus;
  /** Sessions on the bundle that decides the status, when there is one. */
  sessionsRemaining: number | null;
  /** Expiry of that same bundle. */
  expiresAt: string | null;
}

/**
 * Derive one member's state from their memberships.
 *
 * The order matters: a usable bundle wins over everything, then a frozen one,
 * then one that has been sold but has not started. Anything else is inactive —
 * including a member who has never bought at all.
 */
export function deriveMemberStatus(
  memberships: MembershipLike[],
  now: Date = new Date(),
): MemberStatusInfo {
  const t = now.toISOString();

  const usable = memberships
    .filter(
      (m) =>
        !m.frozen && m.starts_at <= t && m.expires_at > t && m.sessions_remaining > 0,
    )
    // Soonest to expire is the one that will actually be spent next, so it is
    // the one worth showing on the row.
    .sort((a, b) => a.expires_at.localeCompare(b.expires_at))[0];
  if (usable) {
    return {
      status: "active",
      sessionsRemaining: usable.sessions_remaining,
      expiresAt: usable.expires_at,
    };
  }

  const frozen = memberships.find((m) => m.frozen && m.expires_at > t);
  if (frozen) {
    return {
      status: "frozen",
      sessionsRemaining: frozen.sessions_remaining,
      expiresAt: frozen.expires_at,
    };
  }

  const notStarted = memberships
    .filter((m) => m.starts_at > t && m.expires_at > t)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  if (notStarted) {
    return {
      status: "pending",
      sessionsRemaining: notStarted.sessions_remaining,
      expiresAt: notStarted.starts_at,
    };
  }

  return { status: "inactive", sessionsRemaining: null, expiresAt: null };
}

export const MEMBER_STATUSES: MemberStatus[] = ["active", "frozen", "pending", "inactive"];
