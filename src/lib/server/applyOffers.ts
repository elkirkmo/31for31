import { supabaseAdmin } from './supabaseAdmin'
import type { ScraperOffer } from './scraperClient'
import type { ServiceType } from '../../database.types'

export type ApplyResult = { ok: true } | { ok: false; error: string }

// Replaces a film's stored offers wholesale with a freshly scraped list.
// Shared by the batch refresh flow (/admin/refresh) and the per-film
// "Rescrape this film" action on /admin/films/[id].
export async function applyFilmOffers(filmId: number, offers: ScraperOffer[]): Promise<ApplyResult> {
    const { error: deleteError } = await supabaseAdmin.from('services').delete().eq('film_id', filmId)
    if (deleteError) return { ok: false, error: deleteError.message }

    if (offers.length === 0) return { ok: true }

    const rows = offers.map((o) => ({
        film_id: filmId,
        name: o.name,
        type: o.type as ServiceType,
        price: o.price,
        currency: o.currency,
        link: o.link,
        icon: o.icon
    }))

    const { error: insertError } = await supabaseAdmin.from('services').insert(rows)
    if (insertError) return { ok: false, error: insertError.message }

    return { ok: true }
}
