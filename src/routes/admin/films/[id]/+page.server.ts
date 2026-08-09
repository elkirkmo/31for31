import { error } from '@sveltejs/kit'
import { requireAdmin } from '$lib/server/requireAdmin'
import { supabaseAdmin } from '$lib/server/supabaseAdmin'
import { replaceYear, scrapeOne, type ScraperOffer } from '$lib/server/scraperClient'
import { applyFilmOffers } from '$lib/server/applyOffers'
import { diffServices } from '$lib/server/diffOffers'
import type { Actions } from './$types'

type YearFilm = { id: number; date: string; title: string; justwatch_url: string | null }

async function loadYearFilms(year: number) {
    const { data } = await supabaseAdmin
        .from('films')
        .select('id, date, title, justwatch_url')
        .eq('year', year)
        .order('sort_order')
    return (data ?? []) as YearFilm[]
}

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
        const { data: current } = await supabaseAdmin.from('films').select('year').eq('id', filmId).single()
        if (!current) return { error: 'Film not found.' }

        const form = await request.formData()
        const title = (form.get('title') as string)?.trim()
        const date = (form.get('date') as string)?.trim() || undefined
        const justwatch_url = (form.get('justwatch_url') as string)?.trim() || undefined

        if (!title) return { error: 'Title is required.' }

        const yearFilms = await loadYearFilms(current.year)
        const updatedList = yearFilms.map((f) =>
            f.id === filmId
                ? { title, date, justwatch_url }
                : { title: f.title, date: f.date, justwatch_url: f.justwatch_url ?? undefined }
        )

        const result = await replaceYear(String(current.year), updatedList)
        if (!result.ok) return { error: result.error }

        return { success: true }
    },

    delete: async ({ params, locals }) => {
        await requireAdmin(locals)

        const filmId = Number(params.id)
        const { data: current } = await supabaseAdmin.from('films').select('year').eq('id', filmId).single()
        if (!current) return { error: 'Film not found.' }

        const yearFilms = await loadYearFilms(current.year)
        const updatedList = yearFilms
            .filter((f) => f.id !== filmId)
            .map((f) => ({ title: f.title, date: f.date, justwatch_url: f.justwatch_url ?? undefined }))

        const result = await replaceYear(String(current.year), updatedList)
        if (!result.ok) return { error: result.error }

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
