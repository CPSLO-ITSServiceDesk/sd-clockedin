import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'


// script to check if the connection to the supabase database is working
async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  })

  if (!res.ok) {
    console.error(`Connection failed: ${res.status} ${res.statusText}`)
    console.error(
      'Make sure SUPABASE_SERVICE_ROLE_KEY is the service_role secret from Supabase (starts with eyJ).',
    )
    process.exit(1)
  }

  const spec = await res.json() as { definitions?: Record<string, unknown> }
  const tables = Object.keys(spec.definitions ?? {})

  const { count, error } = await supabase
    .from('admins')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.warn('admins query warning:', error.message)
  }

  console.log('✓ Connected to Supabase')
  console.log('Tables:', tables.length ? tables.join(', ') : '(none visible)')
  console.log(`admins rows visible to backend: ${count ?? 0}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
