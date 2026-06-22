Plan: Backend API Structure + Frontend API Wrapper

 Context

 The Supabase connection is live and types are generated. The backend is still an empty scaffold — no HTTP server, no routes. The frontend has all its UI built with mock/static data. The goal is
 to:
 1. Stand up a typed REST API on the backend (Hono framework)
 2. Create a thin API wrapper in the frontend so components call real data instead of mocks

 Tables in the DB: schedule_blocks, student_assistant, schedules, admins, time_entry, academic_term

 ---
 Part 1: Backend API (Hono)

 Why Hono: lightweight, TypeScript-first, minimal boilerplate, fast. Works identically in Node.js and edge runtimes.

 Install

 pnpm --filter backend add hono @hono/node-server

 Directory structure

 packages/backend/src/
 ├── index.ts                    ← entry point, registers all routes
 ├── lib/
 │   └── supabase.ts             ← existing
 ├── routes/
 │   ├── time-entries.ts
 │   ├── schedules.ts
 │   ├── schedule-blocks.ts
 │   ├── student-assistants.ts
 │   ├── admins.ts
 │   └── academic-terms.ts
 ├── scripts/
 │   └── check-connection.ts     ← existing
 └── types/
     └── database.types.ts       ← generated

 src/index.ts pattern

 import 'dotenv/config'
 import { serve } from '@hono/node-server'
 import { Hono } from 'hono'
 import { cors } from 'hono/cors'
 import timeEntries from './routes/time-entries'
 import schedules from './routes/schedules'
 // ... other routes

 const app = new Hono()

 app.use('*', cors())

 app.route('/api/time-entries', timeEntries)
 app.route('/api/schedules', schedules)
 // ... mount all routes

 serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3001) }, (info) => {
   console.log(`Backend running on http://localhost:${info.port}`)
 })

 Route file pattern (repeat for each resource)

 // routes/time-entries.ts
 import { Hono } from 'hono'
 import { supabase } from '../lib/supabase'

 const app = new Hono()

 app.get('/', async (c) => {
   const { data, error } = await supabase.from('time_entry').select('*')
   if (error) return c.json({ error: error.message }, 500)
   return c.json(data)
 })

 app.post('/', async (c) => {
   const body = await c.req.json()
   const { data, error } = await supabase.from('time_entry').insert(body).select().single()
   if (error) return c.json({ error: error.message }, 500)
   return c.json(data, 201)
 })

 // PATCH /:id and DELETE /:id follow same pattern

 export default app

 Update package.json scripts

 "dev": "tsx watch src/index.ts",
 "build": "tsc",
 "start": "node dist/index.js"

 ---
 Part 2: Frontend API Wrapper

 Why a wrapper layer: components should not contain raw fetch() calls. A dedicated lib/api/ module centralizes the base URL, error handling, and types. When the backend URL changes (e.g. staging
 vs prod), only one env var changes — not every component.

 Add env var to packages/frontend/.env

 NEXT_PUBLIC_API_URL=http://localhost:3001

 Directory structure

 packages/frontend/lib/
 ├── utils.ts            ← existing
 └── api/
     ├── client.ts       ← base fetch wrapper
     ├── time-entries.ts
     ├── schedules.ts
     ├── schedule-blocks.ts
     ├── student-assistants.ts
     └── index.ts        ← re-exports everything

 lib/api/client.ts pattern

 const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

 export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
   const res = await fetch(`${BASE}${path}`, {
     headers: { 'Content-Type': 'application/json', ...init?.headers },
     ...init,
   })
   if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
   return res.json() as Promise<T>
 }

 Per-resource module pattern

 // lib/api/time-entries.ts
 import { apiFetch } from './client'
 import type { Database } from '../../(shared types or local copy)'

 type TimeEntry = Database['public']['Tables']['time_entry']['Row']

 export const timeEntriesApi = {
   list: () => apiFetch<TimeEntry[]>('/api/time-entries'),
   create: (body: Partial<TimeEntry>) =>
     apiFetch<TimeEntry>('/api/time-entries', { method: 'POST', body: JSON.stringify(body) }),
 }

 Usage in a component / server action

 import { timeEntriesApi } from '@/lib/api'
 const entries = await timeEntriesApi.list()

 ---
 Files to Create/Modify

 ┌─────────────────────────────────────┬───────────────────────────────────────────┐
 │                File                 │                  Action                   │
 ├─────────────────────────────────────┼───────────────────────────────────────────┤
 │ packages/backend/package.json       │ Add hono + update dev/build/start scripts │
 ├─────────────────────────────────────┼───────────────────────────────────────────┤
 │ packages/backend/src/index.ts       │ Create — Hono app entry point             │
 ├─────────────────────────────────────┼───────────────────────────────────────────┤
 │ packages/backend/src/routes/*.ts    │ Create — one file per resource (6 total)  │
 ├─────────────────────────────────────┼───────────────────────────────────────────┤
 │ packages/frontend/.env              │ Add NEXT_PUBLIC_API_URL                   │
 ├─────────────────────────────────────┼───────────────────────────────────────────┤
 │ packages/frontend/lib/api/client.ts │ Create — base fetch wrapper               │
 ├─────────────────────────────────────┼───────────────────────────────────────────┤
 │ packages/frontend/lib/api/*.ts      │ Create — one file per resource            │
 ├─────────────────────────────────────┼───────────────────────────────────────────┤
 │ packages/frontend/lib/api/index.ts  │ Create — barrel re-export                 │
 └─────────────────────────────────────┴───────────────────────────────────────────┘

 ---
 Order of implementation

 1. Backend: install Hono → src/index.ts → all 6 route files → update scripts
 2. Run backend (pnpm --filter backend dev) and confirm routes respond
 3. Frontend: lib/api/client.ts → per-resource modules → index.ts
 4. Verify one component (e.g. clocked-in-table.tsx) replaced with real API call

 Verification

 - curl http://localhost:3001/api/time-entries returns JSON from Supabase
 - Frontend clocked-in-table.tsx renders real data from the API
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌