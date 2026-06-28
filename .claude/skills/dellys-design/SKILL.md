---
name: dellys-design
description: The Dellys design system — tokens, components, and UI/UX patterns to follow whenever building or editing any UI in this app (pages, components, admin, booking, membership). Use for any styling, layout, button, card, form, badge, color, spacing, or "make it consistent / fix the design" work.
---

# Dellys design system

Minimalist **white + pink**. A clean white canvas; pink lives only in accents, the logo, and whisper-pink "sand" surfaces — **never** flood the page with color. One accent, quiet chrome, generous whitespace.

Source of truth: `src/app/globals.css` (`@layer components`) and `tailwind.config.ts`. **Always reuse the token classes below — never hand-roll an equivalent.** If a needed pattern doesn't exist as a token, add it to `globals.css` rather than inlining ad-hoc styles in one component.

## Palette (the only colors for UI chrome)
- `brand` — pink identity (`brand-500 #fd0267`; use **`brand-600`** for white-text buttons, `brand-50/100` for tints, `brand-700` hover).
- `mauve` — neutral ink + hairlines. Text: `mauve-900` (primary), `mauve-600` (secondary), `mauve-400` (muted/meta), `mauve-300` (disabled/placeholder). Borders: `mauve-200` / `mauve-100`.
- `sand` — whisper-pink soft surfaces (`sand-50/100/200`) for callouts that should read warm, not grey.

Never use raw `gray/slate/zinc/neutral` (use `mauve`), and never introduce new hues for chrome.

### Semantic state colors (the ONLY exceptions, used sparingly)
Status feedback only — never as decoration or brand. **Use the token classes** (don't inline the shades):
- Inline notices: `.alert-success`, `.alert-error`, `.alert-warning`, `.alert-brand`, `.alert-muted` (all share `.alert` = `rounded-xl px-3 py-2 text-sm`).
- Status badges: `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-brand`, `.badge-muted` (compose with `.badge`).
- Destructive buttons: `.btn-danger` (solid red, for a confirmed destroy) and `.btn-ghost-danger` (quiet inline delete — mauve, red on hover).
Keep semantic color small (badges / one-line notices), not large fills. A confirmed "danger zone" may use a soft `border-red-200 bg-red-50/50` card — red there is intentional, not a violation.

## Typography
- Body & UI: sans (default).
- **Big page headings** (page `<h1>`): `font-display` (serif Georgia) + `text-2xl/3xl font-bold text-mauve-900`.
- Section heads: `.section-title` (`text-lg font-semibold tracking-tight`). Small overlines: `.eyebrow` (uppercase, tracked, `mauve-400`).
- Meta/secondary: `text-xs`/`text-sm text-mauve-400/500`.

## Components (token classes — use verbatim)
- Buttons (all `rounded-full`): `.btn-primary` (pink, primary action), `.btn-secondary` (white + hairline, secondary), `.btn-ghost` (text-only, tertiary). Size down with `py-1.5 text-sm` in dense rows; icon-only nav buttons use `.btn-secondary px-3`.
- Surfaces: `.card` (rounded-2xl, hairline, soft pink shadow). Add `.card-hover` for interactive cards.
- Forms: `.input` (text/number/time/select), `.label`. Selects automatically get the chevron via `select.input`.
- `.badge` (rounded-full pill) for status. `.container-page` for page width. `.eyebrow`, `.section-title` for headings.

## Patterns (do it this way for consistency)
- **Actions are buttons, not underlined text.** A row's primary action = `.btn-primary py-1.5 text-sm`; secondary = `.btn-secondary py-1.5 text-sm`; low-emphasis/destructive = `.btn-ghost py-1.5 text-sm` (destructive turns red on hover: `hover:bg-red-50 hover:text-red-700`). Never use `underline` text-links as buttons. The one allowed text-link is inline navigation inside prose (e.g. "see the schedule").
- **List rows** (sessions, members, requests): a `.card` with `flex items-center justify-between gap-3 p-3/p-4`; left = content, right = `flex shrink-0 gap-2` of small buttons.
- **Per-class color** (`class_type.color` is real data): show it as a **small dot** `<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background: color}}/>` in dense list rows; use a 4px left-accent border (`borderLeft: 4px solid color`) only on a single prominent "hero" session card (booking confirm, roster header). Pick one per context — don't mix bar + dot in the same list.
- **Status badges**: `.badge` + a semantic tint (e.g. attended → green, cancelled → mauve, frozen → mauve, free trial → green, pay-at-reception → amber).
- **Empty states**: a muted line `text-sm text-mauve-400` (optionally inside a `.card p-4/p-5`), not bare text crammed against a border.
- **Forms**: `.label` above each `.input`; group in `grid gap-3 sm:grid-cols-2`; action row of `.btn-primary` + `.btn-ghost` (cancel) at the end, `sm:col-span-2`.
- **Feedback**: inline notice rows — success `rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700`; error `bg-red-50 ... text-red-700`. Prefer real messages over silent state.
- **Spacing rhythm**: page sections `space-y-8`; items within a section `space-y-2/3`; card padding `p-4`/`p-5`. Keep it consistent between sibling components.
- **Motion**: `.animate-rise` for entrances; respect `prefers-reduced-motion` (already handled globally). Transitions `duration-150/200`.
- **Accessibility**: every icon-only button needs `aria-label`; focus rings come free with `.btn`; maintain ≥4.5:1 text contrast (that's why buttons use `brand-600`, not `500`).

## Checklist before finishing any UI change
1. No raw `gray/slate/zinc`, no new hues, no off-palette color except the defined semantic states.
2. Every button/action uses a `.btn-*` token (no underlined-text actions).
3. Cards use `.card`; inputs use `.input`/`.label`.
4. Headings follow the type scale (`font-display` h1, `.section-title`, `.eyebrow`).
5. Per-class color shown as dot (lists) or hero bar (single card), not a heavy bar in dense lists.
6. Consistent spacing with sibling components; icon buttons have `aria-label`.
