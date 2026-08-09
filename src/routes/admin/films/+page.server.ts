import { requireAdmin } from '$lib/server/requireAdmin'
import { supabaseAdmin } from '$lib/server/supabaseAdmin'

export type FilmListEntry = {
    id: number
    year: number
    date: string
    title: string
    justwatch_url: string | null
    serviceCount: number
}

export async function load({ locals }: { locals: App.Locals }) {
    await requireAdmin(locals)

    const { data: films } = await supabaseAdmin
        .from('films')
        .select('id, year, date, title, justwatch_url, services(id)')
        .order('year')
        .order('sort_order')

    const filmsByYear: Record<string, FilmListEntry[]> = {}
    for (const film of (films ?? []) as unknown as (FilmListEntry & { services: { id: number }[] })[]) {
        const year = String(film.year)
        if (!filmsByYear[year]) filmsByYear[year] = []
        filmsByYear[year].push({
            id: film.id,
            year: film.year,
            date: film.date,
            title: film.title,
            justwatch_url: film.justwatch_url,
            serviceCount: film.services.length
        })
    }

    return { filmsByYear }
}
