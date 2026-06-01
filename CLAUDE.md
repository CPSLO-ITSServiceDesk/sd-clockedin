# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Root Level
- `npm run dev` - Start both frontend and backend concurrently in development mode
- `npm run lint` - Run ESLint on both frontend and backend
- `npm run lint:fix` - Run ESLint with auto-fix on both packages
- `npm run format` - Format code with Prettier across both packages
- `npm run format:check` - Check formatting with Prettier

### Backend (Express)
Located in `packages/express-backend`:
- `npm run dev` - Start backend server with ts-node
- `npm run dev:watch` - Start backend with nodemon for auto-restart on file changes
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start built server from dist/
- `npm run lint` - Run ESLint on backend source
- `npm run lint:fix` - Fix linting errors in backend

### Frontend (React/Next.js)
Located in `packages/react-frontend`:
- `npm run dev` - Start Next.js development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint on frontend source
- `npm run lint:fix` - Fix linting errors in frontend

## Code Architecture

### Monorepo Structure
- Uses npm workspaces with two main packages:
  - `packages/express-backend` - Node.js/Express API server
  - `packages/react-frontend` - Next.js React application
- Shared code lives in `packages/shared` (TypeScript utilities/types)

### Backend Architecture
- Express.js server with TypeScript
- MongoDB/Mongoose for data modeling
- Key models:
  - Student: Tracks student information with status field (incoming/active/inactive)
  - CheckIn: Records student check-in/check-out events with automatic status updates
- Middleware:
  - CORS enabled
  - Automatic student status updates via CheckIn model middleware
- Environment variables loaded via dotenv
- RESTful API endpoints under `/api` routes

### Frontend Architecture
- Next.js 13+ with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Key features:
  - Student dashboard showing check-in status
  - Admin interface for managing students and viewing check-in history
  - Authentication flow (login/logout)
  - Real-time status updates
- State management:
  - React hooks for local state
  - Potential use of React Query or similar for data fetching (investigate actual implementation)
- Components organized by feature in `components/`
- Custom hooks in `hooks/`
- Utility functions in `lib/`

### Shared Package
- Contains TypeScript interfaces and types shared between frontend and backend
- Ensures consistency in data shapes (e.g., Student, CheckIn types)

## Important Files
- Root `package.json` - Defines workspaces and cross-package scripts
- Backend `src/index.ts` - Entry point for Express server
- Frontend `app/` - Next.js app router pages and layouts
- Backend `src/models/` - Mongoose schema definitions
- Frontend `components/` - Reusable UI components

## Data Flow
1. Frontend makes API requests to backend endpoints
2. Backend processes requests, interacts with MongoDB
3. CheckIn model middleware automatically updates Student.status on save
4. Backend returns JSON responses to frontend
5. Frontend updates UI based on API responses
