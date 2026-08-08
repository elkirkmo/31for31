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

  it("labels free services without a price and links to their URL", () => {
    render(Listing, {
      ...baseProps,
      service: [
        {
          name: "Tubi",
          link: "https://tubitv.com/movies/1",
          type: "free",
          price: null,
          currency: "USD",
        },
      ],
    });

    const link = screen.getByRole("link", { name: "Free on Tubi" });
    expect(link).toHaveAttribute("href", "https://tubitv.com/movies/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("labels subscription services as 'Stream with your ... subscription'", () => {
    render(Listing, {
      ...baseProps,
      service: [
        {
          name: "Netflix",
          link: "https://netflix.com/watch/1",
          type: "subscription",
          price: null,
          currency: "USD",
        },
      ],
    });

    expect(
      screen.getByRole("link", {
        name: "Stream with your Netflix subscription",
      }),
    ).toBeInTheDocument();
  });

  it("labels rent/buy services with type, name, and formatted price", () => {
    render(Listing, {
      ...baseProps,
      service: [
        {
          name: "Amazon Video",
          link: "https://amazon.com/1",
          type: "rent",
          price: 3.99,
          currency: "USD",
        },
      ],
    });

    expect(
      screen.getByRole("link", { name: "Rent on Amazon Video for $3.99" }),
    ).toBeInTheDocument();
  });

  it("ignores cinema-type services", () => {
    render(Listing, {
      ...baseProps,
      service: [
        {
          name: "Fandango",
          link: "https://fandango.com/x",
          type: "cinema",
          price: null,
          currency: "USD",
        },
      ],
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Streaming unavailable")).toBeInTheDocument();
  });

  it("ignores duplicate Amazon Channel and Apple TV Channel add-ons", () => {
    render(Listing, {
      ...baseProps,
      service: [
        {
          name: "Shudder Amazon Channel",
          link: "https://amazon.com/shudder",
          type: "subscription",
          price: null,
          currency: "USD",
        },
        {
          name: "Starz Apple TV Channel",
          link: "https://tv.apple.com/starz",
          type: "subscription",
          price: null,
          currency: "USD",
        },
        {
          name: "Shudder",
          link: "https://shudder.com/1",
          type: "subscription",
          price: null,
          currency: "USD",
        },
      ],
    });

    expect(
      screen.getByRole("link", { name: "Stream with your Shudder subscription" }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(1);
  });

  it("renders one button per service, in order, when there are several", () => {
    render(Listing, {
      ...baseProps,
      service: [
        {
          name: "Prime",
          link: "https://amazon.com/1",
          type: "subscription",
          price: null,
          currency: "USD",
        },
        {
          name: "Roku",
          link: "https://roku.com/1",
          type: "free",
          price: null,
          currency: "USD",
        },
      ],
    });

    expect(
      screen.getByRole("link", { name: "Stream with your Prime subscription" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Free on Roku" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Streaming unavailable")).not.toBeInTheDocument();
  });
});
