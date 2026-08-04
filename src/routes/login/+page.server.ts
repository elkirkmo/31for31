import { redirect } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
    const { session } = await safeGetSession()
    if (session) throw redirect(303, '/')
    return {}
}

export const actions: Actions = {
    magicLink: async ({ request, locals: { supabase }, url }) => {
        const form = await request.formData()
        const email = form.get('email') as string

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: `${url.origin}/auth/callback` }
        })

        if (error) return { error: error.message }
        return { message: 'Check your email for a login link.' }
    },

    devLogin: async ({ locals: { supabase } }) => {
        const { DEV_LOGIN_EMAIL, DEV_LOGIN_PASSWORD } = env
        if (!DEV_LOGIN_EMAIL || !DEV_LOGIN_PASSWORD) {
            return { error: 'Dev login is not configured. Set DEV_LOGIN_EMAIL and DEV_LOGIN_PASSWORD in .env.local.' }
        }

        const { error } = await supabase.auth.signInWithPassword({
            email: DEV_LOGIN_EMAIL,
            password: DEV_LOGIN_PASSWORD
        })

        if (error) return { error: error.message }
        throw redirect(303, '/')
    }
}
