import { env } from '$env/dynamic/private'

const SCRAPER_BASE_URL = 'https://31for31scraper.vercel.app'

// The scraper is stateless as far as this app is concerned: it is told which
// films to scrape and returns their current offers. The films table is the
// only list of films — nothing here reads or writes the scraper's own copy.

export type ScraperResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

export type ScraperOffer = {
    name: string
    type: string
    price: number | null
    currency: string | null
    link: string | null
    icon: string | null
}

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

export type ScrapeBatchFilm = {
    title: string
    justwatch_url?: string
}

// POST /api/scrape — scrapes a caller-supplied list and returns one
// FilmResult per input film, in request order. This is the batch path: the
// films table decides what gets scraped, so there is no second list to
// drift from. A single film failing comes back as service: [] with an
// error rather than failing the request, so a non-ok result here means the
// whole call failed (400 malformed, 401 bad key, 500 unconfigured).
export async function scrapeMany(films: ScrapeBatchFilm[]): Promise<ScraperResult<FilmResult[]>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/api/scrape`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(films)
    })
    return parseResult<FilmResult[]>(res)
}

// GET /api/scrape?title=&url= — scrapes one film ad hoc, without depending
// on a list at all. Used for the single-film rescrape on /admin/films/[id]
// and /admin/refresh's per-film Apply, where scrapeMany's batch shape would
// just be noise. 404 (no JustWatch page found) and 502 (request to JustWatch itself
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
