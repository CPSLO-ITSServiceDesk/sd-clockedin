# SD-ClockedIn

Time management for student assistants — clock in/out at the kiosk, manage schedules and terms in the admin dashboard, and review hours, punctuality, and timesheets.

## Microsoft Teams Shifts Integration

The backend can synchronize the roster, weekly schedules, and time off directly from Microsoft Teams Shifts via Microsoft Graph API, so schedules don't have to be imported from spreadsheets.

- Sync runs **once an hour on weekdays from 8:00 through 16:00** (org timezone) for the active term, right after an active term is saved, and on demand (`POST /api/teams-sync/sync-now`).
- Only members of the configured scheduling group (`TEAMS_SCHEDULING_GROUP`, default "Service Desk") are synced, and only **shared** (published) shifts and time off. Pending time-off requests aren't synced; an approved request appears once its time off is on the schedule.
- Sync only reads from Teams. The schedule builder can **send** shifts to Teams Shifts:
  - a whole new term schedule, or one person's change, for the weeks you choose
  - always as **drafts**, which a manager shares from Teams
  - ClockedIn picks shared shifts up on the next sync

To enable Teams integration, configure the Microsoft Graph environment variables in your backend `.env` file (see Environment variables below).

## What's in the repo

This is a **pnpm monorepo** with two packages:

| Package | Role | Local URL |
|---------|------|-----------|
| [`packages/frontend`](packages/frontend) | Next.js app (kiosk + admin UI) | http://localhost:3000 |
| [`packages/backend`](packages/backend) | Express API backed by Supabase | http://localhost:3001/api |

**Kiosk** (`/`) — live clock, who's clocked in, expected arrivals, who's out today, student clock in/out.

**Display** (`/display`) — full-screen view for a wall monitor: who's here, who's coming next, and who's out today with the hours they're off.

**Admin** (`/admin`) — Supabase Auth required:
- **Dashboard** with today's timeline and time off
- **Shifts**
- **Students:** roster with an edit panel
- **Terms**
- **Schedules:** team week editor
- **Schedule Builder** (`/admin/schedules/new`): current-schedule view, then import availability → rules → review → publish
- **Timesheet Verification**
- **Shift Normalization:** link orphaned clock-ins, fix odd clock-outs
- **Admin Access**
- **Term Analytics** and **Student Records**

`/admin/analytics/hourly-staffing` still exists but isn't in the sidebar.

For package-level detail, see [packages/frontend/README.md](packages/frontend/README.md) and [packages/backend/README.md](packages/backend/README.md).

## Prerequisites

- [Node.js](https://nodejs.org/) 24+
- [pnpm](https://pnpm.io/) 10+ (see `packageManager` in root `package.json`)
- A [Supabase](https://supabase.com/) project with the app schema
- (Optional) A Microsoft Entra ID tenant and Teams team for Shifts synchronization

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

# Microsoft Graph / Teams Shifts (optional). All four required to enable sync.
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
TEAMS_TEAM_ID=
# Optional; defaults to "Service Desk" if omitted.
TEAMS_SCHEDULING_GROUP=
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

pnpm --filter backend exec vitest run src/tests   # Backend unit tests (Vitest, same as CI)
pnpm --filter backend test:watch    # Tests in watch mode
pnpm --filter backend gen:types     # Regenerate Supabase TypeScript types
```

## CI/CD

The GitHub Actions workflow at [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes and pull requests targeting `main` or `staging`. It also handles Vercel's `vercel.deployment.ready` repository dispatch event.

The CI job:

1. Uses Node.js 24 and the pnpm version pinned in the root `package.json`
2. Installs dependencies from `pnpm-lock.yaml`
3. Runs the backend tests in `src/tests`
4. Builds the frontend and backend

For a Vercel repository dispatch, the workflow checks out the exact deployed commit and reports one project-specific build check:

- `Vercel - sd-clockedin: build`
- `Vercel - sd-clockedin-express-backend: build`

Deployments are handled externally by Vercel. After a deployment reports a successful GitHub deployment status, the workflow checks both deployed `/api/health` endpoints. The smoke test can also be started manually from the Actions tab by selecting a GitHub Environment.

Create `production` and, when applicable, `staging` under **GitHub → Settings → Environments**. Add these non-secret environment variables to each environment:

```text
FRONTEND_URL=https://sd-clockedin.vercel.app
BACKEND_URL=https://sd-clockedin-express-backend.vercel.app
```

Do not include `/api` or a trailing slash; the workflow appends `/api/health`. If a deployment provider does not publish GitHub deployment statuses, run the workflow manually after deployment.

Optionally add `SUPABASE_URL` under **GitHub → Settings → Secrets and variables → Actions → Variables**. Backend unit tests read this repository variable and otherwise use a local placeholder URL. They never receive the production service-role key.

Production health checks:

- [Frontend health](https://sd-clockedin.vercel.app/api/health)
- [Backend health](https://sd-clockedin-express-backend.vercel.app/api/health)

## How the pieces fit together

```
Browser (Next.js)  ──REST──▶  Express API  ──▶  Supabase (PostgreSQL)
       │                            │
       └── Supabase Auth ───────────┘   (admin login)
```

- **Schedules** belong to a term and student; each schedule has **blocks** (day + start/end time). A schedule can narrow its dates within the term (`start_date`/`end_date`), and terms list vacation days and swap days in `off_days`.
- **Time entries** record clock in/out, optionally linked to a schedule block. Replacing a student's blocks (Teams sync, spreadsheet import, schedule-builder publish) keeps unchanged blocks, so their time entries stay linked.
- **Time off** comes from Teams. Today's shifts match it against each shift's hours:
  - covering the whole shift marks it as time off for the day
  - partial time off trims the shift to the hours still worked, so nobody is marked late or absent for hours they're off
- **Auto clock-out** runs daily at `AUTO_CLOCK_OUT_TIME` in `ORG_TIMEZONE` and closes forgotten punch-outs.
- **Timesheet verification** shows monthly hours per student and lets admins sign off each month.
- **Shift normalization** matches orphaned time entries to schedule blocks for a term, and sets odd clock-outs to the scheduled shift end. Odd means never clocked out, still clocked in well after the shift, auto clocked out, next day, or long after the shift.
- **Schedule builder** turns a Microsoft Forms availability export into a draft schedule:
  - desk rules: hours, minimum on desk, a lead every hour, shift length, requested hours, budget
  - a generated draft you review by painting cells
  - publishing writes it to the term's schedules
- **Analytics** provides term- and student-level punctuality metrics and hourly headcount charts.
- **Microsoft Teams Shifts integration** synchronizes roster, schedule templates, and time off data (when configured).
- Clock-in logic picks the nearest matching block for the day; shift status (early, on-time, late, absent) is computed on the backend using the organization timezone. Remote shifts are never flagged late or absent.

API responses follow a consistent shape:

```json
{ "success": true, "data": { ... } }
```

Errors return `{ "success": false, "error": "..." }` with an appropriate HTTP status.

## Tech stack

**Frontend:** Next.js (App Router), React, Tailwind CSS, shadcn/ui, TanStack Query & Table, React Hook Form + Zod

**Backend:** Express, TypeScript, Supabase JS client, express-validator, Vitest, node-cron (for scheduled jobs), @microsoft/microsoft-graph-client, @azure/identity (for Microsoft Teams Shifts integration)

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
    │   ├── lib/           # API client, auth, Supabase, shift/schedule helpers
    │   └── proxy.ts       # Session refresh for admin auth
    └── backend/           # Express API
        ├── src/
        │   ├── routes/    # HTTP routes
        │   ├── controllers/
        │   ├── services/  # Business logic + Supabase
        │   ├── lib/       # Pure helpers (time, shifts, import, schedule builder, Teams)
        │   ├── jobs/      # Scheduled jobs (auto clock-out, Teams sync)
        │   ├── middleware/
        │   └── tests/
        └── supabase/
            ├── migrations/  # Forward SQL migrations (applied by hand)
            └── down/        # Matching rollbacks
```

## Contributing / extending

Typical flow for a new feature that touches data:

1. Schema change (if needed): add a migration in `packages/backend/supabase/migrations/` plus its rollback in `supabase/down/`, apply it in Supabase, then `pnpm --filter backend gen:types`
2. Rules and calculations as pure functions in `backend/src/lib/` with Vitest tests → backend service → controller → route
3. Frontend `lib/api/` wrapper → query hook → UI

For scheduled jobs (like auto clock-out):
1. Create job file in `backend/src/jobs/`
2. Implement job logic
3. Register job in `backend/src/index.ts`
4. Add environment variables and configuration
5. Add tests for the job logic

For Microsoft Teams Shifts integration:
1. Review Microsoft Graph API documentation for required permissions
2. Update environment variables in `.env.example` and documentation
3. Modify sync logic in `teamsSyncService.ts` or related adapter files
4. Update database schema if storing additional data
5. Add/update tests in `src/tests/` for Teams-specific functionality
6. Update frontend UI components if new configuration options are needed

After schema or API changes, run backend tests and smoke-test the affected admin or kiosk screens.

## License

Private — internal use.
