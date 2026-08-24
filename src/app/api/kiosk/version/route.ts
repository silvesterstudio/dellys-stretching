import { NextResponse } from "next/server";

// The deployed build, so a tablet can notice it is running an old one.
//
// A kiosk is not a page anyone reloads. It is mounted on a wall, opened once,
// and left running for weeks — which means it keeps whatever JavaScript it
// booted with long after the site has moved on. That is not theoretical: the
// picker shipped, the tablet kept the previous bundle, and because the old code
// tested only `ok` it read the new "here are your options" reply as a completed
// check-in and showed a member "Bine ai venit" while nothing had been written.
//
// So the kiosk asks, occasionally, whether it is current, and reloads itself
// when it is not.
export const dynamic = "force-dynamic";

// Vercel stamps the commit on every deployment. Locally there is none and the
// value is constant, so a dev tablet simply never decides it is stale.
const BUILD =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_DEPLOYMENT_ID ??
  "dev";

export async function GET() {
  return NextResponse.json(
    { build: BUILD },
    // Never let a CDN answer this: a cached reply is exactly the stale state we
    // are trying to detect.
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
