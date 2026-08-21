import { describe, expect, it, vi } from "vitest";

vi.mock("$env/static/public", () => ({
  PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
}));

// The cookie-derived user supabase-js hands back from getSession(). On the
// server it arrives wrapped in a proxy that warns when any property is read,
// which is what this whole fix is about — the stand-in throws instead, so a
// test fails loudly rather than merely printing a warning.
const cookieUser = new Proxy(
  { id: "spoofed-from-cookie", email: "attacker@example.com" },
  {
    get(target, prop) {
      if (typeof prop === "string") {
        throw new Error(`read '${prop}' off the unverified cookie user`);
      }
      return Reflect.get(target, prop);
    },
  },
);

const authenticUser = { id: "user-1", email: "me@example.com" };

let getSessionResult: { data: { session: unknown } };
let getUserResult: { data: { user: unknown }; error: unknown };

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getSession: async () => getSessionResult,
      getUser: async () => getUserResult,
    },
  }),
}));

const { handle } = await import("./hooks.server");

async function runHandle() {
  const event = {
    locals: {} as App.Locals,
    cookies: { getAll: () => [], set: () => {} },
    setHeaders: () => {},
  };

  await handle({
    event: event as never,
    resolve: async () => new Response("ok"),
  } as never);

  return event.locals;
}

describe("safeGetSession", () => {
  it("returns nulls when there is no session", async () => {
    getSessionResult = { data: { session: null } };
    getUserResult = { data: { user: null }, error: null };

    const locals = await runHandle();

    expect(await locals.safeGetSession()).toEqual({
      session: null,
      user: null,
    });
  });

  it("returns nulls when the JWT fails validation", async () => {
    getSessionResult = {
      data: { session: { access_token: "t", user: cookieUser } },
    };
    getUserResult = { data: { user: null }, error: { message: "bad jwt" } };

    const locals = await runHandle();

    expect(await locals.safeGetSession()).toEqual({
      session: null,
      user: null,
    });
  });

  it("returns nulls when the token is valid but resolves to no user", async () => {
    getSessionResult = {
      data: { session: { access_token: "t", user: cookieUser } },
    };
    getUserResult = { data: { user: null }, error: null };

    const locals = await runHandle();

    expect(await locals.safeGetSession()).toEqual({
      session: null,
      user: null,
    });
  });

  it("puts the getUser()-authenticated user on the returned session", async () => {
    getSessionResult = {
      data: { session: { access_token: "t", user: cookieUser } },
    };
    getUserResult = { data: { user: authenticUser }, error: null };

    const locals = await runHandle();
    const { session, user } = await locals.safeGetSession();

    // Reading these would throw if the cookie user had survived — which is
    // exactly what SvelteKit does when it serializes layout data.
    expect(session?.user).toEqual(authenticUser);
    expect(session?.user.id).toBe("user-1");
    expect(user).toEqual(authenticUser);
  });

  it("survives being serialized the way SvelteKit serializes layout data", async () => {
    getSessionResult = {
      data: { session: { access_token: "t", user: cookieUser } },
    };
    getUserResult = { data: { user: authenticUser }, error: null };

    const locals = await runHandle();
    const { session } = await locals.safeGetSession();

    expect(() => JSON.stringify(session)).not.toThrow();
    expect(JSON.parse(JSON.stringify(session)).user.id).toBe("user-1");
  });
});
