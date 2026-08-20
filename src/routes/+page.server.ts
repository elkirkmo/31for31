import type { Actions } from './$types'
import type { WatchedFilms } from '../database.types'
import { dev } from '$app/environment'
import { visibleYearsOnly } from '$lib/yearVisibility'

export type FilmEntry = {
    id: number
    date: string
    title: string
    justwatch_url: string | null
    service: {
        name: string
        type: string
        price: number | null
        currency: string | null
        link: string | null
        icon: string | null
    }[]
}

export async function load({ locals: { supabase, safeGetSession }, parent }) {
    const { user } = await safeGetSession()
    const { isAdmin } = await parent()

    const { data: filmRows } = await supabase
        .from('films')
        .select('id, year, date, title, justwatch_url, services(*)')
        .order('year')
        .order('sort_order')

    const filmsByYear: Record<string, FilmEntry[]> = {}
    for (const row of (filmRows ?? []) as unknown as (FilmEntry & { year: number; services: FilmEntry['service'] })[]) {
        const year = String(row.year)
        if (!filmsByYear[year]) filmsByYear[year] = []
        filmsByYear[year].push({
            id: row.id,
            date: row.date,
            title: row.title,
            justwatch_url: row.justwatch_url,
            service: row.services
        })
    }

    // Years that haven't reached their October 1 yet are still scraper
    // placeholders, so the public never sees them. Admins do, and so does
    // anyone running locally — same dev bypass as `requireAdmin`, so the
    // next year's list can be worked on without an is_admin profile.
    // The filter runs server-side so a hidden year never reaches the browser.
    const visibleFilmsByYear = visibleYearsOnly(filmsByYear, isAdmin || dev)

    if (!user) {
        return { watched: {} as WatchedFilms, filmsByYear: visibleFilmsByYear }
    }

    const { data } = await supabase
        .from('progress')
        .select('watched')
        .eq('user_id', user.id)
        .maybeSingle()

    return {
        watched: (data as { watched: WatchedFilms } | null)?.watched ?? {},
        filmsByYear: visibleFilmsByYear
    }
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
