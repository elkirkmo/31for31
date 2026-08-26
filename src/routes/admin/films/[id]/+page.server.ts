import { error } from '@sveltejs/kit'
import { requireAdmin } from '$lib/server/requireAdmin'
import { supabaseAdmin } from '$lib/server/supabaseAdmin'
import { scrapeOne, type ScraperOffer } from '$lib/server/scraperClient'
import { applyFilmOffers } from '$lib/server/applyOffers'
import { diffServices } from '$lib/server/diffOffers'
import type { Actions } from './$types'

export async function load({ params, locals }: { params: { id: string }; locals: App.Locals }) {
    await requireAdmin(locals)

    const { data: film } = await supabaseAdmin
        .from('films')
        .select('id, year, date, title, justwatch_url, services(*)')
        .eq('id', Number(params.id))
        .single()

    if (!film) throw error(404, 'Film not found')

    return { film }
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
        const { error: updateError } = await supabaseAdmin
            .from('films')
            .update({ title, date, justwatch_url })
            .eq('id', filmId)
            .select('id')
            .single()

        if (updateError) {
            if (updateError.code === '23505') {
                return { error: `Another film that year is already called ${title}.` }
            }
            if (updateError.code === 'PGRST116') return { error: 'Film not found.' }
            return { error: updateError.message }
        }

        return { success: true }
    },

    delete: async ({ params, locals }) => {
        await requireAdmin(locals)

        const filmId = Number(params.id)

        // services cascade with the row (FK to films.id ON DELETE CASCADE),
        // so this is the whole operation.
        const { error: deleteError } = await supabaseAdmin
            .from('films')
            .delete()
            .eq('id', filmId)
            .select('id')
            .single()

        if (deleteError) {
            if (deleteError.code === 'PGRST116') return { error: 'Film not found.' }
            return { error: deleteError.message }
        }

        return { success: true, deleted: true }
    },

    // Preview-only: scrapes this film ad hoc (independent of the scraper's
    // own film list, so this also works for a film that only exists in our
    // table) and diffs it against what's currently stored. Doesn't write.
    rescrape: async ({ params, locals }) => {
        await requireAdmin(locals)

        const filmId = Number(params.id)
        const { data: film } = await supabaseAdmin
            .from('films')
            .select('title, justwatch_url, services(*)')
            .eq('id', filmId)
            .single()
        if (!film) return { error: 'Film not found.' }

        const result = await scrapeOne(film.title, film.justwatch_url ?? undefined)
        if (!result.ok) return { error: result.error }
        if (result.data.error) return { error: result.data.error }

        const diff = diffServices(film.services as ScraperOffer[], result.data.service)
        return {
            rescrapePreview: {
                added: diff.added.length,
                removed: diff.removed.length,
                changed: diff.changed.length,
                unchanged: diff.unchanged.length
            }
        }
    },

    // Re-scrapes fresh (doesn't trust the preview payload) and applies it.
    applyRescrape: async ({ params, locals }) => {
        await requireAdmin(locals)

        const filmId = Number(params.id)
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

        return { rescraped: true }
    }
}
