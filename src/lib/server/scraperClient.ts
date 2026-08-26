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

export type ScraperOffer = {
    name: string
    type: string
    price: number | null
    currency: string | null
    link: string | null
    icon: string | null
}

export type BatchFilmEntry = {
    id: number
    date: string
    title: string
    justwatch_url?: string | null
    service: ScraperOffer[]
    error?: string | null
}

// Year-keyed (e.g. "2025"); non-film keys like "textContent" pass through
// unchanged, so entries aren't always an array — narrow before use.
export type BatchScrapeResponse = Record<string, BatchFilmEntry[] | unknown>

export type FilmResult = {
    title: string
    url?: string
    service: ScraperOffer[]
    error?: string | null
}

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

export type ScrapeBatchFilm = {
    title: string
    justwatch_url?: string
}

// POST /api/scrape — scrapes a caller-supplied list and returns one
// FilmResult per input film, in request order. Stateless: unlike the GET
// batch below it never consults the scraper's own data.json, which is what
// lets our films table be the only list that matters. A single film failing
// comes back as service: [] with an error rather than failing the request,
// so a non-ok result here means the whole call failed (401/400/500).
export async function scrapeMany(films: ScrapeBatchFilm[]): Promise<ScraperResult<FilmResult[]>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/api/scrape`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(films)
    })
    return parseResult<FilmResult[]>(res)
}

// GET /api/scrape — scrapes every film the scraper itself knows about and
// returns current offers for all of them. Never writes anywhere on the
// scraper's end; the caller decides what to apply. A single film failing
// doesn't fail the request — it comes back with service: [] and an error.
export async function scrapeAll(): Promise<ScraperResult<BatchScrapeResponse>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/api/scrape`, { headers: headers() })
    return parseResult<BatchScrapeResponse>(res)
}

// GET /api/scrape?title=&url= — scrapes one film ad hoc, without depending
// on the scraper's own film list. This is the only way to fetch offers for
// a film the admin just added (see the batch-refresh known limitation).
// 404 (no JustWatch page found) and 502 (request to JustWatch itself
// failed) still return a FilmResult body with `error` set — treated as a
// successful client call so the caller can show the per-film error inline,
// the same way batch failures are surfaced. Only a missing/invalid API key
// (401) or unconfigured server (500) is treated as a hard client error.
export async function scrapeOne(title: string, url?: string): Promise<ScraperResult<FilmResult>> {
    const params = new URLSearchParams({ title })
    if (url) params.set('url', url)

    const res = await fetch(`${SCRAPER_BASE_URL}/api/scrape?${params.toString()}`, { headers: headers() })
    const body = await res.json().catch(() => ({}))

    if (res.status === 200 || res.status === 404 || res.status === 502) {
        return { ok: true, data: body as FilmResult }
    }
    return {
        ok: false,
        status: res.status,
        error: (body as { error?: string }).error ?? `Scraper request failed with status ${res.status}`
    }
}
