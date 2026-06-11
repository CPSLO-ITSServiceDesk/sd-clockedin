# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a monorepo managed by pnpm containing two packages:
- `frontend`: A Next.js 16.2.6 application with React 19
- `backend`: A placeholder TypeScript package (currently not implemented)

The frontend uses Tailwind CSS for styling and incorporates shadcn/ui components via Radix UI primitives.

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Environment variables:
   - The frontend package includes a `.env` file for environment variables.
   - The backend package also includes a `.env` file (currently unused).

## Development

### Running the application

To start both frontend and backend (though backend is currently a placeholder):
```bash
pnpm dev
```

This runs:
- `pnpm -r dev`: runs dev script for all packages
- `pnpm -r dev --filter backend`: runs dev script for backend (currently just echoes)

Since the backend dev script is a placeholder, effectively only the frontend development server starts.

To run only the frontend:
```bash
pnpm --filter frontend dev
```

To run only the backend (placeholder):
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

### Starting the production build

To start all packages:
```bash
pnpm start
```

To start only the frontend:
```bash
pnpm --filter frontend start
```

### Linting

To lint all packages:
```bash
pnpm lint
```

This runs `eslint .` in the frontend package (backend has no lint script).

To lint only the frontend:
```bash
pnpm --filter frontend lint
```

### Testing

Currently, there is no test setup in either package. When adding tests, consider setting up a testing framework (e.g., Vitest or Jest) and updating the test scripts in the respective package.json files.

## Code Structure

### Frontend (`packages/frontend`)

- `app/`: Next.js 13+ app directory structure
  - `admin/`: Admin route (likely protected area)
  - `globals.css`: Global CSS styles
  - `layout.tsx`: Root layout component
  - `page.tsx`: Home page component
- `components/`: Reusable UI components (shadcn/ui based)
- `hooks/`: Custom React hooks
- `lib/`: Utility functions and shared logic
- `public/`: Static assets
- `styles/`: Additional CSS/Tailwind configuration
- Configuration files:
  - `next.config.mjs`: Next.js configuration
  - `tsconfig.json`: TypeScript configuration
  - `postcss.config.mjs`: PostCSS/Tailwind configuration
  - `components.json`: shadcn/ui configuration

### Backend (`packages/backend`)

- Currently a placeholder with:
  - `package.json`: Basic TypeScript setup
  - `src/`: Empty source directory
  - `.env`: Environment variable placeholder

## Notes

- The backend package is not yet implemented and serves as a scaffold for future development.
- The frontend is a fully functional Next.js application ready for development.
- When working on the backend, remember to update its dev/build/start/lint scripts in `package.json`.
- The root `pnpm dev` command runs both packages concurrently; adjust as needed if backend becomes functional.
