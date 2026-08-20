import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/svelte/svelte5";
import AccountPage from "./+page.svelte";

type AccountData = {
  email: string;
  watchedByYear: Record<string, { title: string; date: string | null }[]>;
  years: string[];
  totalWatched: number;
};

const baseData: AccountData = {
  email: "me@example.com",
  watchedByYear: {},
  years: [],
  totalWatched: 0,
};

// The page's `data` prop is typed as the full PageData, layout load included
// (supabase, session, cookies…). None of it is touched by this component, so
// the cast keeps the fixtures to just what the page actually reads.
function renderPage(overrides: Partial<AccountData> = {}) {
  return render(AccountPage, {
    data: { ...baseData, ...overrides },
    form: null,
  } as never);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // use:enhance submits via fetch, so whether fetch was called is the test
  // for "the delete request went out". The promise deliberately never
  // settles: resolving it would run SvelteKit's post-action handling
  // (invalidateAll/goto), which needs a real client router. What happens
  // after the request is the server action's job, covered in
  // page.server.test.ts.
  fetchMock = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

function openConfirmPanel() {
  return fireEvent.click(
    screen.getByRole("button", { name: /Delete my account/ }),
  );
}

describe("account deletion safeguards", () => {
  it("does not show the destructive button until the first one is clicked", async () => {
    renderPage();

    expect(
      screen.queryByRole("button", { name: "Yes, delete everything" }),
    ).not.toBeInTheDocument();

    await openConfirmPanel();

    expect(
      screen.getByRole("button", { name: "Yes, delete everything" }),
    ).toBeInTheDocument();
  });

  it("asks for confirmation before submitting", async () => {
    const confirmSpy = vi.fn((_message?: string) => true);
    vi.stubGlobal("confirm", confirmSpy);
    renderPage();

    await openConfirmPanel();
    await fireEvent.click(
      screen.getByRole("button", { name: "Yes, delete everything" }),
    );

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/cannot be undone/i);
  });

  it("sends nothing when the confirmation is dismissed", async () => {
    vi.stubGlobal("confirm", vi.fn((_message?: string) => false));
    renderPage();

    await openConfirmPanel();
    await fireEvent.click(
      screen.getByRole("button", { name: "Yes, delete everything" }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits the delete once the confirmation is accepted", async () => {
    vi.stubGlobal("confirm", vi.fn((_message?: string) => true));
    renderPage();

    await openConfirmPanel();
    await fireEvent.click(
      screen.getByRole("button", { name: "Yes, delete everything" }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("backing out with Cancel hides the destructive button and sends nothing", async () => {
    const confirmSpy = vi.fn((_message?: string) => true);
    vi.stubGlobal("confirm", confirmSpy);
    renderPage();

    await openConfirmPanel();
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("button", { name: "Yes, delete everything" }),
    ).not.toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("account data listing", () => {
  it("shows the user's email", () => {
    renderPage();

    expect(screen.getByText("me@example.com")).toBeInTheDocument();
  });

  it("lists watched films by year, flagging ones no longer on the list", () => {
    renderPage({
      years: ["2025"],
      watchedByYear: {
        "2025": [
          { title: "Film A", date: "10/1/2025" },
          { title: "Renamed Since", date: null },
        ],
      },
      totalWatched: 2,
    });

    expect(screen.getByText("2025")).toBeInTheDocument();
    expect(screen.getByText(/Film A/)).toBeInTheDocument();
    expect(screen.getByText(/Renamed Since/)).toBeInTheDocument();
    expect(screen.getByText("no longer on the list")).toBeInTheDocument();
  });

  it("labels a dateless film as a bonus pick, not as missing", () => {
    renderPage({
      years: ["2024"],
      watchedByYear: {
        "2024": [{ title: "Terrifier 3", date: "" }],
      },
      totalWatched: 1,
    });

    expect(screen.getByText(/Bonus/)).toBeInTheDocument();
    expect(screen.getByText(/Terrifier 3/)).toBeInTheDocument();
    expect(screen.queryByText("no longer on the list")).not.toBeInTheDocument();
  });

  it("says so when nothing has been watched yet", () => {
    renderPage();

    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
  });
});
