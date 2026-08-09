import { error, redirect } from '@sveltejs/kit'
import { dev } from '$app/environment'

// Gate for anything admin-only. Every admin route's `load` AND every
// action must call this directly — a parent +layout.server.ts load does
// not gate child form actions in SvelteKit, they run independently.
export async function requireAdmin(locals: App.Locals) {
    const { user } = await locals.safeGetSession()
    if (!user) throw redirect(303, '/login')

    // In dev, skip the real role check so /admin is reachable locally
    // without needing the Supabase-backed role flow fully set up/testable
    // (there's no local Supabase instance yet). Production builds have
    // dev === false, so the real RLS-backed check always applies there.
    if (dev) return { user }

    const { data: profile } = await locals.supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

    if (!profile?.is_admin) throw error(403, 'Not authorized')

    return { user }
}
