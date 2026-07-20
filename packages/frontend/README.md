# Frontend Application

This is the frontend application built with Next.js 16.2.9 and React 19.2.7.

## Overview

The frontend is a Next.js application that provides the user interface for the student scheduling system. It uses:

- **Next.js 16.2.9** with App Router (`app/` directory)
- **React 19.2.7** for UI components
- **Tailwind CSS 4** for styling
- **shadcn/ui** component library (built on Radix UI primitives)
- **Supabase Auth** (`@supabase/ssr`) for admin login
- **React Query** (`@tanstack/react-query`) for server state management
- **React Table** (`@tanstack/react-table`) for data tables
- **React Hook Form** with **Zod** for form validation

## Project Structure

```
packages/frontend/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Kiosk home (clock in/out)
│   ├── display/            # Full-screen wall display
│   ├── auth/callback/      # Supabase OAuth callback
│   ├── admin/              # Admin routes (auth required)
│   │   ├── page.tsx        # Dashboard
│   │   ├── terms/
│   │   ├── students/
│   │   ├── employees/
│   │   ├── schedules/
│   │   ├── shifts/
│   │   ├── studentrecords/
│   │   ├── timesheet-verification/
│   │   ├── shift-normalization/
│   │   ├── analytics/      # term, students, group-schedule
│   │   ├── access/
│   │   └── settings/
│   ├── layout.tsx          # Root layout (providers)
│   └── globals.css
├── components/             # Reusable UI (shadcn/ui) and feature components
│   ├── admin/              # Admin-specific components
│   └── providers/          # QueryProvider, ThemeProvider
├── hooks/                  # Custom React hooks
├── lib/
│   ├── api/                # API wrappers (terms, schedules, analytics, etc.)
│   ├── auth/               # Admin authorization helpers
│   ├── supabase/           # Browser/server Supabase clients, session middleware
│   ├── schedules/          # Schedule persistence and date-range utilities
│   ├── shifts/             # Today-shifts and dashboard stats
│   ├── query-keys.ts       # Centralized React Query keys
│   └── format-time.ts
├── proxy.ts                # Session refresh (Next.js proxy middleware)
└── configuration:
    ├── next.config.mjs
    ├── tsconfig.json
    ├── postcss.config.mjs
    └── components.json     # shadcn/ui configuration
```

## Key Features

### State Management
- React Query handles server state with automatic caching, deduplication, and background updates
- Query keys are centralized in `lib/query-keys.ts`
- Custom hooks in `hooks/` directory encapsulate query logic

### API Communication
- All API requests go through the typed `apiFetch` wrapper in `lib/api/client.ts`
- Automatic JSON serialization/deserialization
- Consistent error handling transforming API errors to thrown exceptions
- Resource-specific modules in `lib/api/` (e.g., `terms.ts`, `scheduleBlocks.ts`, `timesheet.ts`, `shift-normalization.ts`)
- Analytics API module (`lib/api/analytics.ts`) for term and student metrics

### Data Transformation
- Mapper functions in `lib/schedules/` convert between API and UI formats
- Consistent TypeScript interfaces matching Supabase types
- Proper handling of nullable fields and JSONB columns
- Date-range utilities in `lib/schedules/date-range.ts` for schedule overrides

### UI Components
- Reusable components in `components/ui/` (shadcn/ui)
- Admin feature components in `components/admin/`
- Kiosk components: `live-clock`, `clock-modal`, `clocked-in-table`, `expected-arrivals-table`
- Analytics: KPI cards, punctuality charts, hourly headcount, late leaderboards
- Timesheet verification and shift normalization managers under `components/admin/`

## Development

### Setup
```bash
# Install dependencies (run from repository root)
pnpm install
```

### Development Server
```bash
# Start frontend only
pnpm --filter frontend dev

# Start both frontend and backend
pnpm dev
```

The frontend will be available at `http://localhost:3000`

### Building
```bash
# Build for production
pnpm --filter frontend build

# Start production server
pnpm --filter frontend start
```

### Linting
```bash
# Run ESLint
pnpm --filter frontend lint

# Fix auto-fixable issues
pnpm --filter frontend lint --fix
```

### Environment Variables
Create a `.env` file in `packages/frontend/` with:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Note: The frontend expects the backend API at `NEXT_PUBLIC_API_URL` (must include `/api` suffix). Supabase env vars are required for admin login.

## Key Integration Points

### Authentication
- Admin routes use Supabase Auth (Google OAuth via `LeadLogin` on the kiosk)
- `proxy.ts` refreshes the session on each request
- `lib/auth/authorize-admin.ts` calls `POST /api/admins/authorize` to verify the user is in the admins table

### Backend Communication
- Frontend expects API at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api`)
- All API calls go through the typed `apiFetch` wrapper
- React Query handles caching, deduplication, and background updates

### Schedule Management
- Schedules contain multiple Schedule Blocks (shift templates)
- Time entries reference either a Schedule Block or have custom times
- When schedule blocks are deleted/updated, references in time entries are nulled (preserving the time entry records)
- Schedule date overrides allow temporary modification of schedule blocks for specific dates

### State Synchronization
- React Query automatically refetches data after mutations
- Optimistic UI updates in some cases (e.g., schedule block creation)
- Polling every 30 seconds for real-time updates (today's shifts)
- Enhanced analytics with punctuality metrics and hourly headcount charts with location filtering

### Analytics Features
- Term analytics dashboard (`/admin/analytics/term`)
- Per-student analytics (`/admin/analytics/students`)
- Group schedule view (`/admin/analytics/group-schedule`)
- Punctuality KPIs, late leaderboards, weekday/slot charts, hourly headcount with location filtering

### Timesheet & Normalization
- Timesheet verification grid (`/admin/timesheet-verification`) — hours-by-day review
- Shift normalization (`/admin/shift-normalization`) — match orphaned entries to schedule blocks

## Architecture Guidelines

### Code Organization
- Feature-based organization in `app/` directory
- Reusable components in `components/`
- Custom hooks in `hooks/`
- Utilities in `lib/`
- API wrappers in `lib/api/`

### Type Safety
- Strict TypeScript mode enabled
- Consistent interfaces matching Supabase types
- Proper handling of nullable fields

### Styling
- Tailwind CSS for utility-first styling
- Custom CSS in `globals.css` for global styles
- shadcn/ui components for consistent UI

### Error Handling
- API errors thrown as `ApiRequestError` from `lib/api/client.ts`
- Errors caught by React Query and/or error boundaries
- Loading and error states handled in components

## Adding New Features

### Adding a New Page
1. Create a new route in `app/` directory (e.g., `app/new-feature/page.tsx`)
2. Add any necessary route groups or layouts as needed
3. Use React Query hooks for data fetching
4. Implement UI using shadcn/ui components

### Adding a New API Endpoint Wrapper
1. Create a new file in `lib/api/` (e.g., `new-feature.ts`)
2. Import `apiFetch` from `./client`
3. Define TypeScript interfaces for the resource
4. Implement CRUD functions using `apiFetch`
5. Export the API object

### Adding a New React Query Hook
1. Create a new file in `hooks/` (e.g., `use-new-feature.ts`)
2. Import `useQuery` and/or `useMutation` from `@tanstack/react-query`
3. Use the appropriate query key from `queryKeys`
4. Call the API function from `lib/api/`
5. Return the query/mutation result

### Adding a New Component
1. Create component in `components/` (if reusable) or feature directory (if specific)
2. Use shadcn/ui primitives as base
3. Style with Tailwind CSS
4. Follow existing component patterns for props and state management

### Adding Analytics Features
1. Create API endpoint wrapper in `lib/api/` (e.g., `analytics.ts`)
2. Define TypeScript interfaces for analytics data
3. Implement data fetching functions using `apiFetch`
4. Create React Query hooks in `hooks/` for data fetching (e.g., `useStudentAnalytics.ts`)
5. Add new route in `app/` directory for analytics pages (e.g., `app/admin/analytics/page.tsx`)
6. Create visualization components in `components/admin/analytics/` using Recharts or similar
7. Add utility functions for data processing in `lib/` if needed
8. Update sidebar navigation in `components/admin/layout/app-sidebar.tsx` to include new links

## Testing

Currently, there are no tests in the frontend package. When adding tests, consider:
- Setting up a testing framework (Vitest or Jest)
- Updating test scripts in `package.json`
- Following React Testing Library best practices
- Testing custom hooks with `@testing-library/react-hooks`
- Mocking API calls with MSW or similar

## Database Schema Overview (as used by frontend)

The frontend interacts with these backend resources through the API:
- `academic_term`: School terms/semesters
- `student_assistant`: Student worker information
- `schedules`: Work schedules for students
- `schedule_blocks`: Individual shift blocks within schedules
- `time_entry`: Clock-in/clock-out records
- `admins`: System administrators
- `import`: Batch import tracking

**Analytics-specific data:**
- The frontend leverages aggregated data and computed fields from the above tables for analytics
- Punctuality metrics are calculated from time_entry data compared to schedule_block times
- Hourly headcount aggregations are generated from time_entry data grouped by hour and location

## Debugging

- Use React DevTools to inspect component hierarchies
- Use React Query DevTools to inspect query cache and mutations
- Check network requests in browser dev tools
- Review console logs for errors and warnings
- Check Supabase dashboard for direct database inspection when needed