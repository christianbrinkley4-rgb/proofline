# Design system

The bar is Linear, Stripe, and Vercel: calm, precise, product-first. Every rule here exists so the product feels like one piece and never like a template.

Tokens live in [`app/globals.css`](app/globals.css). Use the semantic Tailwind classes below, not raw colors.

## Color

| Role | Class | Use it for |
| --- | --- | --- |
| Text | `text-foreground` | Headings, primary text |
| Secondary text | `text-muted-foreground` | Body copy, descriptions |
| Tertiary text | `text-subtle-foreground` | Meta lines, labels, timestamps |
| Surfaces | `bg-background`, `bg-muted` | Pages, panels, stages |
| Lines | `border` (default), `border-border-strong` | Dividers, cards, hover borders |
| **Accent** | `bg-brand`, `text-brand-ink`, `bg-brand-soft` | "Confirmed", fit bars, focus rings. Nothing decorative. |
| **Pending** | `bg-pending`, `text-pending-ink`, `bg-pending-soft` | Something waiting on the user: an unconfirmed fact, a follow-up that's due |

Rules:

- One accent. Green means "true and confirmed" or "worth your time." If a green element doesn't mean one of those, make it neutral.
- Amber is a status, not a second brand color. It only appears when the user has something to answer.
- Primary buttons are near-black (`bg-primary`). Never green.
- No gradients, glows, or glass. The sticky header's light blur is the only exception.

## Type

- Geist Sans for everything, Geist Mono for small eyebrows and step numbers. Two families, no more.
- Headings: `font-semibold`, tight tracking (`tracking-[-0.03em]` for section titles, `-0.04em` for the hero), `text-balance`.
- Body: 15 to 18px, `leading-7`, `text-pretty`.
- Numbers that change or compare (scores, stats): `tabular-nums`.

## Spacing and layout

- 8pt grid with 4pt half-steps for tight UI. In Tailwind units: 2, 4, 6, 8, 12, 16, 20, 24, 28 (plus 1, 3 inside dense components).
- Page gutter is `container` from [`components/marketing/section.tsx`](components/marketing/section.tsx): 16px on phones, 24px from `sm`, content capped at 72rem.
- Sections: `py-20 sm:py-28`, separated by a hairline `border-t`.
- Dense where it should be (job lists, tracker), calm where it should be (onboarding, document preview).
- Everything must work at 375px wide with no horizontal page scroll. Wide boards scroll inside their own container.

## Motion

Two animations, both behind `motion-safe:`:

- `animate-view-in`: 260ms fade and 4px rise when a view changes.
- `animate-bar-grow`: 700ms fill for score bars.

Nothing loops, bounces, or autoplays.

## Copy

Same rules as generated resumes. [`lib/voice/rules.ts`](lib/voice/rules.ts) is the source of truth and [`tests/site-copy.test.ts`](tests/site-copy.test.ts) enforces it on the site.

- No em dashes anywhere.
- No filler: leverage, synergy, unlock, elevate, supercharge, delve, seamless, game-changer, and the rest of the list.
- Short sentences, contractions welcome, specific numbers over adjectives.
- Every AI output gets a visible "why": a breakdown, a reason, or a source fact.

## Components

- Primitives come from shadcn/ui (Radix base) in `components/ui/`. Restyle through tokens, not one-off overrides.
- Marketing sections live in `components/marketing/`. The interactive product demo is in `components/marketing/product-demo/` and reads from `lib/demo/sample-data.ts`, scored by the real rubric in `lib/fit/rubric.ts`.
