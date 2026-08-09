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

        let appliedCount = 0
        const errors: string[] = []

        for (const [year, entries] of Object.entries(scrapeResult.data)) {
            if (!Array.isArray(entries)) continue
            for (const entry of entries) {
                const film = filmsByKey.get(filmKey(year, entry.title))
                if (!film) continue
                if (entry.error) {
                    errors.push(`${entry.title}: ${entry.error}`)
                    continue
                }

                const applyResult = await applyFilmOffers(film.id, entry.service)
                if (!applyResult.ok) errors.push(`${entry.title}: ${applyResult.error}`)
                else appliedCount++
            }
        }

        return { appliedAll: appliedCount, errors }
    }
}
