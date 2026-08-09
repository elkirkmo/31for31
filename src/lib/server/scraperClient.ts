import { env } from '$env/dynamic/private'

const SCRAPER_BASE_URL = 'https://31for31scraper.vercel.app'

export type FilmInput = {
    title: string
    date?: string
    justwatch_url?: string
}

export type ScraperFilmEntry = {
    id: number
    date: string
    title: string
    justwatch_url?: string | null
    service: unknown[]
    error?: string | null
}

export type ScraperResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

function headers() {
    return {
        'Content-Type': 'application/json',
        'X-API-Key': env.SCRAPER_API_KEY ?? ''
    }
}

async function parseResult<T>(res: Response): Promise<ScraperResult<T>> {
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
        return { ok: false, status: res.status, error: (body as { error?: string }).error ?? `Scraper request failed with status ${res.status}` }
    }
    return { ok: true, data: body as T }
}

// POST /api/years/{year} — appends one film to the scraper's own list for
// that year. Does not touch our films table (see plan: Phase 2 write-path
// decision — this only persists once the scraper migrates to Supabase).
export async function addFilm(year: string, film: FilmInput): Promise<ScraperResult<ScraperFilmEntry>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/api/years/${year}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(film)
    })
    return parseResult<ScraperFilmEntry>(res)
}

// PUT /api/years/{year} — replaces the scraper's own list for that year
// wholesale. Used for edit/delete, since the scraper has no per-film
// update/delete endpoint — callers must supply the full desired list.
export async function replaceYear(year: string, films: FilmInput[]): Promise<ScraperResult<ScraperFilmEntry[]>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/api/years/${year}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(films)
    })
    return parseResult<ScraperFilmEntry[]>(res)
}
