import { error } from '@sveltejs/kit'
import { requireAdmin } from '$lib/server/requireAdmin'
import {
    getFilm,
    updateFilm,
    deleteFilm,
    refreshFilm,
    scrapeOne
} from '$lib/server/scraperClient'
import { diffServices } from '$lib/server/diffOffers'
import type { Actions } from './$types'

export async function load({ params, locals }: { params: { id: string }; locals: App.Locals }) {
    await requireAdmin(locals)

    const result = await getFilm(Number(params.id))
    if (!result.ok) {
        if (result.status === 404) throw error(404, 'Film not found')
        throw error(500, `Couldn't load the film: ${result.error}`)
    }

    return { film: result.data }
}

export const actions: Actions = {
    update: async ({ request, params, locals }) => {
        await requireAdmin(locals)

        const filmId = Number(params.id)
        const form = await request.formData()
        const title = (form.get('title') as string)?.trim()
        const date = (form.get('date') as string)?.trim()
        const justwatch_url = (form.get('justwatch_url') as string)?.trim() || null

        if (!title) return { error: 'Title is required.' }
        if (!date) return { error: 'Date is required.' }

        // Renaming a film orphans it in every user's progress, which stores
        // watched titles as bare strings — they'll show as "no longer on the
        // list" on /account. Known, pre-existing, and not worth blocking an
        // edit over; noted so it isn't a surprise.
        //
        // justwatch_url is sent even when null, which is how the override is
        // cleared rather than left untouched.
        const result = await updateFilm(filmId, { title, date, justwatch_url })

        if (!result.ok) {
            if (result.status === 409) return { error: `Another film that year is already called ${title}.` }
            if (result.status === 404) return { error: 'Film not found.' }
            return { error: result.error }
        }

        return { success: true }
    },

    delete: async ({ params, locals }) => {
        await requireAdmin(locals)

        // The film's offers cascade with it server-side, so this is the whole
        // operation.
        const result = await deleteFilm(Number(params.id))

        if (!result.ok) {
            if (result.status === 404) return { error: 'Film not found.' }
            return { error: result.error }
        }

        return { success: true, deleted: true }
    },

    // Preview-only: scrapes this film ad hoc and diffs it against what's
    // currently stored. Writes nothing.
    //
    // The scraper is meant to grow POST /films/{id}/preview and return the
    // diff itself; that endpoint is not in the deployed API yet, so the diff
    // is still computed here from a stored read plus a dry-run scrape. When
    // it ships, this action collapses to forwarding the response and
    // diffOffers.ts goes with it.
    rescrape: async ({ params, locals }) => {
        await requireAdmin(locals)

        const filmResult = await getFilm(Number(params.id))
        if (!filmResult.ok) {
            if (filmResult.status === 404) return { error: 'Film not found.' }
            return { error: filmResult.error }
        }
        const film = filmResult.data

        const result = await scrapeOne(film.title, film.justwatch_url ?? undefined)
        if (!result.ok) return { error: result.error }
        if (result.data.error) return { error: result.data.error }

        const diff = diffServices(film.services, result.data.service)
        return {
            rescrapePreview: {
                added: diff.added.length,
                removed: diff.removed.length,
                changed: diff.changed.length,
                unchanged: diff.unchanged.length
            }
        }
    },

    // Re-scrapes fresh and applies it, all server-side. This app no longer
    // sees the offers or writes them.
    applyRescrape: async ({ params, locals }) => {
        await requireAdmin(locals)

        const result = await refreshFilm(Number(params.id))

        if (!result.ok) {
            if (result.status === 404) return { error: 'Film not found.' }
            // 502 is the scrape failing, which leaves the stored offers
            // untouched -- materially different from refreshing to nothing,
            // so the message says so rather than reading as a wipe.
            if (result.status === 502) return { error: `${result.error} The existing offers were left unchanged.` }
            return { error: result.error }
        }

        // A film can come back refreshed: false inside a 200 when its own
        // scrape failed; its offers were left alone too.
        if (!result.data.refreshed) {
            return { error: `${result.data.error ?? 'The scrape failed.'} The existing offers were left unchanged.` }
        }

        return { rescraped: true }
    }
}
