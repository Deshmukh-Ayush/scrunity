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
- **`page.tsx` files must contain only structural markup.** Any data-dependent section must be encapsulated in its own distinct component wrapped in its own React `<Suspense>` boundary with a purpose-built loading skeleton.
- **`page.tsx` is NEVER a Client Component.** Page roots must remain React Server Components (RSC) to preserve streaming, metadata, and server-side cache boundaries.
- **Authorization is resolved in `src/proxy.ts`, NOT in React layouts.** Route protection, role verification, and redirect policies execute at the proxy/middleware layer before any React rendering begins, eliminating layout-level DB waterfalls and client-side flash.
<!-- END:render-architecture-rules -->


