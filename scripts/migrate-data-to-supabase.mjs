// One-off migration: imports src/data.json's film/service data into the
// Supabase films/services tables. Not part of the deployed app — run
// manually, once, after applying supabase/migrations/0001_admin_and_films.sql.
//
// Usage: node --env-file=.env.local scripts/migrate-data-to-supabase.mjs
// (or: npm run migrate:data)
//
// Idempotent (upserts on (year, title)) — safe to re-run.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
    console.error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

const dataPath = path.join(__dirname, '..', 'src', 'data.json')
const data = JSON.parse(readFileSync(dataPath, 'utf-8'))

let filmCount = 0
let serviceCount = 0

for (const [year, films] of Object.entries(data)) {
    if (year === 'textContent') continue

    for (const [index, film] of films.entries()) {
        const { data: filmRow, error: filmError } = await supabase
            .from('films')
            .upsert(
                {
                    year: Number(year),
                    sort_order: index,
                    date: film.date,
                    title: film.title,
                    justwatch_url: film.justwatch_url ?? null
                },
                { onConflict: 'year,title' }
            )
            .select('id')
            .single()

        if (filmError) {
            console.error(`Failed to upsert film "${film.title}" (${year}):`, filmError.message)
            continue
        }

        filmCount++
        const filmId = filmRow.id

        const { error: deleteError } = await supabase.from('services').delete().eq('film_id', filmId)
        if (deleteError) {
            console.error(`Failed to clear services for "${film.title}" (${year}):`, deleteError.message)
            continue
        }

        const services = (film.service ?? []).map((s) => ({
            film_id: filmId,
            name: s.name,
            type: s.type,
            price: s.price ?? null,
            currency: s.currency ?? null,
            link: s.link ?? null,
            icon: s.icon ?? null
        }))

        if (services.length > 0) {
            const { error: insertError } = await supabase.from('services').insert(services)
            if (insertError) {
                console.error(`Failed to insert services for "${film.title}" (${year}):`, insertError.message)
                continue
            }
            serviceCount += services.length
        }
    }
}

console.log(`Migrated ${filmCount} films and ${serviceCount} services.`)
