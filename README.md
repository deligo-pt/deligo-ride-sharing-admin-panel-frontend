# DeliGo Ride Sharing Admin — prototype

A clickable **frontend-only prototype** of the DeliGo Ride Sharing Admin Panel, built to review the
product before the backend exists. Every module and action in the requirements works against
realistic **sample data inside the app** — there is no backend, no API key and no environment
variable.

- Requirements: `../DeliGo Ride Sharing Admin Panel.md`
- Build plan and progress: `../ride_plan.md`

## Run locally

Requires Node.js 20.9+ (22 recommended, see `.nvmrc`) and pnpm (version pinned in `package.json`;
`corepack enable` sets it up).

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

| Script           | What it does                                |
| ---------------- | ------------------------------------------- |
| `pnpm dev`       | Development server                          |
| `pnpm build`     | Production build (exactly what Vercel runs) |
| `pnpm start`     | Serve the production build                  |
| `pnpm typecheck` | TypeScript, no emit                         |
| `pnpm lint`      | ESLint                                      |
| `pnpm format`    | Prettier                                    |

## Demo access

The login page lists one demo account per role (plus a disabled and an invited account to show
the error messages). Click one to fill the form — **any password works**, and accounts with two-step
verification ask for the code **`123456`**. "Forgot password?" shows the reset link on screen
instead of e-mailing it.

Sessions end after 30 minutes without activity; the switch under the demo accounts shortens that
to 1 minute to show the "session expired" flow. "Preview as role" in the account menu (top right)
shows how each role sees the panel.

## Deploy on Vercel

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New → Project → Import** the repository.
3. Framework preset: **Next.js** (auto-detected). Root directory: the folder containing this
   `package.json`. Leave build/install commands and environment variables empty.
4. **Deploy.**

No `vercel.json` or environment variables are needed. pnpm install-script decisions are recorded
in `pnpm-workspace.yaml`, so the install does not stop on Vercel.

## Tech

Next.js 16 (App Router) · React 19 · TypeScript 5.9 (strict) · Tailwind CSS 4 · shadcn/ui (Radix) ·
TanStack Query/Table/Virtual · nuqs · next-intl (PT/EN) · React Hook Form + Zod · Recharts ·
MapLibre · Faker (pt_PT). Exact versions and conventions: `../ride_plan.md` §B–§G.
