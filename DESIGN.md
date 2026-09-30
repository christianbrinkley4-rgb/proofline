# Design system

Proofline should feel like a warm, capable coach that happens to be very precise: light, calm surfaces with a little morning light in them, one expressive display face, and exactly one thing to do next on every screen. Green still means one thing: confirmed, or worth your time.

Tokens live in [`app/globals.css`](app/globals.css). Use the semantic Tailwind classes below, not raw colors.

## Color

| Role | Class | Use it for |
| --- | --- | --- |
| Text | `text-foreground` | Headings, primary text |
| Secondary text | `text-muted-foreground` | Body copy, descriptions |
| Tertiary text | `text-subtle-foreground` | Meta lines, labels, timestamps |
| Surfaces | `bg-background`, `bg-muted` | Pages, panels, stages |
| Lines | `border` (default), `border-border-strong` | Dividers, cards, hover borders |
| **Accent** | `bg-brand`, `text-brand-ink`, `bg-brand-soft` | "Confirmed", fit bars, finished steps, focus rings |
| **Pending** | `bg-pending`, `text-pending-ink`, `bg-pending-soft` | Something waiting on the user: an unconfirmed fact, the "why" only they can write, a follow-up that's due |
| **Ink** | `bg-ink`, `text-ink-foreground`, `text-ink-muted` | Primary buttons (via `bg-primary`), step numbers, the current step, the dark coach band |

Rules:

- Neutrals lean slightly green (hue about 160, very low chroma). Never zinc-blue or purple.
- One accent. If a green element doesn't mean "confirmed" or "worth your time", make it neutral.
- Amber is a status, not a second brand color.
- Primary buttons are deep forest ink (`bg-primary`), never green.

### Dark mode

Light is the default. People choose Dark or Match my device under Settings, Appearance (`components/theme/theme-choice.tsx`, stored by next-themes). The `.dark` tokens keep the same green-leaning family; primary buttons invert to pale mint. Because every surface uses semantic tokens, new UI gets dark mode for free: never use `bg-white`, `text-black`, or palette colors like `zinc-500`. Two exceptions stay fixed on purpose: the resume page preview is always white paper, and the terminal-style search log is always dark. Check new screens in both with `node scripts/screenshots.mjs` (light and dark, desktop and 390px, with an overflow check).

## Atmosphere

We used to ban gradients. We now allow one kind, on purpose: soft washes of light that make hero and coach moments feel warm instead of flat.

- `atmosphere`: three low-chroma washes (mint, sky, pale sun) for the landing hero and closing band only.
- `atmosphere-soft`: one corner of mint and sky, for coach cards, vignettes, and the top of app pages (at low opacity with a fade mask).
- `grain`: a film-grain layer that sits under content so washes never band. Needs a positioned element.
- `shadow-lift`: the one soft shadow for raised surfaces (the coach card, the product stage). Never stack shadows.

Still banned: purple or indigo glows, neon, glassmorphism panels, dark mode by default, and gradient text. The sticky header's light blur remains the only blur.

## Type

- **Display**: Bricolage Grotesque (`font-display`), for page titles, section headings, the coach's current step, and big numbers. Tight tracking and `text-wrap: balance` are built into the utility.
- **Body**: Geist Sans. **Mono**: Geist Mono, for small eyebrows and step numbers only.
- Body: 15 to 18px, `leading-6`/`leading-7`, `text-pretty`. Numbers that change or compare: `tabular-nums`.

## The coach pattern

Every signed-in screen answers "what do I do now?" with one primary action.

- The loop is Your resume, Paste a job, 3 resumes, Close gaps ([`lib/agent/coach.ts`](lib/agent/coach.ts)). Cover letter, tracking, and prep come after. Today shows it as a rail with one action card, and the paste box sits inside the card when pasting is the step (`components/coach/journey-rail.tsx`).
- One `size="xl"` primary button per screen. Everything else is `ghost` or `outline` and sits after it.
- Sequences (the packet) use `StepSection`: the current step is open and lifted; done steps collapse to one line with a green check; extras sit below under "When you need them".
- Empty states are a single coach entry with a few clear choices, never every tool at once (`components/coach/story-start.tsx`).
- The coach explains why in one sentence under every action.

## Spacing and layout

- 8pt grid with 4pt half-steps for tight UI.
- Page gutter is `container` from [`components/marketing/section.tsx`](components/marketing/section.tsx): 16px on phones, 24px from `sm`, content capped at 72rem. `wideContainer` (84rem) is for the hero's product stage only.
- Sections: `py-20 sm:py-28`, separated by space and surface changes rather than hairlines.
- Radius: cards `rounded-2xl`, inner items `rounded-xl`/`rounded-lg`.
- Everything must work at 375px wide with no horizontal page scroll. Grid items that hold truncating text need `min-w-0`.

## Motion

Three product motions, all behind `motion-safe:`, none looping:

- `animate-rise`: 640ms fade and 14px rise for hero and coach moments. Stagger with `[animation-delay:…]` or `stagger-in` on a parent.
- `animate-draw`: an SVG stroke with `pathLength="1"` and `proof-stroke` draws itself once (the finish check).
- `animate-bar-grow`: 700ms fill for score bars and finished rail segments.

Plus `animate-view-in` (260ms) for plain view changes.

A big score counts up once with `count-up` (400ms): put the real number in an `sr-only` span and set `--to` on an `aria-hidden` sibling. It's pure CSS, so the server-rendered page never flashes, and reduced motion shows the final number.

Onboarding gets its own small set so answering the first questions feels alive: `animate-step-forward`/`animate-step-back` slide a step in from the direction you're moving, `animate-word-in` settles the agent's sentence in word by word (screen readers get the whole sentence), `animate-ring-out` sends one ring off the agent's avatar, the progress bar fills with a width transition, and choice cards stagger in. The flow container uses `overflow-x-clip` so slides never cause sideways scroll.

## Copy

Same rules as generated resumes. [`lib/voice/rules.ts`](lib/voice/rules.ts) is the source of truth and [`tests/site-copy.test.ts`](tests/site-copy.test.ts) enforces it on the site, coach components, and coach copy in `lib/agent`.

- No em dashes anywhere.
- No filler: leverage, synergy, unlock, elevate, supercharge, delve, seamless, game-changer, and the rest of the list.
- Short sentences, contractions welcome, specific numbers over adjectives. The coach speaks in the first person ("I'll search…") and gives the reason.
- Every AI output gets a visible "why": a breakdown, a reason, or a source fact.

## Components

- Primitives come from shadcn/ui (Radix base) in `components/ui/`. Restyle through tokens, not one-off overrides.
- Marketing sections live in `components/marketing/`: hero with the interactive product demo as its visual, the six-step walkthrough, the coach band, the bullet walkthrough, pricing, FAQ, closing band. The demo reads from `lib/demo/sample-data.ts`, scored by the real rubric in `lib/fit/rubric.ts`.
- Coach components live in `components/coach/`.
