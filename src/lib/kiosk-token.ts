// One definition of "the same device token", shared by the tablet and both kiosk
// API routes so they can never disagree about it.
//
// Tokens are 32 lowercase hex characters and the database matches them exactly.
// A tablet is set up by a person pasting or typing one, so what arrives is often
// not byte-for-byte what was issued: an iPad keyboard capitalises the first
// letter of a text field, a paste brings along a trailing newline or a zero-width
// space, and someone pastes the whole setup link instead of the code. Each of
// those used to produce a tablet that looked configured and then refused every
// single member with "Tabletă neautorizată" — with nothing to say why, and no way
// to recover short of someone re-typing the code correctly.
//
// Pure and dependency-free so it can run in the browser and on the server.
export function normalizeKioskToken(raw: string): string {
  let v = raw.normalize("NFKC");

  // The whole setup link pasted instead of the code: /kiosk?token=…
  const fromLink = v.match(/[?&]token=([^&#\s]+)/i);
  if (fromLink) {
    try {
      v = decodeURIComponent(fromLink[1]);
    } catch {
      v = fromLink[1];
    }
  }

  // Whitespace, zero-width characters and stray quotes from chat apps and docs.
  v = v.replace(/[\s​-‍⁠﻿"'`]/g, "");

  // Case only matters to a human; hex is hex. Anything that is not a recognisable
  // token is left exactly as cleaned, so a future token format is not mangled.
  return /^[0-9a-f]{32}$/i.test(v) ? v.toLowerCase() : v;
}
