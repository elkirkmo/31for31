import { error } from '@sveltejs/kit'
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

    const { data: filmRows, error: filmsError } = await supabase
        .from('films')
        .select('id, year, date, title, justwatch_url, services(*)')
        .order('year')
        .order('sort_order')

    // A failed read must not render as an empty list. The film list is the
    // whole page, so "no films" and "the query broke" look identical to a
    // visitor — and identical to us, which is how a production outage went
    // undiagnosed. Log it so it reaches the platform logs, then fail loudly.
    if (filmsError) {
        console.error('films query failed:', filmsError)
        throw error(500, "Couldn't load the films. Please try again.")
    }

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

    // Being able to see an unreleased year is not the same as landing on it.
    // Seeing it is for reviewing the list before it goes live; the front page
    // should still open on what everyone else gets, or an admin arrives to a
    // page of undated placeholders with no offers and reasonably concludes
    // the site is broken.
    const newest = (years: string[]) =>
        years.sort((a, b) => Number(b) - Number(a))[0] ?? null

    const publicYears = Object.keys(visibleYearsOnly(filmsByYear, false))
    const defaultYear = newest(publicYears) ?? newest(Object.keys(visibleFilmsByYear))

    // Flagged in the tab strip so it's obvious which years aren't public yet.
    const unreleasedYears = Object.keys(visibleFilmsByYear).filter(
        (year) => !publicYears.includes(year)
    )

    if (!user) {
        return {
            watched: {} as WatchedFilms,
            filmsByYear: visibleFilmsByYear,
            defaultYear,
            unreleasedYears
        }
    }

    const { data, error: progressError } = await supabase
        .from('progress')
        .select('watched')
        .eq('user_id', user.id)
        .maybeSingle()

    // Logged but not fatal, unlike the films read above: a missing progress
    // row costs the reader their ticks and the progress bar, which is worth
    // knowing about, but it isn't worth taking the whole list down for.
    if (progressError) console.error('progress query failed:', progressError)

    return {
        watched: (data as { watched: WatchedFilms } | null)?.watched ?? {},
        filmsByYear: visibleFilmsByYear,
        defaultYear,
        unreleasedYears
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
