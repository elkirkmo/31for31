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
