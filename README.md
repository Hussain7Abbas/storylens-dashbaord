# Story Lens Dashboard

Admin dashboard for [Story Lens](https://storylens.iscoded.com): manage dashboard and reader accounts, roles and their per-endpoint permissions, the novel catalogue and runtime configs.

- Production: https://storylens-dashbaord.iscoded.com
- API: the Story Lens backend's `/api/admin` routes (`storylens-backend`).
- Part of the [Story Lens umbrella repository](https://github.com/Hussain7Abbas/storylens) at `apps/dashboard`.

## Access model

One account (one email, username and password) can have **reader access** (`isUser`: the extension, website and desktop client) and/or **dashboard access** (`isAdmin`: this dashboard), with a **role** for each. A role is a list of **permissions**. Sign-in tokens are issued per API, so a reader token never opens the dashboard. The backend creates one permission per API endpoint (`GET /api/admin/users/`, `POST /api/user/keywords/`, …) plus the `user:moderate` capability, and syncs them from its routes on startup. The seeded **Super Admin** role always holds every dashboard permission.

The dashboard has no sign-up. The backend seed gives `DASHBOARD_ADMIN_EMAIL` super-admin dashboard access (`make seed-dashboard-admin` in the backend): an existing reader account with that email keeps its password and reader access; otherwise a dashboard-only account is created from `DASHBOARD_ADMIN_USERNAME` and `DASHBOARD_ADMIN_PASSWORD`. Everyone else gets dashboard access on the Users page.

## Development

```bash
cp .env.example .env      # VITE_API_URL=http://localhost:3030
bun install
bun run dev               # http://localhost:3040
```

Run the backend locally (`make dev` in `storylens-backend`). Other commands:

| Command | Purpose |
| --- | --- |
| `bun run typecheck` / `bun run lint` | TypeScript and Biome |
| `bun run build` | Static build in `dist/` |
| `bun run test` | Playwright + axe tests with a mocked API |
| `bun run orval` | Regenerate `src/api/generated/` from a running backend (`ORVAL_API_URL`) |
| `make sync` | On the server: pull `main`, build and activate a release |

## Deployment

The server checkout lives at `/srv/storylens-dashbaord` on branch `main`. As root, `make sync` builds with Bun (Vite runs on the Node LTS in `/opt/storylens-node/bin`), copies `dist/` into a timestamped release under `/var/www/storylens-dashbaord/releases`, swaps the `current` symlink, installs the Nginx site from `deploy/nginx/`, requests a Let's Encrypt certificate on the first run, checks `https://storylens-dashbaord.iscoded.com/login` and rolls back on failure. The DNS record is a proxied Cloudflare A record to the same server as the website.

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md). The vendored UI UX Pro Max skill in `.claude/skills/ui-ux-pro-max` is MIT-licensed (see its `LICENSE`).
