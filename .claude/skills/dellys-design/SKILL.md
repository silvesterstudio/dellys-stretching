---
name: dellys-design
description: The Dellys design system — tokens, components, and UI/UX patterns to follow whenever building or editing any UI in this app (pages, components, admin, booking, membership). Use for any styling, layout, button, card, form, badge, color, spacing, or "make it consistent / fix the design" work.
---

# Dellys design system

Modern, editorial **white + ruby**. A clean white canvas with cool-neutral ink; ruby pink lives in accents, CTAs, icon tiles, and soft pink "sand" bands — **never** flood the page with color. One accent, quiet chrome, generous whitespace. Extracted from the "Dellys Home" mockup.

Source of truth: `src/app/globals.css` (`@layer components`) and `tailwind.config.ts`. **Always reuse the token classes below — never hand-roll an equivalent.** If a needed pattern doesn't exist as a token, add it to `globals.css` rather than inlining ad-hoc styles in one component. Because the whole app is tokenized, changing a token re-skins every page.

## Two surfaces, ONE system (important)
The app renders the design system through **two** mechanisms that are deliberately the same colors and fonts — treat them as one system:
1. **Tailwind token classes** (`brand`/`mauve`/`sand`, `.card`, `.btn-primary`, `font-display`) — used by **every page except the landing**: login, signup, dashboard/account, memberships, book, admin. This is the default; build new UI with these.
2. **Inline `DC` tokens** (`src/lib/dc.ts`) — used **only** by the landing page (`src/app/[lang]/page.tsx`), `Header`, and `Footer`, because those were ported 1:1 from a static HTML mockup. `DC` is a mirror of the Tailwind scale, NOT a second palette:
   - `DC.accent #E0115F` = `brand-500`; white-text buttons still darken to `brand-600`.
   - `DC.ink #16151B` = `mauve-900`; `DC.sub`=`mauve-500`, `DC.muted`=`mauve-600`, `DC.faint`=`mauve-400`, `DC.border`=`mauve-100`.
   - `DC.display`/`DC.sans` = the same Space Grotesk / Manrope as `font-display`/`font-sans`.
   - `tint(p)` = accent mixed p% into white (used for soft pink icon-tiles/bands), the inline analog of `brand-50/100` and `sand`.

**Rule:** when editing the landing/header/footer, use `DC`; everywhere else use the Tailwind classes. Never introduce a color/font that isn't in this shared mapping. To match "the landing look" on a non-landing page, reach for the equivalent Tailwind token — do NOT import `DC` into app pages.

### Landing-page signatures (reproduce these with Tailwind on other pages when asked to "match the landing")
- **Header** = a floating rounded "island": `rounded-full`, translucent **light** glass (`rgba(255,255,255,.72)` + `blur(18px)`), hairline border, soft shadow; sticky, detached from the page edges. On **mobile the bar is just logo + hamburger** — the language pills and nav collapse into the `MobileNav` menu (they're `hidden md:flex` in `Header.tsx`). Keep it this way; don't re-add chrome to the mobile bar.
- **Cards**: white, `1px` hairline border (`DC.border`/`mauve-100`), radius ~20px (`.card` = rounded-2xl), soft neutral shadow, `dc-lift` hover (translateY(-4px) + shadow) on interactive ones.
- **Buttons**: full pill; primary = accent fill, white text, a pink glow shadow on hero/CTA sizes.
- **Section rhythm**: centered head (`font-display` h2 + muted subtitle), ~64px vertical padding, alternating soft pink `tint(6)` bands and a final dark `DC.ink` CTA band with radial accent blobs.
- **Auth pages** carry a faint `bg-brand-200/35 blur-3xl` glow behind the card so they're not a stark white void.

## Typography
- **Display / headings: Space Grotesk** (geometric, modern) via `font-display`. Use for page `<h1>`, section `<h2>`, card titles, stat values, numerals, session times. Space Grotesk has **no Cyrillic**, so Russian headings fall back per-glyph to Manrope — this is wired in the Tailwind `display` stack; just use `font-display`.
- **Body / UI: Manrope** (default `font-sans`). Also carries Cyrillic.
- Scale: page `<h1>` `font-display text-[2.6rem]→text-6xl font-bold -tracking-[0.03em]`; section `<h2>` `font-display text-3xl→text-[2.5rem] font-bold -tracking-[0.02em]`; card title `font-display text-xl font-bold`. Body `text-mauve-600`, meta `text-mauve-400`.

## Palette (the only colors for UI chrome)
- `brand` — ruby identity (`brand-500 #e0115f`; use **`brand-600`** for white-text buttons, `brand-50/100` for tints/icon-tiles, `brand-700` hover, `brand-400` light accents). Section overlines and accent words use `brand-500`.
- `mauve` — cool neutral ink + hairlines. Text: `mauve-900 #16151b` (primary), `mauve-600` (secondary), `mauve-400` (muted/meta), `mauve-300` (disabled/placeholder). Borders: `mauve-200` / `mauve-100`. Soft surfaces/section bands: `mauve-50`. Dark CTA band: `bg-mauve-900` with white text.
- `sand` — whisper-pink soft surfaces (`sand-50/100`) for the offer band and warm callouts.

Never use raw `gray/slate/zinc/neutral` (use `mauve`), never a raw hex for chrome, and never introduce new hues.

### Semantic state colors (the ONLY exceptions, used sparingly)
Status feedback only. Use the token classes:
- Inline notices: `.alert-success/-error/-warning/-brand/-muted` (all `.alert`).
- Status badges: `.badge-success/-warning/-danger/-brand/-muted` (compose `.badge`).
- Availability: a small `bg-green-500` dot + count for open seats.
- Destructive: `.btn-danger` (confirmed destroy), `.btn-ghost-danger` (quiet inline delete). A "danger zone" card may use `border-red-200 bg-red-50/50`.

## Components (token classes — use verbatim)
- Buttons (`rounded-full` pills): `.btn-primary` (ruby), `.btn-secondary` (white + hairline), `.btn-ghost` (text). Header/hero CTAs size up with `px-7 py-3 text-base`; dense rows use `py-1.5 text-sm`.
- Surfaces: `.card` (rounded-2xl, hairline, soft neutral shadow) + `.card-hover` for interactive cards.
- `.icon-tile` — ruby rounded square (`bg-brand-50 text-brand-600`) holding a 24px stroke icon; used in disciplines/benefits. Icons live in `src/components/home/HomeIcons.tsx`.
- `.chip` — outlined pill for hero discipline tags / meta.
- `.eyebrow` — muted uppercase overline (hero). `.eyebrow-brand` — **ruby** uppercase overline above section titles ("CE ANTRENĂM", "PROGRAM").
- Forms: `.input`, `.label`; `select.input` gets the chevron. `.badge` pill for status.
- `PhotoSlot` (`src/components/home/PhotoSlot.tsx`) — branded gradient placeholder for real studio photos; pass `src` when photos exist, else it shows the Dellys mark. Used in the hero (portrait `aspect-[4/5]`) and category cards (`aspect-[16/10]`).

## Patterns (do it this way for consistency)
- **Section rhythm**: page sections `space-y-24 sm:space-y-32`. Centered `SectionHead` = `.eyebrow-brand` + `font-display` `<h2>` + muted subtitle. Alternate a section onto a soft band: `rounded-[2rem] bg-mauve-50` (neutral) or `bg-gradient-to-br from-sand-100 via-sand-50 to-brand-50` (pink offer band). Final CTA on `bg-mauve-900`.
- **Actions are buttons, not underlined text.** Row primary = `.btn-primary py-1.5 text-sm`; the one allowed text-link is a `text-brand-600` "Vezi programul →" style inline link or in prose.
- **List rows** (sessions, members): a `.card` `flex items-center justify-between gap-3 p-3/p-4`; left = content, right = small buttons.
- **Session rows**: `font-display` time + green-dot availability (`N locuri libere`) or muted `Complet`; class name with a small `class_type.color` dot; full-width `.btn-primary` "Rezervă" (or disabled `.btn-secondary` "Complet").
- **Per-class color** (`class_type.color`): small dot in dense rows; a 4px left-accent border only on a single hero card (booking confirm).
- **Empty states**: a muted `text-sm text-mauve-400` line, optionally in a `.card`.
- **Forms**: `.label` above `.input`; `grid gap-3 sm:grid-cols-2`; action row `.btn-primary` + `.btn-ghost`.
- **Motion**: `.animate-rise` for entrances; `prefers-reduced-motion` handled globally. `html { overflow-x: hidden }` guards decorative blur/gradient bands from creating horizontal scroll.
- **Accessibility**: icon-only buttons need `aria-label`; focus rings come with `.btn`; keep ≥4.5:1 text contrast (buttons use `brand-600`).

## Checklist before finishing any UI change
1. No raw `gray/slate/zinc`, no new hues, no raw hex for chrome — only `brand`/`mauve`/`sand` + defined semantic states.
2. Every button/action uses a `.btn-*` token (no underlined-text actions).
3. Cards use `.card`; inputs use `.input`/`.label`; icon tiles use `.icon-tile`; overlines use `.eyebrow`/`.eyebrow-brand`.
4. Headings use `font-display` (Space Grotesk) on the type scale; body is Manrope.
5. Per-class color shown as a dot (lists) or hero bar (single card).
6. Consistent `space-y` rhythm with siblings; responsive to mobile (0 horizontal overflow); icon buttons have `aria-label`.
