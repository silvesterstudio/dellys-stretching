// Regression test for src/lib/kiosk-token.ts — the function that decides whether
// what a tablet sends is "the same" device token as the one in the database.
//
// Run:  node scripts/test-kiosk-token.mjs
//
// Every case below is a way a real setup went wrong: a tablet that looked fine,
// then refused every member with "Tabletă neautorizată".
import { normalizeKioskToken } from "../src/lib/kiosk-token.ts";

const T = "f287ce3a91b04c5d8e2f6a7b09c4d1e8";
let failed = 0;
function check(name, input, expected) {
  const got = normalizeKioskToken(input);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n       got      ${JSON.stringify(got)}\n       expected ${JSON.stringify(expected)}`}`);
}

check("exact token is unchanged", T, T);
check("iPad capitalises the first letter", "F" + T.slice(1), T);
check("all caps", T.toUpperCase(), T);
check("trailing newline from a paste", T + "\n", T);
check("leading and trailing spaces", `  ${T}  `, T);
check("zero-width space from a chat app", T.slice(0, 10) + "​" + T.slice(10), T);
check("byte-order mark", "﻿" + T, T);
check("wrapped in quotes", `"${T}"`, T);
check("whole setup link pasted", `https://dellys.md/kiosk?token=${T}`, T);
check("setup link, other params after it", `https://dellys.md/kiosk?token=${T}&lang=ru`, T);
check("setup link with a capitalised token", `https://dellys.md/kiosk?token=${"F" + T.slice(1)}`, T);
check("fullwidth characters (IME)", T.replace(/a/g, "ａ"), T);
check("empty stays empty", "", "");
check("only whitespace becomes empty", " \n\t ", "");
// A wrong token must stay wrong: normalising is not allowed to make a bad code good.
check("one wrong character stays wrong", "0" + T.slice(1), "0" + T.slice(1));
check("too short stays as typed", "abc123", "abc123");
// A future token format (not 32 hex) must not be lower-cased or otherwise mangled.
check("non-hex token keeps its case", "Device-Token_ABC", "Device-Token_ABC");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall passed");
