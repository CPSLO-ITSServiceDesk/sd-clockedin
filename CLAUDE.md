# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a monorepo managed by pnpm containing two packages:
- `frontend`: A Next.js 16.2.6 application with React 19
- `backend`: A Node.js Express API with TypeScript, connected to Supabase

The frontend uses Tailwind CSS for styling and incorporates shadcn/ui components via Radix UI primitives.
For state management, the frontend uses React Query (@tanstack/react-query) and React Table (@tanstack/react-table).

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
# Run all backend tests
pnpm --filter backend test

# Run backend tests in watch mode
pnpm --filter backend test:watch

# Run a specific test file
pnpm --filter backend test:run -- packages/backend/src/tests/<filename>.test.ts

# Run with Vitest directly
pnpm --filter backend exec vitest run src/tests/<filename>.test.ts
```

### Database & Type Generation
```bash
# Regenerate Supabase TypeScript types
pnpm --filter backend gen:types

# Verify Supabase connection
pnpm --filter backend check
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
  - `src/lib/` - Shared utilities (Supabase client initialization)
  - `src/middleware/` - Custom Express middleware (error handling, validation, CORS)
  - `src/scripts/` - Utility scripts (connection testing, type generation)

#### Key Patterns:
1. **CRUD Consistency**: All resources follow the same pattern (terms, studentAssistants, schedules, etc.)
   - Routes use express-validator for input validation
   - Controllers handle HTTP concerns and delegate to services
   - Services contain Supabase queries and business logic
   - Automatic 404 handling for missing resources in services
   - Consistent error handling via HttpError class and centralized error handler

2. **Database Interaction**:
   - Direct Supabase client usage throughout services
   - Consistent error handling converting PostgREST errors to HttpError
   - Use of `.single()` for single-record queries with PGRST116 error handling
   - Proper ordering and filtering in queries

3. **API Response Format**:
   ```json
   {
     "success": boolean,
     "data": null | object | array,
     "error": string | undefined
   }
   ```
   - 204 No Content for successful deletions
   - Appropriate HTTP status codes for different operations

### Frontend Architecture
- **Next.js 13+** with App Router (`app/` directory)
- **React Query** for server state management and caching
- **React Table** for complex table UIs with sorting, filtering, pagination
- **React Hook Form** with Zod for form validation
- **Shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** for utility-first styling

#### Key Patterns:
1. **API Layer**:
   - Centralized `apiFetch` wrapper in `lib/api/client.ts`
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
   - Consistent TypeScript interfaces matching Supabase types
   - Proper handling of nullable fields and JSONB columns

4. **Component Organization**:
   - Reusable UI components in `components/` (shadcn/ui based)
   - Feature-specific components in route-specific directories (`app/(feature)/`)
   - Custom hooks in `hooks/` directory
   - Utility functions in `lib/` directory

### Database Schema Overview
The Supabase database contains these core tables:
- `academic_term`: School terms/semesters
- `student_assistant`: Student worker information
- `schedules`: Work schedules for students
- `schedule_blocks`: Individual shift blocks within schedules
- `time_entry`: Clock-in/clock-out records
- `admins`: System administrators
- `import`: Batch import tracking

### Key Integration Points
1. **Frontend → Backend Communication**:
   - Frontend expects API at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api`)
   - All API calls go through the typed `apiFetch` wrapper
   - React Query handles caching, deduplication, and background updates

2. **Schedule Management Flow**:
   - Schedules contain multiple Schedule Blocks (shift templates)
   - Time entries reference either a Schedule Block or have custom times
   - When schedule blocks are deleted/updated, `clearScheduleBlockReferences` preserves time entries by nullifying references

3. **State Synchronization**:
   - React Query automatically refetches data after mutations
   - Optimistic UI updates in some cases (e.g., schedule block creation)
   - WebSocket or polling mechanisms for real-time updates (currently polling every 30s for today's shifts)

### Environment Variables
**Backend** (`.env` in `packages/backend/`):
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)
- `ALLOWED_ORIGINS`: CORS allowed origins (comma-separated)

**Frontend** (`.env` in `packages/frontend/`):
- `NEXT_PUBLIC_API_URL`: Base URL for API calls (must include `/api` suffix)
- Other Next.js environment variables as needed

### Common Development Tasks

#### Adding a New API Endpoint
1. Create service methods in `src/services/[resource]Service.ts`
2. Create controller in `src/controllers/[resource]Controller.ts`
3. Define routes in `src/routes/[resource].ts`
4. Register route in `src/routes/index.ts`
5. Update frontend API wrapper in `packages/frontend/lib/api/[resource].ts`
6. Add query keys to `packages/frontend/lib/query-keys.ts` if needed
7. Create React Query hooks in `packages/frontend/hooks/` as needed

#### Database Changes
1. Modify Supabase schema directly or through migrations
2. Run `pnpm --filter backend gen:types` to update TypeScript definitions
3. Update service methods to use new columns/tables
4. Adjust frontend API types and UI components accordingly

#### Debugging
- Backend: Runs with `tsx watch src/index.ts` for hot reload during development
- Frontend: Runs with `next dev` with Fast Refresh
- Check Supabase dashboard for direct database inspection
- Use browser dev tools to inspect React Query cache and network requests
- Backend logs startup information including port and CORS configuration

## File Conventions
- **TypeScript**: Strict mode enabled with path aliases via `tsconfig.json`
- **File Naming**: kebab-case for files, PascalCase for components/types
- **Imports**: Relative paths with `@/` alias for frontend root, relative for backend
- **State**: Prefer React Query over local state for server-synchronized data
- **Styling**: Tailwind utility classes with occasional custom CSS in `globals.css`
- **Error Handling**: 
  - Backend: Services throw `HttpError`, middleware formats responses
  - Frontend: API errors thrown as `ApiRequestError`, caught by React Query/error boundaries