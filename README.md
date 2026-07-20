# SD-ClockedIn

Time management for student assistants — clock in/out at the kiosk, manage schedules and terms in the admin dashboard, and review hours, punctuality, and timesheets.

## What's in the repo

This is a **pnpm monorepo** with two packages:

| Package | Role | Local URL |
|---------|------|-----------|
| [`packages/frontend`](packages/frontend) | Next.js app (kiosk + admin UI) | http://localhost:3000 |
| [`packages/backend`](packages/backend) | Express API backed by Supabase | http://localhost:3001/api |

**Kiosk** (`/`) — live clock, who's clocked in, expected arrivals, student clock in/out.

**Display** (`/display`) — full-screen kiosk view for a wall monitor (clocked-in list and expected arrivals).

**Admin** (`/admin`) — terms, students, schedules, shift monitoring, student records, timesheet verification, shift normalization, analytics (term, student, group schedule), settings, and access control. Admin routes require Supabase Auth.

For package-level detail, see [packages/frontend/README.md](packages/frontend/README.md) and [packages/backend/README.md](packages/backend/README.md).

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+ (see `packageManager` in root `package.json`)
- A [Supabase](https://supabase.com/) project with the app schema

## Getting started

```bash
# From the repo root
pnpm install
```

### Environment variables

**Backend** — create `packages/backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
ORG_TIMEZONE=America/Los_Angeles
AUTO_CLOCK_OUT_ENABLED=true
AUTO_CLOCK_OUT_TIME=17:00
```

The API uses the **service role** key server-side so it can read and write data regardless of RLS policies. Never expose this key to the browser.

**Frontend** — create `packages/frontend/.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Verify the backend can reach Supabase:

```bash
pnpm --filter backend check
```

### Run locally

```bash
# Frontend + backend together
pnpm dev

# Or individually
pnpm --filter frontend dev
pnpm --filter backend dev
```

## Common commands

```bash
pnpm dev              # Start all packages in development
pnpm build            # Production build
pnpm start            # Start production servers
pnpm lint             # Lint all packages

pnpm --filter backend test          # Backend unit tests (Vitest)
pnpm --filter backend test:watch    # Tests in watch mode
pnpm --filter backend gen:types     # Regenerate Supabase TypeScript types
```

## How the pieces fit together

```
Browser (Next.js)  ──REST──▶  Express API  ──▶  Supabase (PostgreSQL)
       │                            │
       └── Supabase Auth ───────────┘   (admin login)
```

- **Schedules** belong to a term and student; each schedule has **blocks** (day + start/end time).
- **Time entries** record clock in/out, optionally linked to a schedule block.
- **Schedule date overrides** allow temporary modifications to specific schedule instances.
- **Auto clock-out** runs daily at `AUTO_CLOCK_OUT_TIME` in `ORG_TIMEZONE` and closes forgotten punch-outs.
- **Timesheet verification** aggregates hours by day for payroll review.
- **Shift normalization** matches orphaned time entries to schedule blocks for a term.
- **Analytics** provides term- and student-level punctuality metrics and hourly headcount charts.
- Clock-in logic picks the nearest matching block for the day; shift status (early, on-time, late, absent) is computed on the backend using the organization timezone.

API responses follow a consistent shape:

```json
{ "success": true, "data": { ... } }
```

Errors return `{ "success": false, "error": "..." }` with an appropriate HTTP status.

## Tech stack

**Frontend:** Next.js (App Router), React, Tailwind CSS, shadcn/ui, TanStack Query & Table, React Hook Form + Zod

**Backend:** Express, TypeScript, Supabase JS client, express-validator, Vitest, node-cron (for scheduled jobs)

**Database:** Supabase / PostgreSQL

## Project layout

```
sd-clockin/
├── package.json           # Workspace scripts
├── pnpm-workspace.yaml
└── packages/
    ├── frontend/          # Next.js app
    │   ├── app/           # Routes (kiosk, display, admin)
    │   ├── components/    # UI and feature components
    │   ├── hooks/         # React Query hooks
    │   ├── lib/           # API client, auth, Supabase helpers
    │   └── proxy.ts       # Session refresh for admin auth
    └── backend/           # Express API
        └── src/
            ├── routes/    # HTTP routes
            ├── controllers/
            ├── services/  # Business logic + Supabase
            ├── lib/       # Shared helpers (time, shifts, import)
            ├── jobs/      # Scheduled jobs (auto clock-out)
            ├── middleware/
            └── tests/
```

## Contributing / extending

Typical flow for a new feature that touches data:

1. Schema change in Supabase (if needed) → `pnpm --filter backend gen:types`
2. Backend service → controller → route
3. Frontend `lib/api/` wrapper → query hook → UI

For scheduled jobs (like auto clock-out):
1. Create job file in `backend/src/jobs/`
2. Implement job logic
3. Register job in `backend/src/index.ts`
4. Add environment variables and configuration
5. Add tests for the job logic

After schema or API changes, run backend tests and smoke-test the affected admin or kiosk screens.

## License

Private — internal use.
