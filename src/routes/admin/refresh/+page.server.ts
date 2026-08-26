import { requireAdmin } from '$lib/server/requireAdmin'
import { supabaseAdmin } from '$lib/server/supabaseAdmin'
import { scrapeMany, scrapeOne, type FilmResult, type ScraperOffer } from '$lib/server/scraperClient'
import { applyFilmOffers } from '$lib/server/applyOffers'
import { diffServices } from '$lib/server/diffOffers'
import type { Actions } from './$types'

type FilmRow = {
    id: number
    year: number
    title: string
    justwatch_url: string | null
    services: ScraperOffer[]
}

async function loadFilmsWithServices() {
    const { data } = await supabaseAdmin
        .from('films')
        .select('id, year, title, justwatch_url, services(*)')
        .order('year')
        .order('sort_order')
    return (data ?? []) as unknown as FilmRow[]
}

// Our films table is the list now, so the scraper is told what to scrape
// rather than consulting its own copy. That removes the year::title join
// the two sides used to agree on -- results come back in request order, so
// a film is identified by its row, and renaming one can no longer orphan it.
async function scrapeFilms(films: FilmRow[]) {
    const result = await scrapeMany(
        films.map((film) => ({
            title: film.title,
            justwatch_url: film.justwatch_url ?? undefined
        }))
    )
    if (!result.ok) return result

    // Pairing by index is only sound while the lengths agree. If they ever
    // don't, every film after the discrepancy would be written with another
    // film's offers -- refuse rather than corrupt the catalogue.
    if (result.data.length !== films.length) {
        return {
            ok: false as const,
            status: 502,
            error: `Scraper returned ${result.data.length} results for ${films.length} films. Nothing was changed.`
        }
    }
    return result
}

export async function load({ locals }: { locals: App.Locals }) {
    await requireAdmin(locals)
    return {}
}

export const actions: Actions = {
    // Scrapes every film in our table and diffs the result against what we
    // have stored -- never writes anything. Review, then Apply.
    preview: async ({ locals }) => {
        await requireAdmin(locals)

        const films = await loadFilmsWithServices()
        if (films.length === 0) return { preview: [], failed: [] }

        const scrapeResult = await scrapeFilms(films)
        if (!scrapeResult.ok) return { error: scrapeResult.error }

        const preview: {
            filmId: number
            year: number
            title: string
            oldCount: number
            newCount: number
            added: number
            removed: number
            changed: number
        }[] = []
        // A film the scraper couldn't read is not a film with no offers.
        // Diffing it would show every offer being removed, which is a wrong
        // answer rather than a missing one -- so it's listed separately and
        // left out of the preview entirely.
        const failed: string[] = []

        films.forEach((film, i) => {
            const entry = scrapeResult.data[i]
            if (entry.error) {
                failed.push(`${film.title} (${film.year}): ${entry.error}`)
                return
            }
            const diff = diffServices(film.services, entry.service)
            preview.push({
                filmId: film.id,
                year: film.year,
                title: film.title,
                oldCount: film.services.length,
                newCount: entry.service.length,
                added: diff.added.length,
                removed: diff.removed.length,
                changed: diff.changed.length
            })
        })

        return { preview, failed }
    },

    // Re-scrapes just this film fresh (doesn't trust anything from the
    // preview step) and applies it.
    applyOne: async ({ request, locals }) => {
        await requireAdmin(locals)

        const form = await request.formData()
        const filmId = Number(form.get('filmId'))

        const { data: film } = await supabaseAdmin
            .from('films')
            .select('title, justwatch_url')
            .eq('id', filmId)
            .single()
        if (!film) return { error: 'Film not found.' }

        const result = await scrapeOne(film.title, film.justwatch_url ?? undefined)
        if (!result.ok) return { error: result.error }
        if (result.data.error) return { error: result.data.error }

        const applyResult = await applyFilmOffers(filmId, result.data.service)
        if (!applyResult.ok) return { error: applyResult.error }

        return { appliedOne: filmId }
    },

    // Re-scrapes every film fresh and applies them in one pass, rather than
    // trusting the (possibly stale) preview payload.
    applyAll: async ({ locals }) => {
        await requireAdmin(locals)

        const films = await loadFilmsWithServices()
        if (films.length === 0) return { appliedAll: 0, errors: [], cleared: [] }

        const scrapeResult = await scrapeFilms(films)
        if (!scrapeResult.ok) return { error: scrapeResult.error }

        const errors: string[] = []
        const scraped: { film: FilmRow; offers: ScraperOffer[] }[] = []

        films.forEach((film, i) => {
            const entry: FilmResult = scrapeResult.data[i]
            if (entry.error) {
                errors.push(`${film.title}: ${entry.error}`)
                return
            }
            scraped.push({ film, offers: entry.service })
        })

        // A film here and there genuinely streams nowhere. Every film
        // streaming nowhere is a broken scrape, not a catalogue that emptied
        // overnight — and applying it would erase the one thing the site is
        // for. Refuse the whole run rather than write a single row.
        const withOffers = scraped.filter(({ offers }) => offers.length > 0)
        if (scraped.length > 0 && withOffers.length === 0) {
            return {
                error: `Refused: the scrape found no streaming offers for any of the ${scraped.length} films, which means the scrape failed rather than every film leaving every service. Nothing was changed.`
            }
        }

        let appliedCount = 0
        // Films that had offers and now have none. Legitimate one at a time,
        // worth an admin's eyes rather than passing silently inside a count.
        const cleared: string[] = []

        for (const { film, offers } of scraped) {
            const applyResult = await applyFilmOffers(film.id, offers)
            if (!applyResult.ok) {
                errors.push(`${film.title}: ${applyResult.error}`)
                continue
            }
            appliedCount++
            if (offers.length === 0 && film.services.length > 0) {
                cleared.push(`${film.title} — ${film.services.length} offer(s) removed, now streaming nowhere`)
            }
        }

        return { appliedAll: appliedCount, errors, cleared }
    }
}
