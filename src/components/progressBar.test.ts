import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte/svelte5";
import ProgressBar from "./progressBar.svelte";

afterEach(() => cleanup());

describe("progress bar", () => {
  it("shows the count and percentage watched", () => {
    render(ProgressBar, { watched: 5, total: 20, year: "2025" });

    expect(screen.getByText("5 of 20 watched")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("exposes the progress to assistive tech", () => {
    render(ProgressBar, { watched: 5, total: 20, year: "2025" });

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "5");
    expect(bar).toHaveAttribute("aria-valuemax", "20");
    expect(bar).toHaveAttribute("aria-valuetext", "5 of 20 films watched");
    expect(bar).toHaveAccessibleName("Films watched in 2025");
  });

  it("fills the bar in proportion to the count", () => {
    render(ProgressBar, { watched: 1, total: 4, year: "2025" });

    const fill = screen.getByRole("progressbar").firstElementChild;
    expect(fill).toHaveStyle({ width: "25%" });
  });

  it("rounds the percentage rather than showing a fraction", () => {
    // 32-film years don't divide evenly, so the label has to round.
    render(ProgressBar, { watched: 1, total: 32, year: "2024" });

    expect(screen.getByText("3%")).toBeInTheDocument();
  });

  it("reads 100% when every film is watched", () => {
    render(ProgressBar, { watched: 31, total: 31, year: "2025" });

    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({
      width: "100%",
    });
  });

  it("renders nothing for a year with no films", () => {
    render(ProgressBar, { watched: 0, total: 0 });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
