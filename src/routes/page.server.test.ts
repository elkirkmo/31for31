import { beforeEach, describe, expect, it, vi } from "vitest";

const listFilms = vi.fn();
const getLiked = vi.fn();
const setLiked = vi.fn();
vi.mock("$lib/server/scraperClient", () => ({
  listFilms: (...args: unknown[]) => listFilms(...args),
  getLiked: (...args: unknown[]) => getLiked(...args),
  setLiked: (...args: unknown[]) => setLiked(...args),
}));

const SESSION = { access_token: "user-token" };

beforeEach(() => {
  getLiked.mockReset().mockResolvedValue({ ok: true, data: {} });
  setLiked.mockReset().mockResolvedValue({ ok: true, data: { film: {}, liked: {} } });
});

import { actions, load } from "./+page.server";
import type { WatchedFilms } from "../database.types";

function formDataRequest(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return { formData: async () => formData } as unknown as Request;
}

function fakeEvent({
  loggedIn = true,
  existingWatched = null as WatchedFilms | null,
  upsertError = null as { message: string } | null,
  formFields = {},
}: {
  loggedIn?: boolean;
  existingWatched?: WatchedFilms | null;
  upsertError?: { message: string } | null;
  formFields?: Record<string, string>;
} = {}) {
  const upsert = vi.fn(async () => ({ error: upsertError }));

  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: existingWatched ? { watched: existingWatched } : null,
          })),
        })),
      })),
      upsert,
    })),
  };

  const safeGetSession = vi.fn(async () => ({
    session: loggedIn ? SESSION : null,
    user: loggedIn ? { id: "user-1" } : null,
  }));

  const request = formDataRequest({
    title: "The Thing From Another World",
    year: "2025",
    ...formFields,
  });

  return {
    event: {
      request,
      locals: { supabase, safeGetSession },
    } as unknown as Parameters<typeof actions.toggleWatched>[0],
    upsert,
  };
}

describe("toggleWatched action", () => {
  it("returns an error and skips the database when no user is logged in", async () => {
    const { event, upsert } = fakeEvent({ loggedIn: false });

    const result = await actions.toggleWatched(event);

    expect(result).toEqual({ error: "Not logged in" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("adds the title to that year when there is no existing progress row", async () => {
    const { event, upsert } = fakeEvent({ existingWatched: null });

    await actions.toggleWatched(event);

    expect(upsert).toHaveBeenCalledWith({
      user_id: "user-1",
      watched: { "2025": ["The Thing From Another World"] },
    });
  });

  it("appends to an existing year's list without dropping other titles", async () => {
    const { event, upsert } = fakeEvent({
      existingWatched: { "2025": ["Blood Feast"] },
    });

    await actions.toggleWatched(event);

    expect(upsert).toHaveBeenCalledWith({
      user_id: "user-1",
      watched: { "2025": ["Blood Feast", "The Thing From Another World"] },
    });
  });

  it("removes the title when it is already marked watched (toggling off)", async () => {
    const { event, upsert } = fakeEvent({
      existingWatched: { "2025": ["The Thing From Another World", "Blood Feast"] },
    });

    await actions.toggleWatched(event);

    expect(upsert).toHaveBeenCalledWith({
      user_id: "user-1",
      watched: { "2025": ["Blood Feast"] },
    });
  });

  it("leaves other years untouched when updating one year", async () => {
    const { event, upsert } = fakeEvent({
      existingWatched: { "2024": ["Hatchet 2"] },
    });

    await actions.toggleWatched(event);

    expect(upsert).toHaveBeenCalledWith({
      user_id: "user-1",
      watched: {
        "2024": ["Hatchet 2"],
        "2025": ["The Thing From Another World"],
      },
    });
  });

  it("returns the upsert error message instead of throwing when the write fails", async () => {
    const { event } = fakeEvent({
      upsertError: { message: "connection refused" },
    });

    const result = await actions.toggleWatched(event);

    expect(result).toEqual({ error: "connection refused" });
  });
});

function fakeSupabaseForLoad({
  filmRows = [] as Record<string, unknown>[],
  watched = null as WatchedFilms | null,
  filmsError = null as { message: string } | null,
  progressError = null as { message: string } | null,
}: {
  filmRows?: Record<string, unknown>[];
  watched?: WatchedFilms | null;
  filmsError?: { message: string } | null;
  progressError?: { message: string } | null;
} = {}) {
  // The catalogue comes from the scraper over HTTP now, so `filmRows` and
  // `filmsError` configure that client rather than a Supabase table. Only
  // `progress` -- the user's own rows, read as the user under RLS -- is still
  // answered by this fake.
  listFilms.mockResolvedValue(
    filmsError
      ? { ok: false as const, status: 502, error: filmsError.message }
      : { ok: true as const, data: filmRows },
  );

  return {
    from: vi.fn((table: string) => {
      if (table === "progress") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: watched ? { watched } : null,
                error: progressError,
              })),
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("root page load", () => {
  it("groups films by year and renames the joined services key to service", async () => {
    const supabase = fakeSupabaseForLoad({
      filmRows: [
        {
          id: 1,
          year: 2025,
          date: "10/1/2025",
          title: "Film A",
          justwatch_url: null,
          services: [
            {
              name: "Netflix",
              type: "subscription",
              price: null,
              currency: "USD",
              link: "https://netflix.com/1",
              icon: "https://images.justwatch.com/netflix.webp",
            },
          ],
        },
        {
          id: 2,
          year: 2024,
          date: "10/2/2024",
          title: "Film B",
          justwatch_url: "https://justwatch.com/film-b",
          services: [],
        },
      ],
    });
    const safeGetSession = vi.fn(async () => ({ user: null }));

    const result = await load({
      locals: { supabase, safeGetSession },
      parent: async () => ({ isAdmin: false }),
    } as unknown as Parameters<typeof load>[0]);

    expect(result.filmsByYear).toEqual({
      "2025": [
        {
          id: 1,
          date: "10/1/2025",
          title: "Film A",
          justwatch_url: null,
          service: [
            {
              name: "Netflix",
              type: "subscription",
              price: null,
              currency: "USD",
              link: "https://netflix.com/1",
              icon: "https://images.justwatch.com/netflix.webp",
            },
          ],
        },
      ],
      "2024": [
        {
          id: 2,
          date: "10/2/2024",
          title: "Film B",
          justwatch_url: "https://justwatch.com/film-b",
          service: [],
        },
      ],
    });
    expect(result.watched).toEqual({});
  });

  it("fails loudly instead of rendering an empty list when the films read breaks", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = fakeSupabaseForLoad({
      filmsError: { message: "permission denied for table films" },
    });
    const safeGetSession = vi.fn(async () => ({ user: null }));

    await expect(
      load({
        locals: { supabase, safeGetSession },
        parent: async () => ({ isAdmin: false }),
      } as unknown as Parameters<typeof load>[0]),
    ).rejects.toMatchObject({ status: 500 });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("still serves the films when only the progress read breaks", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = fakeSupabaseForLoad({
      filmRows: [
        {
          id: 1,
          year: 2025,
          date: "10/1/2025",
          title: "Film A",
          justwatch_url: null,
          services: [],
        },
      ],
      progressError: { message: "connection reset" },
    });
    const safeGetSession = vi.fn(async () => ({ session: SESSION, user: { id: "user-1" } }));

    const result = await load({
      locals: { supabase, safeGetSession },
      parent: async () => ({ isAdmin: false }),
    } as unknown as Parameters<typeof load>[0]);

    expect(Object.keys(result.filmsByYear)).toEqual(["2025"]);
    expect(result.watched).toEqual({});
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns watched progress for the logged-in user alongside filmsByYear", async () => {
    const supabase = fakeSupabaseForLoad({
      filmRows: [],
      watched: { "2025": ["Film A"] },
    });
    const safeGetSession = vi.fn(async () => ({ session: SESSION, user: { id: "user-1" } }));

    const result = await load({
      locals: { supabase, safeGetSession },
      parent: async () => ({ isAdmin: false }),
    } as unknown as Parameters<typeof load>[0]);

    expect(result.watched).toEqual({ "2025": ["Film A"] });
    expect(result.filmsByYear).toEqual({});
  });

  // These exercise the release-date gate, so they pin `dev` explicitly
  // rather than inheriting whatever vitest's environment reports.
  describe("unreleased years", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    const unreleasedFilmRows = [
      {
        id: 1,
        year: 2025,
        date: "10/1/2025",
        title: "Film A",
        justwatch_url: null,
        services: [],
      },
      {
        id: 2,
        year: 9999,
        date: "",
        title: "Placeholder Film 1",
        justwatch_url: null,
        services: [],
      },
    ];

    async function loadWith({
      isAdmin,
      devMode,
    }: {
      isAdmin: boolean;
      devMode: boolean;
    }) {
      vi.doMock("$app/environment", () => ({ dev: devMode }));
      const { load: freshLoad } = await import("./+page.server");

      return freshLoad({
        locals: {
          supabase: fakeSupabaseForLoad({ filmRows: unreleasedFilmRows }),
          safeGetSession: vi.fn(async () => ({ user: null })),
        },
        parent: async () => ({ isAdmin }),
      } as unknown as Parameters<typeof load>[0]);
    }

    it("hides a year that has not reached its October 1 from non-admins", async () => {
      const result = await loadWith({ isAdmin: false, devMode: false });

      expect(Object.keys(result.filmsByYear)).toEqual(["2025"]);
    });

    it("keeps the unreleased year for an admin", async () => {
      const result = await loadWith({ isAdmin: true, devMode: false });

      expect(Object.keys(result.filmsByYear)).toEqual(["2025", "9999"]);
    });

    it("still lands an admin on the newest public year, not the unreleased one", async () => {
      const result = await loadWith({ isAdmin: true, devMode: false });

      expect(result.defaultYear).toBe("2025");
      expect(result.unreleasedYears).toEqual(["9999"]);
    });

    it("lands on the newest public year in dev too", async () => {
      const result = await loadWith({ isAdmin: false, devMode: true });

      expect(result.defaultYear).toBe("2025");
      expect(result.unreleasedYears).toEqual(["9999"]);
    });

    it("flags nothing as unreleased for the public", async () => {
      const result = await loadWith({ isAdmin: false, devMode: false });

      expect(result.defaultYear).toBe("2025");
      expect(result.unreleasedYears).toEqual([]);
    });

    it("keeps the unreleased year in dev without an admin profile", async () => {
      const result = await loadWith({ isAdmin: false, devMode: true });

      expect(Object.keys(result.filmsByYear)).toEqual(["2025", "9999"]);
    });
  });
});

describe("likes", () => {
  const loadAs = (session: unknown, supabase: unknown) =>
    load({
      locals: {
        supabase,
        safeGetSession: vi.fn(async () => ({
          session,
          user: session ? { id: "user-1" } : null,
        })),
      },
      parent: async () => ({ isAdmin: false }),
    } as unknown as Parameters<typeof load>[0]);

  beforeEach(() => {
    listFilms.mockResolvedValue({ ok: true, data: [] });
  });

  it("loads the user's likes from the scraper with their access token", async () => {
    getLiked.mockResolvedValue({ ok: true, data: { "2024": ["Hatchet"] } });

    const result = await loadAs(SESSION, fakeSupabaseForLoad({ filmRows: [], watched: {} }));

    expect(getLiked).toHaveBeenCalledWith("user-token");
    expect(result.liked).toEqual({ "2024": ["Hatchet"] });
  });

  it("doesn't ask the scraper for likes when nobody is logged in", async () => {
    const result = await loadAs(null, fakeSupabaseForLoad({ filmRows: [], watched: {} }));

    expect(getLiked).not.toHaveBeenCalled();
    expect(result.liked).toEqual({});
  });

  // Same rule as the progress row: losing the hearts is worth a log line,
  // not the whole page.
  it("renders with no likes rather than failing when the likes read breaks", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getLiked.mockResolvedValue({ ok: false, status: 502, error: "upstream" });

    const result = await loadAs(SESSION, fakeSupabaseForLoad({ filmRows: [], watched: { "2025": ["Film A"] } }));

    expect(result.liked).toEqual({});
    expect(result.watched).toEqual({ "2025": ["Film A"] });
    expect(consoleError).toHaveBeenCalledWith("liked request failed:", 502, "upstream");
    consoleError.mockRestore();
  });
});

describe("setLiked action", () => {
  it("refuses without a session and never calls the scraper", async () => {
    const { event } = fakeEvent({ loggedIn: false, formFields: { liked: "true" } });

    expect(await actions.setLiked(event)).toEqual({ error: "Not logged in" });
    expect(setLiked).not.toHaveBeenCalled();
  });

  it("likes with liked=true, as the user", async () => {
    const { event } = fakeEvent({ formFields: { liked: "true" } });

    expect(await actions.setLiked(event)).toEqual({});
    expect(setLiked).toHaveBeenCalledWith(
      "user-token",
      { year: 2025, title: "The Thing From Another World" },
      true,
    );
  });

  it("unlikes with liked=false", async () => {
    const { event } = fakeEvent({ formFields: { liked: "false" } });

    await actions.setLiked(event);

    expect(setLiked).toHaveBeenCalledWith("user-token", expect.anything(), false);
  });

  it("tells the reader to log in again when their token has expired", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setLiked.mockResolvedValue({ ok: false, status: 401, error: "invalid or expired access token" });
    const { event } = fakeEvent({ formFields: { liked: "true" } });

    expect(await actions.setLiked(event)).toEqual({
      error: "Your session has expired. Please log in again.",
    });
  });

  it("surfaces any other scraper error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setLiked.mockResolvedValue({ ok: false, status: 404, error: "no film titled 'X'" });
    const { event } = fakeEvent({ formFields: { liked: "true" } });

    expect(await actions.setLiked(event)).toEqual({ error: "no film titled 'X'" });
  });
});
