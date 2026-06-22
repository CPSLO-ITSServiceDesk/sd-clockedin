# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a monorepo managed by pnpm containing two packages:
- `frontend`: A Next.js 16.2.6 application with React 19
- `backend`: A Node.js Express API with TypeScript, connected to Supabase

The frontend uses Tailwind CSS for styling and incorporates shadcn/ui components via Radix UI primitives.
For state management, the frontend uses React Query (@tanstack/react-query) and React Table (@tanstack/react-table).

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Environment variables:
   - Frontend (`packages/frontend/.env`):
     - MICROSOFT_CLIENT_ID, MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI, AUTH_API_BASE_URL
   - Backend (`packages/backend/.env`):
     - SUPABASE_URL, SUPABASE_ANON_KEY, PORT

   Note: The backend defaults to port 3001, while the frontend expects the API at `http://localhost:8000/api` (adjust as needed or use a proxy).

## Development

### Running the application

To start both frontend and backend:
```bash
pnpm dev
```

This runs:
- `pnpm -r dev`: runs dev script for all packages
- `pnpm -r dev --filter backend`: runs dev script for backend (included in the above)

To run only the frontend:
```bash
pnpm --filter frontend dev
```

To run only the backend:
```bash
pnpm --filter backend dev
```

### Building

To build all packages:
```bash
pnpm build
```

To build only the frontend:
```bash
pnpm --filter frontend build
```

To build only the backend:
```bash
pnpm --filter backend build
```

### Starting the production build

To start all packages:
```bash
pnpm start
```

To start only the frontend:
```bash
pnpm --filter frontend start
```

To start only the backend:
```bash
pnpm --filter backend start
```

### Linting

To lint all packages:
```bash
pnpm lint
```

This runs `eslint .` in both frontend and backend packages.

To lint only the frontend:
```bash
pnpm --filter frontend lint
```

To lint only the backend:
```bash
pnpm --filter backend lint
```

### Testing

The backend has a test setup using Vitest.

To run all backend tests:
```bash
pnpm --filter backend test
```

To run backend tests in watch mode:
```bash
pnpm --filter backend test:watch
```

To run a specific test file:
```bash
pnpm --filter backend test:run -- packages/backend/src/tests/<filename>.test.ts
```

Alternatively, using vitest directly:
```bash
pnpm --filter backend exec vitest run src/tests/<filename>.test.ts
```

Currently, there are no tests in the frontend package. When adding tests, consider setting up a testing framework (e.g., Vitest or Jest) and updating the test scripts in `packages/frontend/package.json`.

### State Management (Frontend)

The frontend uses React Query for data fetching and state management.
- A `QueryProvider` is wrapped around the application in `packages/frontend/app/layout.tsx`.
- Query keys are centralized in `packages/frontend/lib/query-keys.ts`.
- API services are located in `packages/frontend/lib/api/` (e.g., `student-assistants.ts`, `scheduleBlocks.ts`, `schedules.ts`, `time-entries.ts`).
- Data transformation and persistence logic for schedules is in `packages/frontend/lib/schedules/`.

### Type Generation

Regenerate Supabase TypeScript types for the backend:
```bash
pnpm --filter backend gen:types
```

This updates `src/types/database.types.ts` based on the Supabase schema.

### Supabase Connection Check

Verify the backend can connect to Supabase:
```bash
pnpm --filter backend check
```

This runs `tsx src/scripts/check-connection.ts`.

### Debugging

Backend runs with `tsx watch src/index.ts` for hot reload during development.
Frontend runs with `next dev` with fast refresh.

### Environment Variables

If you need to change the backend port, update `PORT` in `packages/backend/.env` and ensure the frontend’s `AUTH_API_BASE_URL` matches (e.g., `http://localhost:3001/api`).

You can also use a proxy in development to avoid CORS; see Next.js documentation for rewrites.

## Code Structure

### Frontend (`packages/frontend`)

- `app/`: Next.js 13+ app directory structure
  - `admin/`: Admin route (likely protected area)
  - `globals.css`: Global CSS styles
  - `layout.tsx`: Root layout component (includes QueryProvider and TooltipProvider)
  - `page.tsx`: Home page component
- `components/`: Reusable UI components (shadcn/ui based)
  - `providers/`: React providers (e.g., QueryProvider)
- `hooks/`: Custom React hooks
- `lib/`: Utility functions and shared logic
  - `api/`: API service layer (wrappers around Supabase via the backend)
  - `format-time.ts`: Time formatting utilities
  - `query-keys.ts`: Centralized React Query keys
  - `schedules/`: Schedule-specific persistence and utilities
- `public/`: Static assets
- `styles/`: Additional CSS/Tailwind configuration
- Configuration files:
  - `next.config.mjs`: Next.js configuration
  - `tsconfig.json`: TypeScript configuration
  - `postcss.config.mjs`: PostCSS/Tailwind configuration
  - `components.json`: shadcn/ui configuration

### Backend (`packages/backend`)

- `src/index.ts`: Express app entry point (middleware, routes, 404, error handler)
- `src/config/environment.ts`: Environment validation and configuration object
- `src/lib/supabase.ts`: Supabase client initialization (reused across services)
- `src/middleware/`: Custom middleware (errorHandler, validate)
- `src/routes/`: Route definitions (mounted under `/api`)
  - `index.ts`: Registers routes and adds `/health` endpoint
  - `terms.ts`: CRUD endpoints for academic terms (complete)
  - `schedules.ts`: Stub endpoints for schedules (to be implemented)
  - `timeEntries.ts`: Stub endpoints for time entries (to be implemented)
  - `studentAssistants.ts`: CRUD endpoints for student assistants (complete)
- `src/controllers/`: Request handlers (e.g., `termController.ts`, `schedulesController.ts`)
- `src/services/`: Business logic and Supabase interactions (e.g., `termService.ts`, `schedulesService.ts`, `studentAssistantService.ts`)
- `src/tests/`: Test files (e.g., `timeEntry.service.test.ts`, `studentAssistant.service.test.ts`)
- `src/scripts/`: Utility scripts (e.g., `check-connection.ts` for verifying Supabase connection)
- `src/types/database.types.ts`: Auto-generated Supabase database types

## Notes

- The backend is a working Express + TypeScript API that talks to Supabase.
- The backend uses integer IDs (not UUIDs) as per the Supabase schema.
- The `terms` and `studentAssistants` modules serve as reference implementations for CRUD operations.
- When implementing new resources (schedules, time entries), follow the pattern established in the `terms` module.
- Error handling: Services throw `HttpError(status, msg)`; the central error handler logs only 5xx errors and returns `{ success: false, error }`.
- The backend includes helper scripts:
  - `pnpm --filter backend gen:types`: Regenerate Supabase types
  - `pnpm --filter backend check`: Verify Supabase connection
- The frontend expects the backend API at `AUTH_API_BASE_URL` (default: `http://localhost:8000/api`). If the backend runs on a different port, consider setting up a proxy or updating the environment variable.
- The root `pnpm dev` command runs both packages concurrently; adjust as needed if you need to run only one package.
- Mock implementations have been removed in favor of direct API calls (see deletion of `mock-schedule-store.tsx`).
- The frontend uses React Query for data fetching and caching, with query keys defined in `lib/query-keys.ts`.

## Additional Resources

- Cursor IDE rules can be added or modified in `.cursor/rules/` (currently empty).
- Migration and planning notes are available in `postgres-plan.md`.
