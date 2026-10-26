import { error } from '@sveltejs/kit'
import type { Actions } from './$types'
import type { WatchedFilms } from '../database.types'
import { dev } from '$app/environment'
import { visibleYearsOnly } from '$lib/yearVisibility'
import { getLiked, listFilms, setLiked, type LikedFilms } from '$lib/server/scraperClient'

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
    const { session, user } = await safeGetSession()
    const { isAdmin } = await parent()

    // The catalogue comes from the scraper now, not Supabase. It arrives
    // already ordered by year then sort_order -- that ordering is the API's
    // to decide, so nothing here re-sorts it.
    const filmsResult = await listFilms()

    // A failed read must not render as an empty list. The film list is the
    // whole page, so "no films" and "the read broke" look identical to a
    // visitor — and identical to us, which is how a production outage went
    // undiagnosed. That risk is larger now, not smaller: the scraper is a
    // hard runtime dependency of this page, so its outage is this page's
    // outage. Log it so it reaches the platform logs, then fail loudly.
    if (!filmsResult.ok) {
        console.error('films request failed:', filmsResult.status, filmsResult.error)
        throw error(500, "Couldn't load the films. Please try again.")
    }

    const filmsByYear: Record<string, FilmEntry[]> = {}
    for (const row of filmsResult.data) {
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

    if (!user || !session) {
        return {
            watched: {} as WatchedFilms,
            liked: {} as LikedFilms,
            filmsByYear: visibleFilmsByYear,
            defaultYear,
            unreleasedYears
        }
    }

    // Likes come from the scraper, as the user, like everything else this
    // app knows about films; `watched` is still read here directly. Run side
    // by side so the extra hop doesn't add to the page's load time.
    const [{ data, error: progressError }, likedResult] = await Promise.all([
        supabase.from('progress').select('watched').eq('user_id', user.id).maybeSingle(),
        getLiked(session.access_token)
    ])

    // Logged but not fatal, unlike the films read above: a missing progress
    // row costs the reader their ticks and the progress bar, which is worth
    // knowing about, but it isn't worth taking the whole list down for.
    // Likes are the same -- hearts showing empty beats no page.
    if (progressError) console.error('progress query failed:', progressError)
    if (!likedResult.ok) console.error('liked request failed:', likedResult.status, likedResult.error)

    return {
        watched: (data as { watched: WatchedFilms } | null)?.watched ?? {},
        liked: likedResult.ok ? likedResult.data : {},
        filmsByYear: visibleFilmsByYear,
        defaultYear,
        unreleasedYears
    }
}

export const actions: Actions = {
    // The heart. Sends the state the reader asked for (`liked` = "true" to
    // like, anything else to unlike) rather than a toggle, so it can't flip
    // back on a double submit. The scraper owns the write and the title check.
    setLiked: async ({ request, locals: { safeGetSession } }) => {
        const { session } = await safeGetSession()
        if (!session) return { error: 'Not logged in' }

        const form = await request.formData()
        const title = form.get('title') as string
        const year = Number(form.get('year'))
        const liked = form.get('liked') === 'true'

        const result = await setLiked(session.access_token, { year, title }, liked)
        if (!result.ok) {
            console.error('setLiked failed:', result.status, result.error)
            if (result.status === 401) return { error: 'Your session has expired. Please log in again.' }
            return { error: result.error }
        }

        return {}
    },

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
