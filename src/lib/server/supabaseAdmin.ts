import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { env } from '$env/dynamic/private'
import type { Database } from '../../database.types'

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — required for admin-only Supabase access.')
}

// Server-only client using the service role key — bypasses RLS. Never
// import this from client-reachable code; it lives under lib/server so
// SvelteKit refuses to bundle it into the client build.
export const supabaseAdmin = createClient<Database>(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
})
