import { beforeEach, describe, expect, it, vi } from "vitest";
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
}: {
  filmRows?: Record<string, unknown>[];
  watched?: WatchedFilms | null;
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "films") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(async () => ({ data: filmRows })),
            })),
          })),
        };
      }
      if (table === "progress") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: watched ? { watched } : null,
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

  it("returns watched progress for the logged-in user alongside filmsByYear", async () => {
    const supabase = fakeSupabaseForLoad({
      filmRows: [],
      watched: { "2025": ["Film A"] },
    });
    const safeGetSession = vi.fn(async () => ({ user: { id: "user-1" } }));

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
