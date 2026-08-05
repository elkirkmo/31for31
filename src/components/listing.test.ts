import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import Listing from "./listing.svelte";

const baseProps = {
  date: "10/1/2025",
  title: "The Thing From Another World",
};

let originalRequestSubmit: typeof HTMLFormElement.prototype.requestSubmit;

beforeEach(() => {
  originalRequestSubmit = HTMLFormElement.prototype.requestSubmit;
  HTMLFormElement.prototype.requestSubmit = vi.fn();
});

afterEach(() => {
  HTMLFormElement.prototype.requestSubmit = originalRequestSubmit;
  cleanup();
});

describe("watched checkbox", () => {
  it("is not rendered when watched is undefined (logged out)", () => {
    render(Listing, { ...baseProps, service: [], watched: undefined });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("renders unchecked with a plain label when watched is false", () => {
    render(Listing, { ...baseProps, service: [], watched: false });

    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByText("Watched")).not.toHaveClass("text-green");
  });

  it("renders checked with a green label when watched is true", () => {
    render(Listing, { ...baseProps, service: [], watched: true });

    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByText("Watched")).toHaveClass("text-green");
  });

  it("submits the toggleWatched form when clicked", async () => {
    render(Listing, {
      ...baseProps,
      service: [],
      watched: false,
      year: "2025",
    });

    await fireEvent.click(screen.getByRole("checkbox"));

    expect(HTMLFormElement.prototype.requestSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("streaming service buttons", () => {
  it("shows 'Streaming unavailable' and no links when there are no services", () => {
    render(Listing, { ...baseProps, service: [] });

    expect(screen.getByText("Streaming unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("labels free services as 'for FREE' and links to their URL", () => {
    render(Listing, {
      ...baseProps,
      service: [{ name: "Tubi", link: "https://tubitv.com/movies/1" }],
    });

    const link = screen.getByRole("link", {
      name: "Stream for FREE on Tubi",
    });
    expect(link).toHaveAttribute("href", "https://tubitv.com/movies/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not add 'for FREE' for paid services", () => {
    render(Listing, {
      ...baseProps,
      service: [{ name: "Netflix", link: "https://netflix.com/watch/1" }],
    });

    expect(
      screen.getByRole("link", { name: "Stream on Netflix" }),
    ).toBeInTheDocument();
  });

  it("shows a showtimes prompt instead of 'stream on' for Fandango", () => {
    render(Listing, {
      ...baseProps,
      service: [{ name: "Fandango", link: "https://fandango.com/x" }],
    });

    expect(
      screen.getByRole("link", { name: "Check Fandango For Showtimes" }),
    ).toBeInTheDocument();
  });

  it("renders one button per service, in order, when there are several", () => {
    render(Listing, {
      ...baseProps,
      service: [
        { name: "Prime", link: "https://amazon.com/1" },
        { name: "Roku", link: "https://roku.com/1" },
      ],
    });

    expect(
      screen.getByRole("link", { name: "Stream on Prime" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Stream for FREE on Roku" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Streaming unavailable")).not.toBeInTheDocument();
  });
});
