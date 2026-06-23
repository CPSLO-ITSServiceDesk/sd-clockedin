# Frontend Application

This is the frontend application built with Next.js 16.2.6 and React 19.

## Overview

The frontend is a Next.js application that provides the user interface for the student scheduling system. It uses:

- **Next.js 16.2.6** with App Router (`app/` directory)
- **React 19** for UI components
- **Tailwind CSS** for styling
- **shadcn/ui** component library (built on Radix UI primitives)
- **React Query** (`@tanstack/react-query`) for server state management
- **React Table** (`@tanstack/react-table`) for data tables
- **React Hook Form** with **Zod** for form validation

## Project Structure

```
packages/frontend/
├── app/                    # Next.js App Router
│   ├── admin/              # Admin routes (protected)
│   ├── layout.tsx          # Root layout (includes providers)
│   └── page.tsx            # Home page
├── components/             # Reusable UI components (shadcn/ui based)
│   └── providers/          # React providers (QueryProvider, etc.)
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions and shared logic
│   ├── api/                # API service layer (wrappers around backend)
│   ├── format-time.ts      # Time formatting utilities
│   ├── query-keys.ts       # Centralized React Query keys
│   └── schedules/          # Schedule-specific persistence and utilities
├── public/                 # Static assets
├── styles/                 # Additional CSS/Tailwind configuration
└── configuration files:
    ├── next.config.mjs     # Next.js configuration
    ├── tsconfig.json       # TypeScript configuration
    ├── postcss.config.mjs  # PostCSS/Tailwind configuration
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
- Resource-specific modules in `lib/api/` (e.g., `terms.ts`, `scheduleBlocks.ts`)

### Data Transformation
- Mapper functions in `lib/schedules/` convert between API and UI formats
- Consistent TypeScript interfaces matching Supabase types
- Proper handling of nullable fields and JSONB columns

### UI Components
- Reusable components in `components/` (built with shadcn/ui)
- Feature-specific components in route-specific directories
- Utility functions in `lib/` directory

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
# Other Next.js environment variables as needed
```

Note: The frontend expects the backend API to be available at `NEXT_PUBLIC_API_URL` (must include `/api` suffix).

## Key Integration Points

### Backend Communication
- Frontend expects API at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api`)
- All API calls go through the typed `apiFetch` wrapper
- React Query handles caching, deduplication, and background updates

### Schedule Management
- Schedules contain multiple Schedule Blocks (shift templates)
- Time entries reference either a Schedule Block or have custom times
- When schedule blocks are deleted/updated, references in time entries are nulled (preserving the time entry records)

### State Synchronization
- React Query automatically refetches data after mutations
- Optimistic UI updates in some cases (e.g., schedule block creation)
- Polling every 30 seconds for real-time updates (today's shifts)

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

## Debugging

- Use React DevTools to inspect component hierarchies
- Use React Query DevTools to inspect query cache and mutations
- Check network requests in browser dev tools
- Review console logs for errors and warnings
- Check Supabase dashboard for direct database inspection when needed