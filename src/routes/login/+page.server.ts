import { redirect } from '@sveltejs/kit'
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
        const { error } = await supabase.auth.signInWithPassword({
            email: 'dev@example.com',
            password: 'devpassword'
        })

        if (error) return { error: error.message }
        throw redirect(303, '/')
    }
}
