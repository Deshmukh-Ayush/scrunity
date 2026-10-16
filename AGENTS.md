<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:database-migration-rules -->
# Database Schema & Migration Protocol

- **NEVER use `drizzle-kit push` (`npm run db:push`) against the live production database.**
- Schema drift must never recur. All database schema changes MUST follow the versioned migration protocol:
  1. Modify `src/db/schema.ts`
  2. Generate a migration: `npm run db:generate` (creates a numbered SQL migration in `./drizzle` and updates snapshot in `./drizzle/meta`)
  3. Apply migration: `npm run db:migrate` (runs migration safely through Drizzle's `__drizzle_migrations` tracking engine)
- Always check that new tables, foreign keys, and indexes are cleanly reflected in the generated `.sql` file before applying.
- **Do not delete or rewrite historical migration files (`0000`, `0001`, `0002`, etc.)** — migrations represent immutable linear history recorded in `drizzle/meta/_journal.json` and tracked in `drizzle.__drizzle_migrations`.
<!-- END:database-migration-rules -->

<!-- BEGIN:render-architecture-rules -->
# Render Architecture Rules

- **`layout.tsx` files must contain zero business logic, zero `await` calls, and zero database queries.** Layouts serve purely as structural chrome, shell UI, and provider containers.
- **`page.tsx` files must contain only structural markup.** Any data-dependent section must be encapsulated in its own distinct child Server Component (see Architecture Rules 3 and 6 below — do not add `<Suspense>` boundaries without flagging first).
- **`page.tsx` is NEVER a Client Component.** Page roots must remain React Server Components (RSC) to preserve streaming, metadata, and server-side cache boundaries.
- **Authorization is resolved in `src/proxy.ts`, NOT in React layouts.** Route protection, role verification, and redirect policies execute at the proxy/middleware layer before any React rendering begins, eliminating layout-level DB waterfalls and client-side flash.
<!-- END:render-architecture-rules -->

<!-- BEGIN:architecture-rules -->
# Architecture Rules (binding — do not violate without flagging it first)

These take precedence over the Render Architecture Rules above wherever the two differ (notably Suspense — see rule 6).

1. **Every route folder under `src/app/` contains ONLY `page.tsx`, plus `layout.tsx` if genuinely needed.** No route-level `error.tsx`, `loading.tsx`, or `not-found.tsx` — those are handled once, at the root. No stray components inside route folders. If a route genuinely seems to need its own error/loading state, flag it and ask rather than silently adding the file.
2. **`page.tsx` is NEVER marked `"use client"`.** Pages are Server Components, always.
3. **`page.tsx` may read session/auth state and render static/structural content inline** (copy, labels, layout shell). It must NOT fetch data itself — no direct DB queries, no direct API/`fetch` calls for dynamic data. Data fetching belongs in dedicated child Server Components, not in the page or the layout.
4. **New components follow the Vercel components.build conventions.** Install the guide with `npx skills add https://github.com/vercel/components.build --skill building-components` and follow its composition pattern (compound components, `asChild`, data attributes, accessibility, design tokens, states, typed polymorphism) instead of inventing a different component shape. A component built this way (e.g. `Accordion.Root/Item/Trigger/Content`) may be a client component internally and still be rendered directly inside a server `page.tsx` — that does NOT make the page a client component.
5. **No request waterfalls.** Don't nest components so that each one's fetch blocks on its parent's render when the data doesn't depend on it. Start independent fetches in parallel (`Promise.all`).
6. **Avoid React `<Suspense>` boundaries for now.** Prior Suspense use here caused real problems (not yet root-caused). Don't use Suspense as the default loading-state tool; if a situation seems to architecturally require it, flag it explicitly and ask rather than adding it silently.
7. **Keep files to roughly 300–400 lines.** A practical ceiling against bloat, not a hard wall — a genuinely complex, cohesive unit may run over, but routine files (most components, most route handlers) shouldn't.
8. **Write for human readability over cleverness.** Someone unfamiliar with a file should be able to follow it without re-reading it twice.
9. **Don't default every interactive element to the brand/primary color.** Most buttons/elements should be neutral; reserve brand color for genuine primary actions.
<!-- END:architecture-rules -->

<!-- BEGIN:workflow-rules -->
# Workflow Rules

- **Never commit or push automatically.** Leave all changes unstaged in the working tree unless explicitly told to commit (and only push when explicitly told to push).
- **No claims without evidence.** Never report a fix or feature as working without real verification: actual command output (typecheck, lint, build), a real run of the relevant test/verification script, or an actual rendered check of the UI. If something could not be verified, say so explicitly rather than implying it works.
<!-- END:workflow-rules -->



<!-- BEGIN:design-rules -->
# Design Rules

Full reference: `docs/design-system.md`. Every component is shown at `/playground/components/document/testing` (platform admins only); register new showcase components in `src/components/playground/registry/`.

- **Never use a raw hex value in a component.** Tailwind's `neutral` and `gray` scales are allowed; brand and status colors only through their variables (`bg-brand`, `text-success`, `bg-danger-tint`, …). Text colors are `text-fg-strong|default|muted|subtle`.
- **Brand (`--brand`) is only for brand button backgrounds and focus rings** (one shared `focus-ring` recipe; 2.59:1 on white, accepted by the founder). Never text, icons, badges, selected states or decoration. At most one brand button per view, never inside repeated rows or lists; most views have none. `--primary` is neutral ink, not brand.
- **Green is reserved for verified and completed states.** Other progress states (replied, sent) are neutral with an icon.
- **Motion:** `--motion-*` tokens for micro-interactions (press, hover); the transitions skill's tokens for real animations.
- **Surfaces use the three shadow tokens instead of borders:** `shadow-surface` (flat), `shadow-raised` (small controls), `shadow-floating` (popovers, menus, dialogs, composer). Real borders only on form fields, single-side dividers and dashed placeholders.
- **Never signal status with color alone.** Pair it with a label or an icon.
- **No `transition: all`.** Use the transitions.dev skill (`.agents/skills/transitions-dev`) for animations; animations under `motion-safe`, hover styles only where hover exists.
- **Icons come from `@/components/ui/icons`** (Hugeicons free). Lucide and Phosphor are not used.
- **Type uses the scale utilities** `text-title|composer|section|body|meta`, not raw sizes.
- **Use `Container`** (`src/components/layout/container.tsx`) for page width. It has no background:
  - `width="prose"` (max 720px): chat and the agent composer.
  - `width="page"` (default, `max-w-7xl`): settings and forms.
  - `width="full"` (no max width): CRM tables, which use the full width.
<!-- END:design-rules -->
