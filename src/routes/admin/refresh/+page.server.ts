import { requireAdmin } from '$lib/server/requireAdmin'
import { supabaseAdmin } from '$lib/server/supabaseAdmin'
import { scrapeAll, scrapeOne, type ScraperOffer } from '$lib/server/scraperClient'
import { applyFilmOffers } from '$lib/server/applyOffers'
import { diffServices } from '$lib/server/diffOffers'
import type { Actions } from './$types'

type FilmRow = { id: number; year: number; title: string; services: ScraperOffer[] }

async function loadFilmsWithServices() {
    const { data } = await supabaseAdmin.from('films').select('id, year, title, services(*)')
    return (data ?? []) as unknown as FilmRow[]
}

function filmKey(year: string | number, title: string) {
    return `${year}::${title}`
}

export async function load({ locals }: { locals: App.Locals }) {
    await requireAdmin(locals)
    return {}
}

export const actions: Actions = {
    // Scrapes every film the scraper knows about and diffs it against what
    // we have stored — never writes anything. Review, then Apply.
    preview: async ({ locals }) => {
        await requireAdmin(locals)

        const scrapeResult = await scrapeAll()
        if (!scrapeResult.ok) return { error: scrapeResult.error }

        const films = await loadFilmsWithServices()
        const filmsByKey = new Map(films.map((f) => [filmKey(f.year, f.title), f]))

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
        const unmatched: string[] = []

        for (const [year, entries] of Object.entries(scrapeResult.data)) {
            if (!Array.isArray(entries)) continue // e.g. "textContent" passthrough
            for (const entry of entries) {
                const film = filmsByKey.get(filmKey(year, entry.title))
                if (!film) {
                    unmatched.push(`${entry.title} (${year})`)
                    continue
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
            }
        }

        return { preview, unmatched }
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

    // Re-scrapes everything fresh and applies every matched film in one
    // pass, rather than trusting the (possibly stale) preview payload.
    applyAll: async ({ locals }) => {
        await requireAdmin(locals)

        const scrapeResult = await scrapeAll()
        if (!scrapeResult.ok) return { error: scrapeResult.error }

        const films = await loadFilmsWithServices()
        const filmsByKey = new Map(films.map((f) => [filmKey(f.year, f.title), f]))

        const errors: string[] = []
        const matched: { film: FilmRow; entry: { title: string; service: ScraperOffer[] } }[] = []

        for (const [year, entries] of Object.entries(scrapeResult.data)) {
            if (!Array.isArray(entries)) continue
            for (const entry of entries) {
                const film = filmsByKey.get(filmKey(year, entry.title))
                if (!film) continue
                if (entry.error) {
                    errors.push(`${entry.title}: ${entry.error}`)
                    continue
                }
                matched.push({ film, entry })
            }
        }

        // A film here and there genuinely streams nowhere. Every film
        // streaming nowhere is a broken scrape, not a catalogue that emptied
        // overnight — and applying it would erase the one thing the site is
        // for. Refuse the whole run rather than write a single row.
        const withOffers = matched.filter(({ entry }) => entry.service.length > 0)
        if (matched.length > 0 && withOffers.length === 0) {
            return {
                error: `Refused: the scrape found no streaming offers for any of the ${matched.length} matched films, which means the scrape failed rather than every film leaving every service. Nothing was changed.`
            }
        }

        let appliedCount = 0
        // Films that had offers and now have none. Legitimate one at a time,
        // worth an admin's eyes rather than passing silently inside a count.
        const cleared: string[] = []

        for (const { film, entry } of matched) {
            const applyResult = await applyFilmOffers(film.id, entry.service)
            if (!applyResult.ok) {
                errors.push(`${entry.title}: ${applyResult.error}`)
                continue
            }
            appliedCount++
            if (entry.service.length === 0 && film.services.length > 0) {
                cleared.push(`${entry.title} — ${film.services.length} offer(s) removed, now streaming nowhere`)
            }
        }

        return { appliedAll: appliedCount, errors, cleared }
    }
}
