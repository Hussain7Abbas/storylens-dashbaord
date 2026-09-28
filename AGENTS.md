# Story Lens dashboard instructions

Standalone public repository, also pinned in the Story Lens umbrella at `apps/dashboard`. It is the admin dashboard for the Story Lens API: dashboard users, roles and permissions, novels and configs. Use Bun and Biome; `make help` lists commands. Umbrella guide: `docs/dashboard.md`.

## Stack and structure

- Vite + React 19 single-page app, React Router, TanStack Query and Axios; Tailwind v4 with the Ink & Iris tokens in `src/styles/globals.css`. Nginx serves the static `dist/` build; there is no Node server in production.
- `src/api/generated/` is the Orval client for the dashboard API only (`Admin: …` tags, `/api/admin`). Never edit it; regenerate with `make orval` against a running local backend (`ORVAL_API_URL`, default `http://localhost:3030`; the spec is off in production) and commit the output. `orval.config.ts` drops the `ApiAdmin` prefix from operation names (`getUsersById`). `src/api/axios-instance.ts` is the mutator: it adds the bearer token and signs out on 401.
- `src/lib/session.ts` keeps the session token in `localStorage` (`storylens-dashboard-token`); `src/lib/auth.tsx` loads `/api/admin/auth/me` and exposes `can(permission)`. `src/lib/permissions.ts` lists the dashboard permission keys (`METHOD /api/admin/...`), which must match the backend routes.
- `src/components/ui/` holds shared controls (buttons, fields, native dialogs, confirm dialogs, toasts, pagination, page states); `src/components/layout/app-shell.tsx` is the sidebar layout; `src/pages/` has one file per screen.
- Use strict TypeScript, named exports, no `any`, and no lint-suppression comments.

## Access rules

- The dashboard has sign-in only. Never add registration: dashboard accounts (portal `admin`) are created from the Users page (`POST /api/admin/users`) or by the backend seed (one super admin). Readers register from the extension and website.
- The API enforces every permission. The UI only hides pages and actions: guard routes with `Allow` in `src/app.tsx` and actions with `can(PERMISSIONS…)`, and show `Forbidden` rather than an empty page. When a backend admin route is added or renamed, update `src/lib/permissions.ts`, the generated client and the relevant page.
- A user can't change their own portal or role, delete themselves or remove the last super admin; the API refuses these and the UI does not offer them. The `super-admin` role always holds every admin permission and its list is read-only.

## Design

- Follow `design-system/MASTER.md`, which applies the website's Ink & Iris identity (`storylens-website` `design-system/MASTER.md`) to a dense admin layout. Use the tokens, Inter (self-hosted `@fontsource-variable/inter`), Lucide icons at 1.75 stroke with accessible names on icon-only buttons, visible 3px focus rings, and 44px targets on coarse pointers. Keep light, dark and system themes working, respect reduced motion, and avoid horizontal page scroll at 375px (tables scroll inside their card).
- Confirm destructive actions with `ConfirmDialog`, report results with toasts, and keep errors next to the form that caused them.
- The UI UX Pro Max skill is vendored in `.claude/skills/ui-ux-pro-max` (MIT). Query it for new screens; its palette and font suggestions never override Ink & Iris.

## Checks and deployment

- Run `bun run typecheck`, `bun run lint`, `bun run build` and `bun run test` (Playwright + axe against the production build with the API mocked in `tests/fixtures.ts`; set `CHROMIUM_PATH` to use a preinstalled Chromium).
- Production: https://storylens-dashboard.iscoded.com on the `ssh raseen` server. The checkout is `/srv/storylens-dashboard` on `main`; `make sync` (as root) fast-forwards, builds, atomically swaps `/var/www/storylens-dashboard/current`, installs `deploy/nginx/storylens-dashboard.iscoded.com.conf`, obtains the Let's Encrypt certificate on first run, checks the site and rolls back on failure. The Nginx CSP allows API calls only to `https://storylens-api.iscoded.com`; update it with `VITE_API_URL` (`.env.production`).
- Keep this file, `README.md` and the umbrella `docs/dashboard.md` current with changes.
