import type { Actions } from './$types'
import type { WatchedFilms } from '../database.types'

export async function load({ locals: { supabase, safeGetSession } }) {
    const { user } = await safeGetSession()

    if (!user) {
        return { watched: {} as WatchedFilms }
    }

    const { data } = await supabase
        .from('progress')
        .select('watched')
        .eq('user_id', user.id)
        .maybeSingle()

    return { watched: (data as { watched: WatchedFilms } | null)?.watched ?? {} }
}

export const actions: Actions = {
    toggleWatched: async ({ request, locals: { supabase, safeGetSession } }) => {
        const { user } = await safeGetSession()
        if (!user) return { error: 'Not logged in' }

        const form = await request.formData()
        const title = form.get('title') as string
        const year = form.get('year') as string

        const { data } = await supabase
            .from('progress')
            .select('watched')
            .eq('user_id', user.id)
            .maybeSingle()

        const current = ((data as { watched: WatchedFilms } | null)?.watched ?? {}) as WatchedFilms
        const yearWatched = current[year] ?? []

        const updated = yearWatched.includes(title)
            ? yearWatched.filter((t) => t !== title)
            : [...yearWatched, title]

        const { error: upsertError } = await supabase
            .from('progress')
            .upsert({ user_id: user.id, watched: { ...current, [year]: updated } })

        if (upsertError) {
            console.error('upsert failed:', upsertError)
            return { error: upsertError.message }
        }

        return {}
    }
}
