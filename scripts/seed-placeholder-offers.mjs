// Local-only: gives offer-less films a few streaming offers so the listing,
// the filter and the four button types are all exercisable in dev.
//
// The scraper only fills in offers once a year's real titles are published,
// so next year's placeholder films arrive with `service: []`. In dev the
// release gate is bypassed and the homepage opens on the newest year, which
// means dev lands on a list with nothing to click.
//
// Usage: node --env-file=.env.local scripts/seed-placeholder-offers.mjs
// (or: npm run db:placeholders)
//
// Idempotent — films that already have offers are left alone, so re-running
// never duplicates and never touches real scraped data.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
    console.error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).')
    process.exit(1)
}

// Hard stop against anything that isn't the local stack. This writes invented
// offers; running it at production would put fake streaming links on the site.
if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(supabaseUrl)) {
    console.error(`Refusing to run: ${supabaseUrl} is not the local Supabase stack.`)
    console.error('This inserts placeholder offers and must never touch real data.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

const { data: films, error: filmsError } = await supabase
    .from('films')
    .select('id, year, title, services(id)')
    .order('year')
    .order('sort_order')

if (filmsError) {
    console.error('Could not read films:', filmsError.message)
    process.exit(1)
}

// Scoped to years with no offers at all, not to every offer-less film. A
// scraped year can legitimately contain a film nothing streams (Thanksgiving
// in 2025) — that's real data and a useful empty-state fixture, so leave it
// alone. An entirely empty year is the unscraped one.
const offersByYear = new Map()
for (const film of films) {
    offersByYear.set(film.year, (offersByYear.get(film.year) ?? 0) + film.services.length)
}
const unscrapedYears = [...offersByYear.entries()]
    .filter(([, offers]) => offers === 0)
    .map(([year]) => year)

const needOffers = films.filter((film) => unscrapedYears.includes(film.year))

if (needOffers.length === 0) {
    console.log('• Every year already has offers — nothing to do.')
    process.exit(0)
}

// Templates are sampled from real rows rather than hardcoded, so placeholder
// offers carry genuine service names and icon URLs and render exactly like
// the real thing. Cinema listings are skipped: the listing filters them out.
const { data: realOffers, error: offersError } = await supabase
    .from('services')
    .select('name, type, price, currency, icon')
    .neq('type', 'cinema')

if (offersError) {
    console.error('Could not read existing services:', offersError.message)
    process.exit(1)
}

const templatesByType = new Map()
for (const offer of realOffers) {
    if (!templatesByType.has(offer.type)) templatesByType.set(offer.type, new Map())
    // One template per service name, so a type doesn't end up with fifty
    // near-identical Amazon rows to choose from.
    templatesByType.get(offer.type).set(offer.name, offer)
}

// One of each type per film, so the filter has something to filter and every
// button variant (free / subscription / rent / buy) shows up.
const TYPES = ['free', 'subscription', 'rent', 'buy']

const rows = []
for (const [index, film] of needOffers.entries()) {
    for (const type of TYPES) {
        const templates = [...(templatesByType.get(type)?.values() ?? [])]
        if (templates.length === 0) continue

        // Rotating by film index keeps the lists from being identical without
        // needing randomness, so a re-seed produces the same fixtures.
        const template = templates[index % templates.length]
        rows.push({
            film_id: film.id,
            name: template.name,
            type: template.type,
            price: template.price,
            currency: template.currency,
            icon: template.icon,
            link: 'https://example.com/placeholder'
        })
    }
}

const { error: insertError } = await supabase.from('services').insert(rows)

if (insertError) {
    console.error('Could not insert placeholder offers:', insertError.message)
    process.exit(1)
}

console.log(`• Added ${rows.length} placeholder offers across ${needOffers.length} films in ${unscrapedYears.join(', ')}:`)
for (const film of needOffers) console.log(`    ${film.year}  ${film.title}`)
