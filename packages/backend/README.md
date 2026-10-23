# Backend API

This is the backend API built with Node.js, Express, and TypeScript, connected to Supabase.

## Overview

The backend is a RESTful API that provides data services for the student scheduling system. It uses:

- **Node.js** with **Express.js** for the HTTP server
- **TypeScript** for type safety
- **Supabase** as the primary database (PostgreSQL) with PostgREST API
- **Vitest** for testing
- **ESLint** for code quality

## Project Structure

```
packages/backend/
├── src/
│   ├── index.ts           # Express app entry point (middleware, routes, cron jobs)
│   ├── config/            # Environment validation (environment.ts) and OpenAPI setup
│   ├── routes/            # One router per resource, with @openapi JSDoc (see API Endpoints)
│   ├── controllers/       # HTTP handling; delegate to services
│   ├── services/          # Supabase queries and business logic
│   ├── lib/               # Pure helpers with unit tests
│   │   ├── orgTime.ts, time.ts            # Org timezone and time-of-day helpers
│   │   ├── shiftStatus.ts                 # Early / on-time / late / absent
│   │   ├── shiftAnalytics.ts              # Punctuality aggregations
│   │   ├── shiftNormalization.ts          # Match orphaned clock-ins to blocks
│   │   ├── clockOutFixes.ts               # Find odd clock-outs, propose the shift end
│   │   ├── timeOffCoverage.ts             # Vacation days, time off vs. a shift's hours
│   │   ├── diffScheduleBlocks.ts          # Keep unchanged block ids when replacing blocks
│   │   ├── scheduleImport*.ts             # Shift spreadsheet import (When I Work CSV/XLSX)
│   │   ├── scheduleBuilder/               # Forms availability import, roster match, draft generator
│   │   ├── teamsShiftsAdapter.ts, teamsShiftCollapse.ts, microsoftGraph.ts  # Teams Shifts
│   │   ├── timesheetMonth.ts              # Monthly timesheet rollups
│   │   └── todayShiftsCache.ts, redis.ts  # Optional Redis cache
│   ├── jobs/              # autoClockOut.ts (daily), teamsSync.ts (weekdays 8:00–16:00)
│   ├── middleware/        # errorHandler.ts, validate.ts
│   ├── scripts/           # check-connection.ts, run-auto-clock-out.ts
│   ├── types/             # database.types.ts (generated from Supabase)
│   └── tests/             # Vitest tests and fixtures
├── supabase/
│   ├── migrations/        # Forward SQL migrations, applied by hand
│   └── down/              # Matching rollbacks
├── dist/                  # Compiled output (checked in; rewritten by `build`)
├── .env                   # Environment variables (not in repo; see .env.example)
├── package.json
└── tsconfig.json
```

## Key Features

### API Design
- RESTful endpoints following consistent patterns
- All resources follow the same CRUD structure (terms, studentAssistants, schedules, etc.)
- Standardized API response format:
  ```json
  {
    "success": boolean,
    "data": null | object | array,
    "error": string | undefined
  }
  ```
- Appropriate HTTP status codes (200, 201, 204, 400, 404, 500)
- 204 No Content for successful deletions
- Input validation using express-validator
- Centralized error handling via HttpError class

### Database Interaction
- Direct Supabase client usage throughout services
- Consistent error handling converting PostgREST errors to HttpError
- Use of `.single()` for single-record queries with PGRST116 error handling
- Proper ordering and filtering in queries
- Integer IDs (not UUIDs) as per Supabase schema

### Scheduled Jobs
- Auto clock-out runs **once daily** at `AUTO_CLOCK_OUT_TIME` in `ORG_TIMEZONE` and closes every entry still open at that time (including stale ones from earlier days)
- Teams sync runs **once an hour on weekdays from 8:00 through 16:00** (`0 8-16 * * 1-5`, org timezone) for the active term when Microsoft Graph is configured
- Configurable via `AUTO_CLOCK_OUT_ENABLED` and `AUTO_CLOCK_OUT_TIME`

### Security
- Helmet.js for HTTP header security
- CORS middleware with configurable origins
- Environment validation before startup
- SQL injection protection via Supabase parameterized queries

### Schedule Management
- `replaceScheduleBlocks` (used by Teams sync, spreadsheet import and schedule-builder publish) diffs incoming blocks against a student's existing ones by day + start + end:
  - unchanged blocks keep their ids, so linked time entries stay linked
  - a remote-flag change is updated in place
  - only removed blocks are deleted
- Deleting a block runs `clearScheduleBlockReferences`, which nulls `time_entry.schedule_block_id` but keeps the entry
- Schedule `start_date`/`end_date` overrides narrow when a schedule applies within its term; term `off_days` hold vacation days and special-schedule swap days

### Time Off
- Synced from Teams Shifts into `student_time_off` (shared time off for the scheduling group, within the term's dates)
- `GET /api/shifts/today` matches time off against each shift's own hours:
  - time off covering the whole shift lists it in `timeOffShifts`
  - partial time off trims the shift to the hours still worked
- The same response returns `upcomingTimeOff` (now through 14 days) and `todayTimeOff` (everything overlapping today, including time off that already ended)

### Schedule Builder
- Drafts live in `schedule_draft` (JSONB rules, people, unmatched responses, change log) until published
- `POST /schedule-drafts/:id/import` reads a Microsoft Forms availability export:
  - columns are found by question text
  - availability becomes 30-minute slots
  - unreadable text is kept as a per-person warning
- `POST /schedule-drafts/:id/generate` runs the rule-based generator (`lib/scheduleBuilder/generateDraft.ts`): coverage first, then hours toward each person's ideal
- `POST /schedule-drafts/:id/publish` writes each person's contiguous slots as weekly blocks through `replaceScheduleBlocks`. It doesn't write to Teams; with Teams sync on, the next sync replaces those blocks for anyone on the Teams roster.

### Analytics
- Enhanced student analytics with punctuality metrics (on-time, early, late percentages)
- Hourly headcount charts with location filtering capabilities
- Efficient querying using Supabase aggregates and computed fields

## Development

### Setup
```bash
# Install dependencies (run from repository root)
pnpm install
```

### Environment Variables
Create a `.env` file in `packages/backend/` with:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
ORG_TIMEZONE=America/Los_Angeles

# Auto clock-out (daily at this time in ORG_TIMEZONE)
AUTO_CLOCK_OUT_ENABLED=true
AUTO_CLOCK_OUT_TIME=17:00

# Optional: Upstash / Vercel KV (enables short-TTL cache for GET /api/shifts/today)
# Either naming style works:
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
# KV_REST_API_URL=https://xxxx.upstash.io
# KV_REST_API_TOKEN=your_kv_token

# Optional: Microsoft Teams Shifts sync (enabled only when the first four are all set)
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
TEAMS_TEAM_ID=
# Scheduling group to sync; defaults to "Service Desk"
TEAMS_SCHEDULING_GROUP=
```

### Development Server
```bash
# Start backend only
pnpm --filter backend dev

# Start both frontend and backend
pnpm dev
```

The backend will be available at `http://localhost:3001`

### Building
```bash
# Build for production
pnpm --filter backend build

# Start production server
pnpm --filter backend start
```

### Testing
```bash
# Run the source backend tests (the same command used by CI)
pnpm --filter backend exec vitest run src/tests

# Run backend tests in watch mode
pnpm --filter backend test:watch

# Run a specific test file
pnpm --filter backend exec vitest run src/tests/<filename>.test.ts
```

Plain `pnpm --filter backend test` also picks up the compiled copies in `dist/tests`, which fail under Vitest; scope runs to `src/tests`. Type-check without touching `dist/` with `pnpm --filter backend exec tsc --noEmit -p .`.

### Code Quality
```bash
# Run ESLint
pnpm --filter backend lint

# Fix auto-fixable issues
pnpm --filter backend lint --fix
```

### Database & Type Generation
```bash
# Regenerate Supabase TypeScript types (after schema changes)
pnpm --filter backend gen:types

# Verify Supabase connection
pnpm --filter backend check
```

### Migrations
SQL migrations live in `supabase/migrations/`, with a rollback for each in `supabase/down/`, named `<timestamp>_<name>.sql`. Each header lists the revision, the revision it depends on, and how to apply it. Apply them in timestamp order in the Supabase SQL editor (or `supabase db query --linked -f <file>`); they aren't pushed automatically. Roll back newest-first.

| Migration | Adds |
|-----------|------|
| `20261002100000_student_entra_user_id_and_time_off` | `student_assistant.entra_user_id`, `student_time_off` |
| `20261002110000_teams_sync_status` | `teams_sync_status` |
| `20261016100000_timesheet_verification` | `timesheet_verification` |
| `20261019100000_schedule_draft` | `schedule_draft` (schedule builder) |
| `20261019120000_teams_schedule_publish` | `teams_schedule_publish` (history of sends to Teams) |

Features backed by a newer table check for it at runtime. Timesheet verification and the schedule builder report "not set up yet" instead of failing until their migration is applied.

### Scheduled Jobs
The backend includes automated cron jobs for routine tasks:

**Auto Clock-Out Job**
- Located in `src/jobs/autoClockOut.ts`
- Runs daily at `AUTO_CLOCK_OUT_TIME` in `ORG_TIMEZONE`
- Closes every time entry still open at that time; Shift Normalization can then set these to the scheduled shift end

**Teams Sync Job**
- Located in `src/jobs/teamsSync.ts`
- Runs once an hour on weekdays from 8:00 through 16:00 (org timezone) for the active term when the Microsoft Graph variables are set
- Also runs after an active term is saved and via `POST /api/teams-sync/sync-now`

To run the auto clock-out job manually:

```bash
pnpm --filter backend auto-clock-out
```

### Deployment and Health Check

The production backend is deployed on Vercel:

- API base: [https://sd-clockedin-express-backend.vercel.app/api](https://sd-clockedin-express-backend.vercel.app/api)
- Health check: [https://sd-clockedin-express-backend.vercel.app/api/health](https://sd-clockedin-express-backend.vercel.app/api/health)

The health endpoint returns JSON containing `status: "OK"` and a timestamp. The repository GitHub Actions workflow checks it after successful deployments, reports `Vercel - sd-clockedin-express-backend: build` to the backend Vercel project, and supports manually triggered smoke tests.

Set the non-secret `BACKEND_URL` variable in the GitHub `production` Environment to `https://sd-clockedin-express-backend.vercel.app`. The workflow appends `/api/health`.

## Key Integration Points

### Frontend Communication
- Frontend expects API at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api`)
- All API calls go through the frontend's `apiFetch` wrapper
- Backend uses integer IDs matching Supabase schema
- CORS configured to allow frontend origins

### Schedule Management Flow
1. Schedules contain multiple Schedule Blocks (weekly shift templates)
2. Time entries reference a Schedule Block, or none (unscheduled punches, which Shift Normalization can link)
3. Replacing blocks via `replaceScheduleBlocks` keeps unchanged blocks and their links
4. When a block is deleted, `clearScheduleBlockReferences` sets `schedule_block_id` to NULL in `time_entry`, preserving the record

### Service Layer Pattern
- Services contain all Supabase interactions and business logic
- Controllers handle HTTP concerns (request/response, validation)
- Services throw `HttpError` for error conditions
- Centralized error handler formats responses consistently
- Automatic 404 handling for missing resources in services

## API Endpoints

All routes are mounted under `/api`.

### Health Check
- `GET /api/health` — Returns server status and timestamp

### Academic Terms (`/terms`)
- `GET /` — List all terms
- `GET /:id` — Get term by ID
- `POST /` — Create new term
- `PUT /:id` — Update term
- `DELETE /:id` — Delete term

### Student Assistants (`/student-assistants`)
- `GET /` — List all student assistants
- `GET /:id` — Get student assistant by ID
- `POST /` — Create new student assistant
- `PUT /:id` — Update student assistant
- `DELETE /:id` — Delete student assistant

### Schedules (`/schedules`)
- `GET /` — List all schedules
- `GET /:id` — Get schedule by ID
- `GET /:id/blocks` — Get blocks for a schedule
- `POST /` — Create new schedule
- `PUT /:id` — Update schedule
- `DELETE /:id` — Delete schedule

### Schedule Blocks (`/schedule-blocks`)
- `GET /` — List all schedule blocks
- `GET /:id` — Get schedule block by ID
- `POST /` — Create new schedule block
- `PUT /:id` — Update schedule block
- `DELETE /:id` — Delete schedule block

### Time Entries (`/time-entries`)
- `GET /` — List all time entries
- `GET /:id` — Get time entry by ID
- `POST /clock-in` — Clock in a student assistant
- `PATCH /close-open` — Close open entry for a student + block
- `PATCH /close-open-by-assistant` — Close open entry for a student
- `POST /` — Create time entry (admin)
- `PUT /:id` — Update time entry
- `PATCH /:id` — Partial update
- `DELETE /:id` — Delete time entry

### Admins (`/admins`)
- `GET /` — List all admins
- `GET /:id` — Get admin by ID
- `POST /authorize` — Check if email is allowed (used by frontend auth)
- `POST /` — Create admin
- `PUT /:id` — Update admin
- `DELETE /:id` — Delete admin

### Import (`/import`)
- `POST /schedules` — Upload `.xlsx`, `.xls`, or `.csv` schedule file (multipart form)

### Today's Shifts (`/shifts`)
- `GET /today` — Today's shifts with status, plus `timeOffShifts`, `upcomingTimeOff`, `todayTimeOff` and `remoteOnlyStudentIds`. `?date=YYYY-MM-DD` views another day; `?include_remote=1` includes remote blocks.

### Teams Sync (`/teams-sync`)
- `GET /status` — Last sync result for a term (`?academic_term_id=`, defaults to the active term)
- `POST /sync-now` — Run a sync now

### Analytics (`/analytics`)
- `GET /terms/:termId` — Term-level punctuality analytics
- `GET /students/:studentId?termId=` — Student-level analytics for a term

### Timesheet (`/timesheet`)
- `GET /hours-by-day` — Aggregated hours by day (`studentId`, `startDate`, `endDate`)
- `GET /months?month=YYYY-MM` — Monthly summary for every student, with verification state
- `GET /students/:studentId/months?month=YYYY-MM` — One student's month
- `PUT /students/:studentId/months/:month/verification` — Mark a month verified
- `DELETE /students/:studentId/months/:month/verification` — Un-verify

### Shift Normalization (`/normalization`)
- `GET /terms/:termId/preview` — Proposed block matches for unlinked clock-ins, entries with no match, and `clockOutFixes` (odd clock-outs with the scheduled end as the fix)
- `POST /terms/:termId/apply` — Link the given time entries to blocks
- `POST /terms/:termId/clock-outs` — Set the given entries' clock-out to their shift's scheduled end (recomputed server-side; stale ones are skipped)

### Teams Publish (`/teams-publish`)
Sends to Teams Shifts as **drafts**: new shifts are created unshared, unwanted shared shifts are staged for deletion, and unwanted unshared drafts are deleted. Students see nothing until a manager shares the schedule in Teams. Requires the Graph `Schedule.ReadWrite.All` application permission.
- `POST /drafts/:draftId/preview` / `POST /drafts/:draftId/publish` — Body `{ from_date, to_date }`. Lays the draft's weekly pattern over those weeks (inside the term, skipping vacations, running swap days) and diffs it against Teams for the people the draft covers.
- `GET /students/:studentId/pattern?academic_term_id=&week=` — A person's weekly shifts as they are in Teams (that week, or the latest of the previous four with shifts)
- `POST /students/:studentId/preview` / `POST /students/:studentId/publish` — Body `{ academic_term_id, from_date, to_date, shifts: [{ day, start_time, end_time, role }] }`; changes only that person's shifts in those weeks
- `GET /terms/:termId/history` — Recent sends (Versions)

### Schedule Drafts (`/schedule-drafts`)
- `GET /?academic_term_id=` — Latest draft for a term (or null)
- `POST /` — Start a draft for a term (seeded with active students)
- `GET /:id` / `PUT /:id` / `DELETE /:id` — Read, save progress, discard
- `POST /:id/import` — Upload a Forms availability export (`.csv`, `.xlsx`, `.xls`, multipart `file`)
- `POST /:id/generate` — Generate shifts from availability and rules
- `GET /:id/publish-preview` — New / removed / unchanged shifts vs. current schedules
- `POST /:id/publish` — Write the draft to the term's schedules

## Database Schema Overview

The Supabase database contains these tables:
- `academic_term`: School terms/semesters, with `off_days` (vacations, swap days)
- `student_assistant`: Student worker information, including `entra_user_id` for Teams
- `schedules`: A student's schedule for a term, with optional date overrides
- `schedule_blocks`: Weekly shift blocks within schedules
- `time_entry`: Clock-in/clock-out records
- `admins`: System administrators
- `student_time_off`: Time off synced from Teams
- `teams_sync_status`: Last Teams sync result per term
- `timesheet_verification`: Verified months per student
- `schedule_draft`: Schedule builder drafts
- `teams_schedule_publish`: History of sends to Teams

## Adding New Features

### Adding a New API Endpoint
1. Create service methods in `src/services/[resource]Service.ts`
2. Create controller in `src/controllers/[resource]Controller.ts`
3. Define routes in `src/routes/[resource].ts`
4. Register route in `src/routes/index.ts`
5. Add any necessary database types (updated via `gen:types`)
6. Test the endpoint thoroughly

### Database Changes
1. Add a migration in `supabase/migrations/` and its rollback in `supabase/down/` (copy the latest file's header), then apply it in Supabase
2. Run `pnpm --filter backend gen:types` to update TypeScript definitions
3. Update service methods to use new columns/tables
4. Ensure frontend API types are updated accordingly

### Middleware Addition
1. Create new middleware in `src/middleware/`
2. Export the middleware function
3. Apply it in `src/index.ts` or specific routes as needed
4. Follow existing middleware patterns (error handling, validation)

## Debugging

- Backend runs with `tsx watch src/index.ts` for hot reload during development
- Check Supabase dashboard for direct database inspection
- Review console logs for startup information (port, CORS configuration)
- Use browser dev tools or tools like Postman to test API endpoints
- Check test output for failing tests
- Look at error logs for 5xx errors (only these are logged by the error handler)
- Verify environment variables are loaded correctly

## File Conventions

### TypeScript
- Strict mode enabled with path aliases via `tsconfig.json`
- Interface naming: `Resource` for rows, `ResourceInsert` for inserts, `ResourceUpdate` for updates
- Consistent error handling patterns

### File Naming
- camelCase for files (e.g., `scheduleBlocksService.ts`)
- PascalCase for components, classes, and types
- Descriptive names for clarity

### Imports
- Relative paths within the backend (`../services/termService`)
- Absolute imports for shared libs (`../lib/supabase`)

### State Management
- Services are stateless (no in-memory storage)
- All state persisted in Supabase database
- Request-scoped objects only

### Error Handling
- Services throw `HttpError(status, message)` for error conditions
- Centralized error handler logs only 5xx errors
- All errors return `{ success: false, error: message }`
- 204 No Content for successful deletions
- Validation errors handled by express-validator middleware

### Testing
- Test files named `[filename].test.ts` in `src/tests/`
- Unit tests for services and utilities
- Integration tests for API endpoints
- Use Vitest's expect and mocking capabilities
- Mock Supabase responses where needed

## Performance Considerations

### Database Queries
- Use selective column selection instead of `*` when possible
- Proper indexing on Supabase tables (managed through Supabase)
- Limit result sets with pagination when appropriate
- Use Supabase's built-in filtering and ordering

### Caching
- `GET /api/shifts/today` is cached in Upstash Redis (15s TTL) when
  `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
- Cache is invalidated on time-entry and schedule-block mutations
- Without Redis env vars, the endpoint hits Supabase directly (no hard dependency)

### Security
- Validate all inputs with express-validator
- Use parameterized queries (Supabase handles this)
- Implement rate limiting if needed
- Regularly audit dependencies for vulnerabilities