import { beforeEach, describe, expect, it, vi } from "vitest";
import { isHttpError, isRedirect } from "@sveltejs/kit";
import type { WatchedFilms } from "../../database.types";

let deleteUser: ReturnType<typeof vi.fn>;

type LoadResult = {
  email: string;
  watchedByYear: Record<string, { title: string; date: string | null }[]>;
  years: string[];
  totalWatched: number;
};

type ActionFailure = { status: number; data: { error: string } } | undefined;

// supabaseAdmin throws at import time when SUPABASE_SERVICE_ROLE_KEY is unset,
// so it always has to be mocked before the route module is pulled in. The
// generated `PageServerLoad`/`Actions` types widen to include void, so the
// exports are re-typed here to what these implementations actually return.
async function importRoute() {
  vi.resetModules();
  deleteUser = vi.fn(async () => ({ error: null }));
  vi.doMock("$lib/server/supabaseAdmin", () => ({
    supabaseAdmin: { auth: { admin: { deleteUser } } },
  }));
  const mod = await import("./+page.server");
  return {
    load: mod.load as unknown as (event: unknown) => Promise<LoadResult>,
    deleteAccount: mod.actions.deleteAccount as unknown as (
      event: unknown,
    ) => Promise<ActionFailure>,
  };
}

type FilmRow = { year: number; date: string; title: string };

function fakeEvent({
  user = { id: "user-1", email: "me@example.com" } as {
    id: string;
    email?: string;
  } | null,
  watched = null as WatchedFilms | null,
  filmRows = [] as FilmRow[],
  progressError = null as { message: string } | null,
  filmsError = null as { message: string } | null,
  formFields = {} as Record<string, string>,
} = {}) {
  const signOut = vi.fn(async () => ({ error: null }));

  const supabase = {
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
      if (table === "films") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(async () => ({ data: filmRows, error: filmsError })),
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
    auth: { signOut },
  };

  const formData = new FormData();
  for (const [key, value] of Object.entries(formFields)) {
    formData.set(key, value);
  }

  return {
    event: {
      request: { formData: async () => formData } as unknown as Request,
      locals: { supabase, safeGetSession: vi.fn(async () => ({ user })) },
    },
    signOut,
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe("account page load", () => {
  it("redirects to /login when nobody is logged in", async () => {
    const { load } = await importRoute();
    const { event } = fakeEvent({ user: null });

    try {
      await load(event);
      expect.unreachable("should have redirected");
    } catch (e) {
      expect(isRedirect(e)).toBe(true);
      expect((e as { location: string }).location).toBe("/login");
    }
  });

  it("returns the logged-in user's email", async () => {
    const { load } = await importRoute();
    const { event } = fakeEvent();

    const result = await load(event);

    expect(result.email).toBe("me@example.com");
  });

  it("pairs watched titles with their dates, newest year first", async () => {
    const { load } = await importRoute();
    const { event } = fakeEvent({
      watched: { "2024": ["Hatchet 2"], "2025": ["Film B", "Film A"] },
      filmRows: [
        { year: 2024, date: "10/1/2024", title: "Hatchet 2" },
        { year: 2025, date: "10/1/2025", title: "Film A" },
        { year: 2025, date: "10/2/2025", title: "Film B" },
      ],
    });

    const result = await load(event);

    expect(result.years).toEqual(["2025", "2024"]);
    // Ordered by the films table's sort order, not the order they were ticked.
    expect(result.watchedByYear["2025"]).toEqual([
      { title: "Film A", date: "10/1/2025" },
      { title: "Film B", date: "10/2/2025" },
    ]);
    expect(result.watchedByYear["2024"]).toEqual([
      { title: "Hatchet 2", date: "10/1/2024" },
    ]);
    expect(result.totalWatched).toBe(3);
  });

  it("still lists a watched title that is no longer in the films table", async () => {
    const { load } = await importRoute();
    const { event } = fakeEvent({
      watched: { "2025": ["Film A", "Renamed Since"] },
      filmRows: [{ year: 2025, date: "10/1/2025", title: "Film A" }],
    });

    const result = await load(event);

    expect(result.watchedByYear["2025"]).toEqual([
      { title: "Film A", date: "10/1/2025" },
      { title: "Renamed Since", date: null },
    ]);
  });

  it("reports nothing watched when the user has no progress row", async () => {
    const { load } = await importRoute();
    const { event } = fakeEvent({ watched: null });

    const result = await load(event);

    expect(result.years).toEqual([]);
    expect(result.watchedByYear).toEqual({});
    expect(result.totalWatched).toBe(0);
  });

  // A read that fails must not render as "nothing stored" — on a page whose
  // whole claim is that it lists everything held about the user, a silent
  // empty result is a wrong answer rather than a missing one.
  it("errors rather than reporting an empty account when the progress read fails", async () => {
    const { load } = await importRoute();
    const { event } = fakeEvent({ progressError: { message: "boom" } });

    try {
      await load(event);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(isHttpError(e)).toBe(true);
      expect((e as { status: number }).status).toBe(500);
    }
  });

  it("errors rather than flagging every film as delisted when the films read fails", async () => {
    const { load } = await importRoute();
    const { event } = fakeEvent({
      watched: { "2025": ["Film A"] },
      filmsError: { message: "boom" },
    });

    try {
      await load(event);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(isHttpError(e)).toBe(true);
      expect((e as { status: number }).status).toBe(500);
    }
  });

  it("skips years whose watched list has been emptied", async () => {
    const { load } = await importRoute();
    const { event } = fakeEvent({ watched: { "2025": [] } });

    const result = await load(event);

    expect(result.years).toEqual([]);
  });
});

describe("deleteAccount action", () => {
  it("deletes the session user and returns them to the homepage signed out", async () => {
    const { deleteAccount } = await importRoute();
    const { event, signOut } = fakeEvent();

    try {
      await deleteAccount(event);
      expect.unreachable("should have redirected");
    } catch (e) {
      expect(isRedirect(e)).toBe(true);
      expect((e as { location: string }).location).toBe("/");
    }

    expect(deleteUser).toHaveBeenCalledWith("user-1");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("ignores any email or id supplied in the form and deletes only the caller", async () => {
    const { deleteAccount } = await importRoute();
    const { event } = fakeEvent({
      user: { id: "user-1", email: "me@example.com" },
      formFields: {
        email: "someone-else@example.com",
        id: "victim-2",
        user_id: "victim-2",
      },
    });

    await deleteAccount(event).catch(() => {});

    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("redirects to /login and deletes nothing when nobody is logged in", async () => {
    const { deleteAccount } = await importRoute();
    const { event, signOut } = fakeEvent({
      user: null,
      formFields: { email: "someone-else@example.com" },
    });

    try {
      await deleteAccount(event);
      expect.unreachable("should have redirected");
    } catch (e) {
      expect(isRedirect(e)).toBe(true);
      expect((e as { location: string }).location).toBe("/login");
    }

    expect(deleteUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("keeps the user signed in and surfaces the error when the delete fails", async () => {
    const { deleteAccount } = await importRoute();
    deleteUser.mockResolvedValueOnce({ error: { message: "user not found" } });
    const { event, signOut } = fakeEvent();

    const result = (await deleteAccount(event)) as unknown as {
      status: number;
      data: { error: string };
    };

    expect(result.status).toBe(500);
    expect(result.data).toEqual({ error: "user not found" });
    expect(signOut).not.toHaveBeenCalled();
  });
});
