"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
// script to check if the connection to the supabase database is working
async function main() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
        console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
        process.exit(1);
    }
    const supabase = (0, supabase_js_1.createClient)(url, key);
    const res = await fetch(`${url}/rest/v1/`, {
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
        },
    });
    if (!res.ok) {
        console.error(`Connection failed: ${res.status} ${res.statusText}`);
        console.error('Make sure SUPABASE_ANON_KEY is the JWT anon key (starts with eyJ), not a publishable key.');
        process.exit(1);
    }
    const spec = await res.json();
    const tables = Object.keys(spec.definitions ?? {});
    // Verify the client can actually query
    const { error } = await supabase.from(tables[0]).select('count').limit(0);
    if (error)
        console.warn('Client query warning:', error.message);
    console.log('✓ Connected to Supabase');
    console.log('Tables:', tables.length ? tables.join(', ') : '(none visible — check RLS policies)');
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
