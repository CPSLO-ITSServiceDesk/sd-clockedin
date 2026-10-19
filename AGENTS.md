# AGENTS.md

This file provides guidance to Codex and other coding agents when working with code in this repository. Keep it in sync with `CLAUDE.md`.

## Overview

This is a monorepo managed by pnpm containing two packages:
- `frontend`: A Next.js 16.2.9 application with React 19
- `backend`: A Node.js Express API with TypeScript, connected to Supabase

The frontend uses Tailwind CSS for styling and incorporates shadcn/ui components via Radix UI primitives.
For state management, the frontend uses React Query (@tanstack/react-query) and React Table (@tanstack/react-table).

The application includes API documentation via Scalar/Swagger and enhanced CI/CD workflows for Vercel deployment.
Additionally, the backend integrates with Microsoft Teams Shifts via Microsoft Graph API to synchronize student schedules, shift templates, and time off data.

## Development Commands

### Package Management
```bash
# Install all dependencies
pnpm install

# Update lockfile without installing
pnpm store prune
```

### Development Server
```bash
# Start both frontend and backend
pnpm dev

# Start only frontend
pnpm --filter frontend dev

# Start only backend
pnpm --filter backend dev
```

### Building
```bash
# Build all packages
pnpm build

# Build only frontend
pnpm --filter frontend build

# Build only backend
pnpm --filter backend build
```

Don't run `pnpm --filter frontend build` while the frontend dev server is running: both write to `packages/frontend/.next`, and the dev server can be left serving stale Tailwind CSS (new classes and CSS variables silently missing) until it's restarted. Prefer `pnpm --filter frontend exec tsc --noEmit -p .` plus `pnpm --filter frontend lint` to check frontend changes.

`packages/backend/dist/` is checked in. `pnpm --filter backend build` rewrites it; don't leave unrelated `dist/` churn in a change. Use `pnpm --filter backend exec tsc --noEmit -p .` to type-check instead.

### Production Server
```bash
# Start all packages in production
pnpm start

# Start only frontend
pnpm --filter frontend start

# Start only backend
pnpm --filter backend start
```

### Code Quality
```bash
# Lint all packages
pnpm lint

# Lint only frontend
pnpm --filter frontend lint

# Lint only backend
pnpm --filter backend lint

# Fix auto-fixable lint errors
pnpm lint --fix
```

### Testing (Backend Only)
```bash
# Run the source backend tests (same as CI)
pnpm --filter backend exec vitest run src/tests

# Run backend tests in watch mode
pnpm --filter backend test:watch

# Run a specific test file
pnpm --filter backend exec vitest run src/tests/<filename>.test.ts
```

Plain `pnpm --filter backend test` also picks up the compiled copies in `dist/tests`, which fail under Vitest; scope runs to `src/tests`.

### Database & Type Generation
```bash
# Regenerate Supabase TypeScript types
pnpm --filter backend gen:types

# Verify Supabase connection
pnpm --filter backend check

# Run auto clock-out job once (manual)
pnpm --filter backend auto-clock-out
```

### Frontend-Specific
```bash
# Clear Next.js cache
pnpm --filter frontend exec next cache clear
```

## Architecture & Patterns

### Backend Architecture
- **Express.js** with TypeScript for the API server
- **Supabase** as the primary database with PostgREST API
- **Modular structure** following feature-based organization:
  - `src/routes/` - API route definitions with Express.Router
  - `src/controllers/` - Request handlers coordinating between services and responses
  - `src/services/` - Business logic and direct Supabase interactions
  - `src/lib/` - Shared, mostly pure helpers (Supabase client, org timezone, shift status, import parsing, Teams adapters, time off coverage, block diffing, clock-out fixes)
  - `src/lib/scheduleBuilder/` - Schedule builder logic: Forms availability parser, roster matching, draft generator, half-hour slot model
  - `src/jobs/` - Cron jobs (auto clock-out, Teams sync)
  - `src/middleware/` - Custom Express middleware (error handling, validation, CORS)
  - `src/scripts/` - Utility scripts (connection testing, manual auto clock-out)
  - `supabase/migrations/` + `supabase/down/` - SQL migrations and their rollbacks

#### Key Patterns:
1. **CRUD Consistency**: All resources follow the same pattern (terms, studentAssistants, schedules, etc.)
   - Routes use express-validator for input validation
   - Controllers handle HTTP concerns and delegate to services
   - Services contain Supabase queries and business logic
   - Automatic 404 handling for missing resources in services
   - Consistent error handling via HttpError class and centralized error handler

2. **Pure logic in `src/lib/`, I/O in services**: anything with real rules (draft generation, availability parsing, clock-out fix detection, time off coverage, Teams collapse) lives in `src/lib/` as pure functions with Vitest coverage; services load data and write results. Follow this split for new logic.

3. **Microsoft Teams Integration** (Optional):
   - Synchronizes roster, schedule templates, and time off from Teams Shifts via Microsoft Graph API
   - Uses dedicated services: teamsSyncService, teamsSyncStatusService, studentTimeOffService
   - Runs hourly (`src/jobs/teamsSync.ts`, cron `0 * * * *`) for the active term, after an active term is saved, and on demand via `POST /api/teams-sync/sync-now`
   - Only members of the `TEAMS_SCHEDULING_GROUP` scheduling group are synced, and only **shared** (published) shifts and time off. Pending/declined time-off *requests* are not synced; an approved request shows up once its time off is in the schedule.
   - Time off outside the term's dates isn't stored
   - Writes blocks through `replaceScheduleBlocks`, which keeps time entries linked (see Schedule Management Flow)
   - The Graph client is read-only (`get`/`getCollection`); nothing in the app writes to Teams

4. **Database Interaction**:
   - Direct Supabase client usage throughout services
   - Consistent error handling converting PostgREST errors to HttpError
   - Use of `.single()` for single-record queries with PGRST116 error handling
   - Proper ordering and filtering in queries
   - Tables added by a migration that may not be applied yet: treat PostgREST `PGRST205` / Postgres `42P01` as "not set up" (503 or a feature flag) rather than a 500. See `timesheetService` and `scheduleDraftService`.

5. **API Response Format**:
   ```json
   {
     "success": boolean,
     "data": null | object | array,
     "error": string | undefined
   }
   ```
   - 204 No Content for successful deletions
   - Appropriate HTTP status codes for different operations
   - JSON bodies are limited to 1 MB (schedule drafts carry every student's availability)

### Frontend Architecture
- **Next.js 16** with App Router (`app/` directory)
- **Supabase Auth** for admin login (`lib/supabase/`, `lib/auth/`, `proxy.ts` for session refresh)
- **React Query** for server state management and caching
- **React Table** for complex table UIs with sorting, filtering, pagination
- **React Hook Form** with Zod for form validation
- **Shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** for utility-first styling

#### Key Patterns:
1. **API Layer**:
   - Centralized `apiFetch` wrapper in `lib/api/client.ts`; use `apiUpload` from the same file for multipart file uploads (sends the auth token, lets the browser set the boundary)
   - Automatic JSON serialization/deserialization
   - Consistent error handling transforming API errors to thrown exceptions
   - Resource-specific modules (`lib/api/terms.ts`, etc.) wrapping API endpoints

2. **React Query Integration**:
   - Query keys centralized in `lib/query-keys.ts`
   - Custom hooks encapsulating query logic (`use-*.ts` files)
   - Automatic refetching intervals for real-time data (e.g., today shifts)
   - Optimistic updates where appropriate

3. **Data Transformation**:
   - Mapper functions in `lib/schedules/` for converting between API and UI formats
   - Today's shifts, kiosk/display boards and dashboard timeline helpers in `lib/shifts/`
   - Schedule builder model, checks and the live-schedule week builder in `lib/schedule-builder/`
   - Consistent TypeScript interfaces matching Supabase types
   - Proper handling of nullable fields and JSONB columns

4. **Component Organization**:
   - Reusable UI components in `components/` (shadcn/ui based)
   - Admin feature components in `components/admin/<feature>/`; kiosk in `components/kiosk/`, wall display in `components/display/`
   - Custom hooks in `hooks/` directory
   - Utility functions in `lib/` directory

5. **Styling tokens**: colors come from CSS variables in `app/globals.css` (light and `.dark`), exposed to Tailwind via `@theme inline`. Use the semantic classes (`bg-card`, `text-muted-foreground`, `bg-accent/15`, ...) and the schedule-builder role tokens (`bg-role-lead`, `bg-role-main`, `bg-role-training`, `bg-avail`) instead of hard-coded hex values. Amber (`amber-500/15` + `text-amber-800 dark:text-amber-200`) is the warning tone.

### API Documentation
The backend includes API documentation via Scalar and Swagger:
- **Scalar API Explorer**: Available at `/api-docs` in development and production
- **Swagger JSON**: Available at `/api-docs/json`
- Documentation is automatically generated from JSDoc comments in route files
- Configured to work with Vercel serverless deployments

### Database Schema Overview
The Supabase database contains these tables:
- `academic_term`: School terms/semesters, with `off_days` JSONB (vacations and special-schedule swap days)
- `student_assistant`: Student worker information, including `entra_user_id` (Microsoft Entra ID, for Teams integration)
- `schedules`: A student's schedule for a term, with optional `start_date`/`end_date` overrides
- `schedule_blocks`: Weekly shift blocks within schedules (day, start/end time, remote flag)
- `time_entry`: Clock-in/clock-out records, optionally linked to a schedule block
- `admins`: System administrators
- `student_time_off`: Time off synced from Teams Shifts, per student and term
- `teams_sync_status`: Last Teams sync result per term
- `timesheet_verification`: Months an admin marked a student's timesheet verified
- `schedule_draft`: Schedule builder drafts (rules, people with availability and assignments, unmatched form responses, change log) as JSONB

Migrations live in `packages/backend/supabase/migrations/` (forward) and `supabase/down/` (rollback), named `<timestamp>_<name>.sql`. Each file's header lists its revision, the revision it depends on, and how to apply it (Supabase SQL editor or `supabase db query --linked -f <file>`); they're applied by hand, not pushed automatically. After adding one, update `src/types/database.types.ts` (run `gen:types`, or hand-edit to match if you can't connect).

**Additional features:**
- Auto clock-out runs daily at `AUTO_CLOCK_OUT_TIME` in `ORG_TIMEZONE` via a cron job in `src/jobs/autoClockOut.ts`; it closes every open entry at that time, including stale ones from earlier days
- Analytics endpoints under `/api/analytics` serve term- and student-level punctuality metrics
- Timesheet verification under `/api/timesheet`: monthly hours per student and month sign-off
- Shift normalization under `/api/normalization`:
  - matches orphaned time entries to schedule blocks
  - flags odd clock-outs on linked entries and sets them to the scheduled shift end (`src/lib/clockOutFixes.ts`). "Odd" means: never clocked out on a past day, still clocked in today 30+ min after the shift ended, closed by auto clock-out after the shift ended, closed on a later day, 30+ min after the shift end, or before the clock-in
- Schedule builder under `/api/schedule-drafts` (frontend `/admin/schedules/new`):
  - import a Microsoft Forms availability export (CSV/XLSX)
  - set desk rules and generate a rule-based draft
  - review/paint it
  - publish it to `schedules`/`schedule_blocks`
  - The page opens on a read-only "current schedule" view of the live term.
  - Publishing doesn't write to Teams; with Teams sync on, the next sync overwrites published blocks for anyone on the Teams roster.
- Microsoft Teams Shifts integration synchronizes roster, schedule templates, and time off data

### Key Integration Points
1. **Frontend → Backend Communication**:
   - Frontend expects API at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api`)
   - All API calls go through the typed `apiFetch` wrapper
   - React Query handles caching, deduplication, and background updates

2. **Schedule Management Flow**:
   - Schedules contain multiple Schedule Blocks (shift templates)
   - Time entries reference either a Schedule Block or have custom times
   - `replaceScheduleBlocks` (`scheduleImportService`, used by Teams sync, spreadsheet import and schedule-builder publish) diffs incoming blocks against existing ones by day + start + end (`src/lib/diffScheduleBlocks.ts`):
     - unchanged blocks keep their ids, so linked time entries stay linked
     - a remote-flag change updates in place
     - only removed blocks are deleted
   - Deleting a block calls `clearScheduleBlockReferences`, which nulls `time_entry.schedule_block_id` but keeps the entry
   - The Schedules page editor (`frontend/lib/schedules/persistence.ts`) still deletes and recreates a student's blocks on save, which unlinks their entries
   - Schedule `start_date`/`end_date` overrides narrow when a schedule applies within its term
   - Auto clock-out functionality automatically clocks out students who forget to clock out
   - Microsoft Teams Shifts integration synchronizes roster, schedule templates, and time off data

3. **Time Off on Today's Shifts** (`todayShiftsService`, used by the dashboard, kiosk and `/display`):
   - Time off is matched against each shift's own hours on that date, not just the current instant (`timeOffForShift` in `src/lib/timeOffCoverage.ts`):
     - Time off covering the whole shift → listed in `timeOffShifts`, not expected, all day
     - Partial time off → the shift is trimmed to the hours still worked (8–11 with 10–11 off is expected 8–10; with 8–9 off it's expected from 9, so it isn't marked late)
     - While the time off is happening, the shift is in `timeOffShifts`
   - `todayTimeOff` lists every time off overlapping today, including ones that already ended. The kiosk and `/display` "Out today" lists are built from it. Labels read "All day" only when the day is fully covered, otherwise "10:00 – 11:00 AM", "Until 1:00 PM" or "From 2:00 PM".
   - `upcomingTimeOff` covers now through the next 14 days
   - Campus vacation days (`academic_term.off_days.vacations`) drop scheduled blocks entirely
   - Remote staff don't clock in; remote shifts are never flagged absent/late

4. **State Synchronization**:
   - React Query automatically refetches data after mutations
   - Optimistic UI updates in some cases (e.g., schedule block creation)
   - Polling every 30s for today's shifts; `GET /api/shifts/today` is cached in Redis for 15s when configured
   - Enhanced analytics with punctuality metrics and hourly headcount charts with location filtering

### Environment Variables
**Backend** (`.env` in `packages/backend/`):
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (for server-side operations)
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)
- `FRONTEND_URL`: CORS allowed origin(s), comma-separated (defaults to `http://localhost:3000`)
- `ORG_TIMEZONE`: IANA timezone for shift logic and auto clock-out (default: `America/Los_Angeles`)
- `AUTO_CLOCK_OUT_TIME`: Daily auto clock-out time in HH:mm format (default: `17:00`)
- `AUTO_CLOCK_OUT_ENABLED`: Enable/disable auto clock-out feature (default: `true`)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST credentials (optional; enables caching for `/api/shifts/today`)
- `KV_REST_API_URL` / `KV_REST_API_TOKEN`: Vercel KV equivalents of the above (either pair works; caching is disabled if neither pair is fully set). `KV_URL` / `REDIS_URL` are not used (TCP, not REST).
- **Microsoft Teams Integration** (optional; sync is enabled only when the first four are all set):
  - `MICROSOFT_TENANT_ID`: Microsoft Entra tenant ID
  - `MICROSOFT_CLIENT_ID`: Microsoft Entra application client ID
  - `MICROSOFT_CLIENT_SECRET`: Microsoft Entra application client secret
  - `TEAMS_TEAM_ID`: Microsoft Teams team ID to synchronize with
  - `TEAMS_SCHEDULING_GROUP`: Name of the scheduling group within the team (defaults to 'Service Desk')

**Frontend** (`.env` in `packages/frontend/`):
- `NEXT_PUBLIC_API_URL`: Base URL for API calls (must include `/api` suffix)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL (admin auth)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key (admin auth)

### Common Development Tasks

#### Adding a New API Endpoint
1. Create service methods in `src/services/[resource]Service.ts`
2. Create controller in `src/controllers/[resource]Controller.ts`
3. Define routes in `src/routes/[resource].ts` (with an `@openapi` JSDoc block)
4. Register route in `src/routes/index.ts`
5. Update frontend API wrapper in `packages/frontend/lib/api/[resource].ts`
6. Add query keys to `packages/frontend/lib/query-keys.ts` if needed
7. Create React Query hooks in `packages/frontend/hooks/` as needed

#### Adding a Scheduled Job (e.g., Auto Clock-Out)
1. Create the job file in `src/jobs/[jobName].ts`
2. Implement the job logic (e.g., querying for overdue time entries and auto clocking out)
3. Register the job in `src/index.ts` using cron scheduling logic
4. Add any necessary environment variables to `.env` and validate in `src/config/environment.ts`
5. Add tests for the job logic in `src/tests/[jobName].test.ts`

#### Database Changes
1. Add a forward migration in `packages/backend/supabase/migrations/` and its rollback in `supabase/down/` (copy the header format of the latest one)
2. Apply it in Supabase, then run `pnpm --filter backend gen:types` to update TypeScript definitions
3. Update service methods to use new columns/tables (handle the "table missing" codes if the feature can ship before the migration)
4. Adjust frontend API types and UI components accordingly

#### Schedule Builder Tasks
1. **Availability import format**: `src/lib/scheduleBuilder/availabilityImport.ts`
   - Columns are found by question text (Email, Name, "What times are you available on Monday…Friday", min/max/ideal hours, notes)
   - Times like "10–11 AM", "8-10:20 AM" and "Available all day" become 30-minute slots
   - Unreadable text is kept as a warning for the admin
2. **Generator rules**: `src/lib/scheduleBuilder/generateDraft.ts`
   - Coverage first (a lead per slot, then the minimum headcount, scarcest slots first, leads saved for slots without one)
   - Then tops people up toward their ideal hours
   - Keep `src/tests/scheduleBuilder.test.ts` passing
3. **Rules**: add new rule keys to `DraftRules` in both `src/lib/scheduleBuilder/model.ts` and `frontend/lib/api/schedule-drafts.ts`, with a default in `DEFAULT_RULES`; `normalizeRules` merges defaults into older drafts
4. **Test fixtures**: use made-up people. The real Forms export contains student names and emails and must not be committed.

#### Microsoft Teams Integration Tasks
1. **Adding/Modifying Teams Sync Fields**:
   - Update the `teamsShiftCollapse.ts` adapter if Teams API response structure changes
   - Modify `teamsShiftsAdapter.ts` for custom field mappings
   - Update database migrations for new schema requirements
   - Adjust DTOs in service layer if needed

2. **Configuring Sync Behavior**:
   - Modify `teamsSyncService.ts` to change what data is synchronized
   - Adjust `teamsSyncStatusService.ts` for different tracking requirements
   - Update cron schedule in `src/jobs/teamsSync.ts` if different frequency needed
   - Modify conflict resolution logic in `teamsShiftCollapse.ts` if needed

3. **Testing Teams Integration**:
   - Use fixtures in `src/tests/fixtures/graph-teams-shifts.ts` as reference
   - Mock Microsoft Graph API responses using libraries like nock or msw
   - Test sync status updates and error handling scenarios
   - Verify that time off data correctly maps to student assistant records

#### Debugging
- Backend: Runs with `tsx watch src/index.ts` for hot reload during development
- Frontend: Runs with `next dev` with Fast Refresh
- Check Supabase dashboard for direct database inspection
- Use browser dev tools to inspect React Query cache and network requests
- Backend logs startup information including port and CORS configuration
- Missing colors or classes in dev after CSS/token changes usually means a stale dev server (see Building); restart it, optionally after `next cache clear`

## File Conventions
- **TypeScript**: Strict mode enabled with path aliases via `tsconfig.json`
- **File Naming**: kebab-case for frontend files; camelCase for backend files (`scheduleDraftService.ts`); PascalCase for components/types
- **Imports**: Relative paths with `@/` alias for frontend root, relative for backend
- **State**: Prefer React Query over local state for server-synchronized data
- **Styling**: Tailwind utility classes with design tokens in `globals.css`
- **Sorting**: lists of shifts sort by start time, then first name
- **Error Handling**:
  - Backend: Services throw `HttpError`, middleware formats responses
  - Frontend: API errors thrown as `ApiRequestError`, caught by React Query/error boundaries

### CI/CD & Deployment
The project uses GitHub Actions for CI/CD with Vercel deployments:

#### GitHub Actions Workflow (`.github/workflows/ci.yml`)
- Runs on pushes and PRs targeting `main` or `staging`
- Uses Node.js 24 and pnpm version from root `package.json`
- Installs dependencies from `pnpm-lock.yaml`
- Runs backend tests in `src/tests`
- Builds both frontend and backend for production
- Handles Vercel's `vercel.deployment.ready` repository dispatch events

#### Vercel Deployment Checks
- After deployment, workflow checks both `/api/health` endpoints:
  - Frontend: `https://sd-clockedin.vercel.app/api/health`
  - Backend: `https://sd-clockedin-express-backend.vercel.app/api/health`
- Can be triggered manually from GitHub Actions tab using Environments
- Reports build status to Vercel as:
  - `Vercel - sd-clockedin: build` (frontend)
  - `Vercel - sd-clockedin-express-backend: build` (backend)

#### Environment Variables for GitHub Environments
Create `production` and `staging` environments in GitHub Settings → Environments:
```text
FRONTEND_URL=https://sd-clockedin.vercel.app
BACKEND_URL=https://sd-clockedin-express-backend.vercel.app
```
(Note: Workflow automatically appends `/api/health` to BACKEND_URL)

#### Scalar/Swagger Documentation Validation
CI includes validation of API documentation:
- Checks that Scalar/Swagger endpoints are accessible
- Validates OpenAPI specification format
- Ensures documentation is properly deployed with Vercel
