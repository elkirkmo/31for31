import { supabaseAdmin } from './supabaseAdmin'
import type { ScraperOffer } from './scraperClient'
import type { ServiceType } from '../../database.types'

export type ApplyResult = { ok: true } | { ok: false; error: string }

// service.link is rendered as a public <a href> and service.icon as an
// <img src> for every site visitor (see listing.svelte) -- both come from
// the scraper, so reject anything that isn't a plain https URL rather than
// trusting it verbatim (e.g. a javascript: URI would be clickable-XSS on
// the homepage). https-only, not http: every current offer already uses
// https (verified against production), so there's no legitimate case to
// accommodate, and it avoids mixed-content issues on our https site.
function sanitizeUrl(value: string | null): string | null {
    if (!value) return null
    try {
        const url = new URL(value)
        return url.protocol === 'https:' ? value : null
    } catch {
        return null
    }
}

// Replaces a film's stored offers wholesale with a freshly scraped list.
// Shared by the batch refresh flow (/admin/refresh) and the per-film
// "Rescrape this film" action on /admin/films/[id].
//
// An empty offer list is a legitimate state -- a few films genuinely stream
// nowhere -- so this applies it. The check that a whole scrape hasn't come
// back empty belongs to the caller, which can see the run as a whole; see
// the applyAll action in admin/refresh.
export async function applyFilmOffers(filmId: number, offers: ScraperOffer[]): Promise<ApplyResult> {
    const { data: existing, error: readError } = await supabaseAdmin
        .from('services')
        .select('id')
        .eq('film_id', filmId)
    if (readError) return { ok: false, error: readError.message }

    const rows = offers.map((o) => ({
        film_id: filmId,
        name: o.name,
        type: o.type as ServiceType,
        price: o.price,
        currency: o.currency,
        link: sanitizeUrl(o.link),
        icon: sanitizeUrl(o.icon)
    }))

    // PostgREST gives us no transaction, so the two writes are ordered by
    // which failure we can live with. Inserting first means the bad case is a
    // few seconds of duplicated offers on the page; deleting first means the
    // bad case is a film showing nowhere to watch it.
    if (rows.length > 0) {
        const { error: insertError } = await supabaseAdmin.from('services').insert(rows)
        if (insertError) return { ok: false, error: insertError.message }
    }

    const staleIds = (existing ?? []).map((row) => row.id)
    if (staleIds.length > 0) {
        const { error: deleteError } = await supabaseAdmin.from('services').delete().in('id', staleIds)
        if (deleteError) {
            return { ok: false, error: `new offers saved but the old ones are still there: ${deleteError.message}` }
        }
    }

    return { ok: true }
}
