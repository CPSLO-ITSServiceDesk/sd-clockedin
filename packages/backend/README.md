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
│   ├── index.ts              # Express app entry point (middleware, routes)
│   ├── config/               # Environment configuration
│   │   └── environment.ts    # Environment validation and configuration object
│   ├── lib/                  # Shared utilities
│   │   ├── supabase.ts       # Supabase client initialization
│   │   ├── orgTime.ts        # Organization timezone helpers
│   │   ├── shiftStatus.ts    # Early/on-time/late/absent logic
│   │   ├── shiftAnalytics.ts # Punctuality aggregations
│   │   ├── shiftNormalization.ts
│   │   ├── resolveNearestBlock.ts
│   │   ├── scheduleDateRange.ts
│   │   ├── scheduleImportParser.ts
│   │   └── clearScheduleBlockReferences.ts
│   ├── jobs/                 # Scheduled jobs (cron jobs)
│   │   └── autoClockOut.ts   # Automatic clock-out job for forgotten punch-outs
│   ├── middleware/           # Custom Express middleware
│   │   ├── errorHandler.ts   # Centralized error handling
│   │   └── validate.ts       # Request validation middleware
│   ├── routes/               # API route definitions
│   │   ├── index.ts          # Route registration and health endpoint
│   │   ├── terms.ts          # CRUD endpoints for academic terms
│   │   ├── schedules.ts      # CRUD endpoints for schedules
│   │   ├── scheduleBlocks.ts # CRUD endpoints for schedule blocks
│   │   ├── timeEntries.ts    # CRUD endpoints for time entries
│   │   ├── studentAssistants.ts # CRUD endpoints for student assistants
│   │   ├── admins.ts         # CRUD endpoints for admins
│   │   ├── import.ts         # Schedule import (Excel/CSV upload)
│   │   ├── todayShifts.ts    # Today's shifts endpoint
│   │   ├── analytics.ts      # Term and student analytics
│   │   ├── timesheet.ts      # Timesheet verification
│   │   └── shiftNormalization.ts # Match time entries to blocks
│   ├── controllers/          # Request handlers
│   │   ├── termController.ts
│   │   ├── schedulesController.ts
│   │   ├── scheduleBlocksController.ts
│   │   ├── timeEntryController.ts
│   │   ├── studentAssistantController.ts
│   │   ├── adminController.ts
│   │   ├── todayShiftsController.ts
│   │   ├── analyticsController.ts
│   │   ├── timesheetController.ts
│   │   ├── shiftNormalizationController.ts
│   │   └── scheduleImportController.ts
│   ├── services/             # Business logic and Supabase interactions
│   │   ├── termService.ts
│   │   ├── schedulesService.ts
│   │   ├── scheduleBlocksService.ts
│   │   ├── timeEntryService.ts
│   │   ├── studentAssistantService.ts
│   │   ├── adminService.ts
│   │   ├── todayShiftsService.ts
│   │   ├── analyticsService.ts
│   │   ├── shiftNormalizationService.ts
│   │   └── scheduleImportService.ts
│   ├── scripts/              # Utility scripts
│   │   ├── check-connection.ts      # Supabase connection verification
│   │   └── run-auto-clock-out.ts    # Manual auto clock-out run
│   ├── types/                # TypeScript type definitions
│   │   └── database.types.ts # Auto-generated Supabase database types
│   └── tests/                # Test files (Vitest)
│       ├── scheduleImport.test.ts
│       ├── shiftStatus.test.ts
│       ├── timeEntry.service.test.ts
│       ├── orgTime.test.ts
│       ├── resolveNearestBlock.test.ts
│       ├── scheduleDateRange.test.ts
│       ├── shiftAnalytics.test.ts
│       ├── shiftNormalization.test.ts
│       └── studentAssistant.service.test.ts
├── .env                      # Environment variables (not in repo)
├── package.json              # Dependencies and scripts
└── tsconfig.json             # TypeScript configuration
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
- Auto clock-out runs **once daily** at `AUTO_CLOCK_OUT_TIME` in `ORG_TIMEZONE`
- Closes open time entries whose shifts ended before the cutoff
- Configurable via `AUTO_CLOCK_OUT_ENABLED` and `AUTO_CLOCK_OUT_TIME`

### Security
- Helmet.js for HTTP header security
- CORS middleware with configurable origins
- Environment validation before startup
- SQL injection protection via Supabase parameterized queries

### Schedule Management
- Special handling for schedule block deletions to preserve time entries
- `clearScheduleBlockReferences` function nullifies schedule_block_id in time_entry table
- This preserves historical time entry data when schedule templates are modified
- Schedule date overrides allow temporary modifications to specific schedule instances

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
# Run all backend tests
pnpm --filter backend test

# Run backend tests in watch mode
pnpm --filter backend test:watch

# Run a specific test file
pnpm --filter backend exec vitest run src/tests/<filename>.test.ts
```

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

### Scheduled Jobs
The backend includes automated cron jobs for routine tasks:

**Auto Clock-Out Job**
- Located in `src/jobs/autoClockOut.ts`
- Runs daily at `AUTO_CLOCK_OUT_TIME` in `ORG_TIMEZONE`
- Automatically closes open time entries past the cutoff

To run the auto clock-out job manually:

```bash
pnpm --filter backend auto-clock-out
```

## Key Integration Points

### Frontend Communication
- Frontend expects API at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api`)
- All API calls go through the frontend's `apiFetch` wrapper
- Backend uses integer IDs matching Supabase schema
- CORS configured to allow frontend origins

### Schedule Management Flow
1. Schedules contain multiple Schedule Blocks (shift templates)
2. Time entries reference either a Schedule Block or have custom times
3. When schedule blocks are deleted/updated:
   - `clearScheduleBlockReferences` sets `schedule_block_id` to NULL in `time_entry` table
   - This preserves time entry records while removing references to deleted blocks
   - Time entries with null `schedule_block_id` use their custom `start_time` and `end_time`

### Service Layer Pattern
- Services contain all Supabase interactions and business logic
- Controllers handle HTTP concerns (request/response, validation)
- Services throw `HttpError` for error conditions
- Centralized error handler formats responses consistently
- Automatic 404 handling for missing resources in services

## API Endpoints

All routes are mounted under `/api`.

### Health Check
- `GET /health` — Returns server status and timestamp

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
- `GET /today` — Get today's shifts with status

### Analytics (`/analytics`)
- `GET /terms/:termId` — Term-level punctuality analytics
- `GET /students/:studentId?termId=` — Student-level analytics for a term

### Timesheet (`/timesheet`)
- `GET /hours-by-day` — Aggregated hours by day for verification

### Shift Normalization (`/normalization`)
- `GET /terms/:termId/preview` — Preview unmatched time entries for a term
- `POST /terms/:termId/apply` — Apply block matches to time entries

## Database Schema Overview

The Supabase database contains these core tables:
- `academic_term`: School terms/semesters
- `student_assistant`: Student worker information
- `schedules`: Work schedules for students
- `schedule_blocks`: Individual shift blocks within schedules
- `time_entry`: Clock-in/clock-out records
- `admins`: System administrators
- `import`: Batch import tracking

## Adding New Features

### Adding a New API Endpoint
1. Create service methods in `src/services/[resource]Service.ts`
2. Create controller in `src/controllers/[resource]Controller.ts`
3. Define routes in `src/routes/[resource].ts`
4. Register route in `src/routes/index.ts`
5. Add any necessary database types (updated via `gen:types`)
6. Test the endpoint thoroughly

### Database Changes
1. Modify Supabase schema directly or through migrations
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
- kebab-case for files (e.g., `schedule-blocks.ts`)
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
- Consider implementing caching layer for frequently accessed data
- Use Supabase's real-time features for subscriptions when needed
- Implement ETags and conditional requests for static-ish data

### Security
- Validate all inputs with express-validator
- Use parameterized queries (Supabase handles this)
- Implement rate limiting if needed
- Regularly audit dependencies for vulnerabilities