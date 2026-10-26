import { requireAdmin } from '$lib/server/requireAdmin'
import { createFilm } from '$lib/server/scraperClient'
import type { Actions } from './$types'

export const actions: Actions = {
    default: async ({ request, locals }) => {
        await requireAdmin(locals)

        const form = await request.formData()
        const year = (form.get('year') as string)?.trim()
        const title = (form.get('title') as string)?.trim()
        const date = (form.get('date') as string)?.trim()
        const justwatch_url = (form.get('justwatch_url') as string)?.trim() || null

        if (!year || !title) return { error: 'Year and title are required.' }
        if (!/^\d{4}$/.test(year)) return { error: 'Year must be a 4-digit number.' }
        // films.date is NOT NULL, and it's what the film displays as on the
        // list. Asking for it here beats surfacing a constraint error.
        if (!date) return { error: 'Date is required.' }

        // sort_order is omitted deliberately: the scraper appends to the end
        // of the year. This app used to read the current maximum and add one,
        // which was a decision about film data and so belongs over there.
        const result = await createFilm({ year: Number(year), title, date, justwatch_url })

        if (!result.ok) {
            // unique (year, title) -- was Postgres 23505, now an HTTP status.
            if (result.status === 409) return { error: `${title} is already on the ${year} list.` }
            return { error: result.error }
        }

        // Offers aren't fetched here — the film lands with none until a
        // refresh, same as before. Its justwatch_url travels with that
        // scrape, so an override set at creation is honoured immediately.
        const { id, year: filmYear, title: filmTitle, date: filmDate, justwatch_url: filmUrl } = result.data
        return { success: true, film: { id, year: filmYear, title: filmTitle, date: filmDate, justwatch_url: filmUrl } }
    }
}
