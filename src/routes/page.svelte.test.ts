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

const filmsByYear = {
  "2024": [
    { id: 1, date: "10/1/2024", title: "Film 2024", justwatch_url: null, service: [] },
  ],
  "2025": [
    { id: 2, date: "10/1/2025", title: "Film 2025", justwatch_url: null, service: [] },
  ],
};

// Only filmsByYear/watched/session are read by this component; the rest of
// PageData (supabase, cookies…) is cast away.
//
// Awaits a tick because the stored year is restored in onMount, so the tab
// it selects only reaches the DOM on the following update.
async function renderPage() {
  const result = render(HomePage, {
    data: { filmsByYear, watched: {}, session: null },
  } as never);
  await tick();
  return result;
}

// The selected year is the one whose tab button is underlined.
function selectedTab() {
  return ["2025", "2024"].find((year) =>
    screen.getByRole("button", { name: year }).classList.contains("underline"),
  );
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
    expect(screen.getByText("Film 2025")).toBeInTheDocument();
  });

  it("restores the year the reader last picked", async () => {
    await renderPage();
    await fireEvent.click(screen.getByRole("button", { name: "2024" }));

    expect(selectedTab()).toBe("2024");

    // A refresh is a fresh mount reading the same localStorage.
    cleanup();
    await renderPage();

    expect(selectedTab()).toBe("2024");
    expect(screen.getByText("Film 2024")).toBeInTheDocument();
  });

  it("falls back to the newest year when the stored one is no longer shown", async () => {
    localStorage.setItem("31for31:selectedYear", "2026");

    await renderPage();

    expect(selectedTab()).toBe("2025");
  });
});
