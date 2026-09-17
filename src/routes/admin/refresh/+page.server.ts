import { requireAdmin } from '$lib/server/requireAdmin'
import {
    listFilms,
    refreshFilm,
    refreshAllFilms,
    scrapeMany,
    type ScraperFilm
} from '$lib/server/scraperClient'
import { diffServices } from '$lib/server/diffOffers'
import type { Actions } from './$types'

// The batch dry-run still goes through POST /api/scrape, which answers in
// request order, so the caller pairs results to films by index. The scraper
// is meant to grow POST /films/preview and key the diff by film_id itself;
// until it does, the pairing -- and the guard below -- stay here.
async function scrapeFilms(films: ScraperFilm[]) {
    const result = await scrapeMany(
        films.map((film) => ({
            title: film.title,
            justwatch_url: film.justwatch_url ?? undefined
        }))
    )
    if (!result.ok) return result

    // Pairing by index is only sound while the lengths agree. This path
    // writes nothing, so a mismatch shows the wrong diff rather than
    // corrupting anything -- but a confidently wrong preview is worse than
    // no preview, so refuse it.
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
    // Scrapes every film and diffs the result against what's stored --
    // never writes anything. Review, then Apply.
    preview: async ({ locals }) => {
        await requireAdmin(locals)

        const filmsResult = await listFilms()
        if (!filmsResult.ok) return { error: filmsResult.error }

        const films = filmsResult.data
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

    // One film, re-scraped and stored server-side.
    applyOne: async ({ request, locals }) => {
        await requireAdmin(locals)

        const form = await request.formData()
        const filmId = Number(form.get('filmId'))

        const result = await refreshFilm(filmId)
        if (!result.ok) {
            if (result.status === 404) return { error: 'Film not found.' }
            if (result.status === 502) return { error: `${result.error} The existing offers were left unchanged.` }
            return { error: result.error }
        }
        if (!result.data.refreshed) {
            return { error: `${result.data.error ?? 'The scrape failed.'} The existing offers were left unchanged.` }
        }

        return { appliedOne: filmId }
    },

    // The whole catalogue in one pass, scraped and stored server-side.
    //
    // The "every readable film came back empty = broken scrape, refuse the
    // run" guard lives in the scraper now and answers 502; this renders that
    // message rather than reimplementing the rule. Likewise there is no
    // index pairing to get wrong -- each result carries its own film_id.
    applyAll: async ({ locals }) => {
        await requireAdmin(locals)

        // Read the catalogue first purely to know which films *had* offers.
        // The refresh response reports how many offers each film ended with
        // but not what it started with, so "had offers, now has none" can
        // only be worked out against a before picture. When the response
        // carries `cleared` itself, this read and the derivation below go.
        const before = await listFilms()
        const offerCountBefore = new Map<number, number>()
        if (before.ok) {
            for (const film of before.data) offerCountBefore.set(film.id, film.services.length)
        } else {
            // Not fatal: losing the before picture costs the `cleared`
            // report, not the refresh itself.
            console.error('pre-refresh films read failed:', before.status, before.error)
        }

        const result = await refreshAllFilms()
        if (!result.ok) return { error: result.error }

        const errors: string[] = []
        // Films that had offers and now have none. Legitimate one at a time,
        // worth an admin's eyes rather than passing silently inside a count.
        const cleared: string[] = []

        for (const entry of result.data.results) {
            if (!entry.refreshed) {
                errors.push(`${entry.title}: ${entry.error ?? 'scrape failed'}`)
                continue
            }
            const had = offerCountBefore.get(entry.film_id) ?? 0
            if (entry.services_updated === 0 && had > 0) {
                cleared.push(`${entry.title} — ${had} offer(s) removed, now streaming nowhere`)
            }
        }

        return { appliedAll: result.data.refreshed, errors, cleared }
    }
}
