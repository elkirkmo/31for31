import { describe, expect, it, vi } from "vitest";
import { actions } from "./+page.server";
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
