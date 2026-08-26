import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/svelte/svelte5";
import { tick } from "svelte";

// The page injects Vercel analytics at module scope; there's no beacon
// endpoint in jsdom and it isn't what these tests are about.
vi.mock("@vercel/analytics", () => ({ inject: vi.fn() }));

import HomePage from "./+page.svelte";

// Real per-year counts: 2024 ran to 32 films, 2025 to 31. The progress bar's
// total has to follow the year rather than assuming October's 31 days.
function yearOfFilms(year: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: Number(year) * 100 + i,
    date: `10/${i + 1}/${year}`,
    title: `Film ${year} #${i + 1}`,
    justwatch_url: null,
    service: [],
  }));
}

const filmsByYear = {
  "2024": yearOfFilms("2024", 32),
  "2025": yearOfFilms("2025", 31),
};

// Only filmsByYear/watched/session are read by this component; the rest of
// PageData (supabase, cookies…) is cast away.
//
// Awaits a tick because the stored year is restored in onMount, so the tab
// it selects only reaches the DOM on the following update.
async function renderPage(
  overrides: {
    watched?: Record<string, string[]>;
    session?: unknown;
    filmsByYear?: Record<string, unknown[]>;
    defaultYear?: string | null;
    unreleasedYears?: string[];
  } = {},
) {
  const result = render(HomePage, {
    data: {
      filmsByYear,
      watched: {},
      session: null,
      defaultYear: "2025",
      unreleasedYears: [],
      ...overrides,
    },
  } as never);
  await tick();
  return result;
}

// The selected year is the one whose tab button is underlined.
function selectedTab() {
  return ["2026", "2025", "2024"]
    .map((year) => screen.queryByRole("button", { name: new RegExp(`^${year}`) }))
    .find((button) => button?.classList.contains("underline"))
    ?.textContent?.trim()
    .split(" ")[0];
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("year selection", () => {
  it("defaults to the newest year when nothing is stored", async () => {
    await renderPage();

    expect(selectedTab()).toBe("2025");
    expect(screen.getByText("Film 2025 #1")).toBeInTheDocument();
  });

  it("restores the year the reader last picked", async () => {
    await renderPage();
    await fireEvent.click(screen.getByRole("button", { name: "2024" }));

    expect(selectedTab()).toBe("2024");

    // A refresh is a fresh mount reading the same localStorage.
    cleanup();
    await renderPage();

    expect(selectedTab()).toBe("2024");
    expect(screen.getByText("Film 2024 #1")).toBeInTheDocument();
  });

  it("falls back to the newest year when the stored one is no longer shown", async () => {
    localStorage.setItem("31for31:selectedYear", "2026");

    await renderPage();

    expect(selectedTab()).toBe("2025");
  });
});

describe("progress bar", () => {
  it("is hidden when nobody is logged in", async () => {
    await renderPage();

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("counts the logged-in reader's watched films for the selected year", async () => {
    await renderPage({
      session: { user: { id: "user-1" } },
      watched: { "2025": ["Film 2025 #1"] },
    });

    expect(screen.getByText("1 of 31 watched")).toBeInTheDocument();
  });

  it("ignores watched titles that are not in the year's film list", async () => {
    // A title renamed since it was ticked would otherwise count towards the
    // total and could push the bar past 100%.
    await renderPage({
      session: { user: { id: "user-1" } },
      watched: { "2025": ["Film 2025 #1", "Renamed Since"] },
    });

    expect(screen.getByText("1 of 31 watched")).toBeInTheDocument();
  });

  it("totals against the year's own film count, 31 one year and 32 the next", async () => {
    await renderPage({
      session: { user: { id: "user-1" } },
      watched: {
        "2025": ["Film 2025 #1"],
        "2024": ["Film 2024 #1", "Film 2024 #2"],
      },
    });

    expect(screen.getByText("1 of 31 watched")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "2024" }));

    expect(screen.getByText("2 of 32 watched")).toBeInTheDocument();
  });

  it("is hidden for a logged-in reader who has ticked nothing this year", async () => {
    await renderPage({ session: { user: { id: "user-1" } }, watched: {} });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("stays hidden on a year with no ticks even when another year has some", async () => {
    await renderPage({
      session: { user: { id: "user-1" } },
      watched: { "2025": ["Film 2025 #1"] },
    });

    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "2024" }));

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("reaches 100% on a 32-film year only when all 32 are ticked", async () => {
    const all2024 = filmsByYear["2024"].map((film) => film.title);

    await renderPage({
      session: { user: { id: "user-1" } },
      watched: { "2024": all2024 },
    });
    await fireEvent.click(screen.getByRole("button", { name: "2024" }));

    expect(screen.getByText("32 of 32 watched")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});

describe("hide watched", () => {
  const loggedIn = {
    session: { user: { id: "user-1" } },
    watched: { "2025": ["Film 2025 #1", "Film 2025 #2"] },
  };

  async function openFilterAndHide() {
    await fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    await fireEvent.click(screen.getByLabelText("Hide watched"));
    await tick();
  }

  it("offers no Hide watched control to a logged-out reader", async () => {
    await renderPage();

    await fireEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(screen.queryByLabelText("Hide watched")).not.toBeInTheDocument();
  });

  it("removes the watched films and keeps the rest", async () => {
    await renderPage(loggedIn);
    expect(screen.getByRole("heading", { name: "Film 2025 #1" })).toBeInTheDocument();

    await openFilterAndHide();

    expect(
      screen.queryByRole("heading", { name: "Film 2025 #1" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Film 2025 #2" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Film 2025 #3" }),
    ).toBeInTheDocument();
  });

  // The point of the feature is to clear finished films out of the list
  // while still being told how far through the year you are. Filtering
  // `films` itself rather than the rendered list would walk the bar back to
  // 0 of 31 and then hide it entirely, which reads as losing your progress.
  it("still reports full progress while the watched films are hidden", async () => {
    await renderPage(loggedIn);
    expect(screen.getByText("2 of 31 watched")).toBeInTheDocument();

    await openFilterAndHide();

    expect(screen.getByText("2 of 31 watched")).toBeInTheDocument();
  });

  it("explains the empty list and offers a way back when every film is watched", async () => {
    await renderPage({
      session: { user: { id: "user-1" } },
      watched: {
        "2025": filmsByYear["2025"].map((film) => film.title),
      },
    });

    await openFilterAndHide();

    expect(screen.getByText(/watched every film in 2025/)).toBeInTheDocument();
    expect(screen.getByText("31 of 31 watched")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Show them again" }));

    expect(
      screen.getByRole("heading", { name: "Film 2025 #1" }),
    ).toBeInTheDocument();
  });

  // The service and price filters are rebuilt per year because each year's
  // options differ; "hide what I've watched" is a standing preference and
  // should survive the switch.
  it("stays on when the year changes", async () => {
    await renderPage({
      session: { user: { id: "user-1" } },
      watched: { "2025": ["Film 2025 #1"], "2024": ["Film 2024 #1"] },
    });

    await openFilterAndHide();
    await fireEvent.click(screen.getByRole("button", { name: "2024" }));
    await tick();

    expect(
      screen.queryByRole("heading", { name: "Film 2024 #1" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Film 2024 #2" }),
    ).toBeInTheDocument();
  });
});

describe("unreleased years", () => {
  // What an admin gets: 2026 exists and is clickable, but the page opens on
  // the newest public year rather than a list of placeholders.
  const withUnreleased = {
    filmsByYear: {
      ...filmsByYear,
      "2026": yearOfFilms("2026", 7),
    },
    defaultYear: "2025",
    unreleasedYears: ["2026"],
  };

  it("opens on the newest public year even when a newer one is visible", async () => {
    await renderPage(withUnreleased);

    expect(selectedTab()).toBe("2025");
    expect(screen.getByText("Film 2025 #1")).toBeInTheDocument();
    expect(screen.queryByText("Film 2026 #1")).not.toBeInTheDocument();
  });

  it("still offers the unreleased year as a tab, flagged as such", async () => {
    await renderPage(withUnreleased);

    const tab = screen.getByRole("button", { name: /2026/ });
    expect(tab).toBeInTheDocument();
    expect(tab).toHaveTextContent("unreleased");
  });

  it("shows the unreleased list once its tab is clicked", async () => {
    await renderPage(withUnreleased);

    await fireEvent.click(screen.getByRole("button", { name: /2026/ }));

    expect(screen.getByText("Film 2026 #1")).toBeInTheDocument();
  });

  it("marks nothing as unreleased for the public", async () => {
    await renderPage();

    expect(screen.queryByText(/unreleased/)).not.toBeInTheDocument();
  });
});
