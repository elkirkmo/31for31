import { env } from '$env/dynamic/private'

const SCRAPER_BASE_URL = 'https://31for31scraper.vercel.app'

// The scraper owns the film catalogue. This app holds no film data and makes
// no decisions about it: every read and write of films/services goes over
// HTTP from here, authenticated with X-API-Key. Supabase auth and the
// per-user `progress` rows stay in this app -- those are the user's data,
// authorised by RLS as the user, and proxying them would mean teaching the
// scraper to verify user JWTs.
//
// The API key is read from $env/dynamic/private and must only ever be used
// from server-side load functions and actions. It must never reach a
// +page.ts or a component.

export type ScraperResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

export type ScraperOffer = {
    name: string
    type: string
    price: number | null
    currency: string | null
    link: string | null
    icon: string | null
}

// A stored offer as the API returns it: the scraped fields plus its row
// identity. Structurally a ScraperOffer, so it diffs against a fresh scrape
// without conversion.
export type ScraperService = ScraperOffer & {
    id: number
    film_id: number
}

export type ScraperFilm = {
    id: number
    year: number
    sort_order: number
    date: string
    title: string
    justwatch_url: string | null
    created_at?: string
    updated_at?: string
    services: ScraperService[]
}

export type FilmResult = {
    title: string
    url?: string
    service: ScraperOffer[]
    error?: string | null
}

// One film's outcome from a refresh. `refreshed: false` means that film's
// scrape failed and its stored offers were deliberately left alone.
export type RefreshResult = {
    film_id: number
    title: string
    refreshed: boolean
    url?: string
    services_updated?: number
    error?: string
    note?: string
}

export type RefreshBatchResult = {
    films: number
    refreshed: number
    results: RefreshResult[]
}

export type FilmCreate = {
    year: number
    date: string
    title: string
    justwatch_url?: string | null
    sort_order?: number
}

// Any subset of the writable fields. `justwatch_url: null` clears the
// override rather than leaving it untouched.
export type FilmPatch = Partial<FilmCreate>

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

// --- catalogue ------------------------------------------------------------

// GET /films — the whole catalogue, each film with its stored offers,
// ordered by year then sort_order. Callers group and filter it; the ordering
// is the API's, not ours.
export async function listFilms(year?: number): Promise<ScraperResult<ScraperFilm[]>> {
    const query = year === undefined ? '' : `?year=${encodeURIComponent(year)}`
    const res = await fetch(`${SCRAPER_BASE_URL}/films${query}`, { headers: headers() })
    return parseResult<ScraperFilm[]>(res)
}

export async function getFilm(id: number): Promise<ScraperResult<ScraperFilm>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/films/${id}`, { headers: headers() })
    return parseResult<ScraperFilm>(res)
}

// POST /films — omit sort_order and the scraper appends to the end of that
// year, which is why this app no longer reads the current maximum first.
export async function createFilm(film: FilmCreate): Promise<ScraperResult<ScraperFilm>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/films`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(film)
    })
    return parseResult<ScraperFilm>(res)
}

export async function updateFilm(id: number, patch: FilmPatch): Promise<ScraperResult<ScraperFilm>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/films/${id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(patch)
    })
    return parseResult<ScraperFilm>(res)
}

// DELETE /films/{id} — 204 with no body on success, so there is nothing to
// parse; the film's offers cascade server-side.
export async function deleteFilm(id: number): Promise<ScraperResult<null>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/films/${id}`, { method: 'DELETE', headers: headers() })
    if (res.status === 204) return { ok: true, data: null }
    return parseResult<null>(res)
}

// --- refresh (scrape + store, server-side) --------------------------------

// POST /films/{id}/refresh — scrapes this film and replaces its offers. A
// 502 means the scrape failed and the stored offers were left untouched,
// which is a materially different outcome from "refreshed to nothing" and is
// worth surfacing verbatim.
export async function refreshFilm(id: number): Promise<ScraperResult<RefreshResult>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/films/${id}/refresh`, { method: 'POST', headers: headers() })
    return parseResult<RefreshResult>(res)
}

// POST /films/refresh — the whole catalogue in one pass. The scraper owns
// the "every readable film came back empty = broken scrape, refuse the run"
// guard and answers 502 when it fires; this app renders that error rather
// than reimplementing the rule.
export async function refreshAllFilms(): Promise<ScraperResult<RefreshBatchResult>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/films/refresh`, { method: 'POST', headers: headers() })
    return parseResult<RefreshBatchResult>(res)
}

// --- ad-hoc scrapes (dry runs; write nothing) -----------------------------

export type ScrapeBatchFilm = {
    title: string
    justwatch_url?: string
}

// POST /api/scrape — scrapes a caller-supplied list and returns one
// FilmResult per input film, in request order. Still the dry-run path: it
// reads JustWatch and returns what it found without touching the catalogue.
// A single film failing comes back as service: [] with an error rather than
// failing the request, so a non-ok result here means the whole call failed
// (400 malformed, 401 bad key, 500 unconfigured).
export async function scrapeMany(films: ScrapeBatchFilm[]): Promise<ScraperResult<FilmResult[]>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/api/scrape`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(films)
    })
    return parseResult<FilmResult[]>(res)
}

// GET /api/scrape?title=&url= — one film, ad hoc. 404 (no JustWatch page
// found) and 502 (the request to JustWatch itself failed) still return a
// FilmResult body with `error` set -- treated as a successful client call so
// the caller can show the per-film error inline. Only a missing/invalid API
// key (401) or unconfigured server (500) is a hard client error.
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

// --- the signed-in user's own data ----------------------------------------
//
// These authenticate as the *user*, with their Supabase access token, not
// with SCRAPER_API_KEY: the scraper forwards the token to Supabase and RLS
// confines the request to that user's row. So no X-API-Key here -- the token
// is the whole credential, exactly as it is for someone using curl.

export type LikedFilms = Record<string, string[]>

export type LikeResult = {
    film: { year: number; title: string }
    liked: LikedFilms
}

function userHeaders(accessToken: string) {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
    }
}

// GET /me/liked
export async function getLiked(accessToken: string): Promise<ScraperResult<LikedFilms>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/me/liked`, { headers: userHeaders(accessToken) })
    const result = await parseResult<{ liked: LikedFilms }>(res)
    return result.ok ? { ok: true, data: result.data.liked } : result
}

// PUT (like) or DELETE (unlike) /me/liked. Idempotent on the scraper's side,
// so callers send the state they want rather than a toggle -- a double
// click or a retry can't flip it back.
export async function setLiked(
    accessToken: string,
    film: { year: number; title: string },
    liked: boolean
): Promise<ScraperResult<LikeResult>> {
    const res = await fetch(`${SCRAPER_BASE_URL}/me/liked`, {
        method: liked ? 'PUT' : 'DELETE',
        headers: userHeaders(accessToken),
        body: JSON.stringify(film)
    })
    return parseResult<LikeResult>(res)
}
