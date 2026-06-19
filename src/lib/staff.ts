// Staff (admin) accounts log in with a username instead of an email. We map a
// bare username to a synthetic internal email so Supabase Auth can store it.
export const STAFF_EMAIL_DOMAIN = "dellys.local";

export function usernameToEmail(input: string): string {
  const v = input.trim();
  return v.includes("@") ? v : `${v}@${STAFF_EMAIL_DOMAIN}`;
}
