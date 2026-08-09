import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte/svelte5";
import Listing from "./listing.svelte";

// Defaults to the logged-in-but-unwatched state so the service-button and
// filter suites below aren't picking up the logged-out "Log in" hint link.
const baseProps = {
  date: "10/1/2025",
  title: "The Thing From Another World",
  watched: false,
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
  it("renders an inert, unchecked checkbox when watched is undefined (logged out)", () => {
    render(Listing, { ...baseProps, service: [], watched: undefined });

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
  });

  it("does not toggle or submit anything when the logged-out checkbox is clicked", async () => {
    render(Listing, { ...baseProps, service: [], watched: undefined });

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    await fireEvent.click(checkbox);

    expect(checkbox).not.toBeChecked();
    expect(HTMLFormElement.prototype.requestSubmit).not.toHaveBeenCalled();
  });

  it("describes the logged-out checkbox with a hint linking to the login page", () => {
    render(Listing, { ...baseProps, service: [], watched: undefined });

    const hint = screen.getByText(/Create an account to save progress/);
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "aria-describedby",
      hint.id,
    );

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("does not render the login hint once a user is logged in", () => {
    render(Listing, { ...baseProps, service: [], watched: false });

    expect(
      screen.queryByText(/Create an account to save progress/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Log in" }),
    ).not.toBeInTheDocument();
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

  it("does not strike through the title when watched is false or undefined", () => {
    render(Listing, { ...baseProps, service: [], watched: false });
    expect(screen.getByText(baseProps.title)).not.toHaveClass("line-through");

    cleanup();
    render(Listing, { ...baseProps, service: [], watched: undefined });
    expect(screen.getByText(baseProps.title)).not.toHaveClass("line-through");
  });

  it("puts a green strikethrough through the title when watched is true", () => {
    render(Listing, { ...baseProps, service: [], watched: true });

    expect(screen.getByText(baseProps.title)).toHaveClass(
      "line-through",
      "decoration-green",
    );
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

    const link = screen.getByRole("link", { name: "Tubi icon Free on Tubi" });
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
        name: "Netflix icon Stream with your Netflix subscription",
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
      screen.getByRole("link", {
        name: "Amazon Video icon Rent on Amazon Video for $3.99",
      }),
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
      screen.getByRole("link", {
        name: "Shudder icon Stream with your Shudder subscription",
      }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(1);
  });

  it("renders one button per service when there are several", () => {
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
      screen.getByRole("link", {
        name: "Prime icon Stream with your Prime subscription",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Roku icon Free on Roku" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Streaming unavailable")).not.toBeInTheDocument();
  });

  it("groups buttons by type in the order free, subscription, rent, buy", () => {
    render(Listing, {
      ...baseProps,
      service: [
        {
          name: "Amazon Video",
          link: "https://amazon.com/buy",
          type: "buy",
          price: 12.99,
          currency: "USD",
          icon: "https://images.justwatch.com/icon/amazon.webp",
        },
        {
          name: "Amazon Video",
          link: "https://amazon.com/rent",
          type: "rent",
          price: 3.99,
          currency: "USD",
          icon: "https://images.justwatch.com/icon/amazon.webp",
        },
        {
          name: "Netflix",
          link: "https://netflix.com/1",
          type: "subscription",
          price: null,
          currency: "USD",
          icon: "https://images.justwatch.com/icon/netflix.webp",
        },
        {
          name: "Tubi",
          link: "https://tubitv.com/1",
          type: "free",
          price: null,
          currency: "USD",
          icon: "https://images.justwatch.com/icon/tubi.webp",
        },
      ],
    });

    const links = screen
      .getAllByRole("link")
      .map((link) => link.textContent?.replace(/\s+/g, " ").trim());
    expect(links).toEqual([
      "Free on Tubi",
      "Stream with your Netflix subscription",
      "Rent on Amazon Video for $3.99",
      "Buy on Amazon Video for $12.99",
    ]);
    expect(document.querySelectorAll("hr")).toHaveLength(3);

    const icons = screen
      .getAllByRole("img")
      .map((img) => [img.getAttribute("src"), img.getAttribute("alt")]);
    expect(icons).toEqual([
      ["https://images.justwatch.com/icon/tubi.webp", "Tubi icon"],
      ["https://images.justwatch.com/icon/netflix.webp", "Netflix icon"],
      ["https://images.justwatch.com/icon/amazon.webp", "Amazon Video icon"],
      ["https://images.justwatch.com/icon/amazon.webp", "Amazon Video icon"],
    ]);

    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      baseProps.title,
      "Free",
      "Subscription",
      "Rent",
      "Buy",
    ]);
  });
});

describe("filtering by visibleServices/visiblePrices", () => {
  const services = [
    {
      name: "Netflix",
      link: "https://netflix.com/1",
      type: "subscription",
      price: null,
      currency: "USD",
    },
    {
      name: "Tubi",
      link: "https://tubitv.com/1",
      type: "free",
      price: null,
      currency: "USD",
    },
  ];

  it("shows every service when visibleServices/visiblePrices are undefined", () => {
    render(Listing, { ...baseProps, service: services });

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("hides services not in visibleServices", () => {
    render(Listing, {
      ...baseProps,
      service: services,
      visibleServices: new Set(["Netflix"]),
    });

    expect(screen.getByRole("link", { name: /Netflix/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Tubi/ })).not.toBeInTheDocument();
  });

  it("hides services not in visiblePrices", () => {
    render(Listing, {
      ...baseProps,
      service: services,
      visiblePrices: new Set(["free"]),
    });

    expect(screen.getByRole("link", { name: /Tubi/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Netflix/ }),
    ).not.toBeInTheDocument();
  });

  it("shows 'Streaming unavailable' when the filters exclude every service", () => {
    render(Listing, {
      ...baseProps,
      service: services,
      visibleServices: new Set<string>(),
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Streaming unavailable")).toBeInTheDocument();
  });

  it("applies both filters together", () => {
    render(Listing, {
      ...baseProps,
      service: services,
      visibleServices: new Set(["Netflix", "Tubi"]),
      visiblePrices: new Set(["free"]),
    });

    expect(screen.getByRole("link", { name: /Tubi/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Netflix/ }),
    ).not.toBeInTheDocument();
  });
});

describe("hiding services once watched", () => {
  const services = [
    {
      name: "Tubi",
      link: "https://tubitv.com/1",
      type: "free",
      price: null,
      currency: "USD",
    },
  ];

  it("does not render service buttons when watched is true from the start", () => {
    render(Listing, { ...baseProps, service: services, watched: true });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("Streaming unavailable")).not.toBeInTheDocument();
  });

  it("shows service buttons when watched is false", () => {
    render(Listing, { ...baseProps, service: services, watched: false });

    expect(screen.getByRole("link", { name: /Tubi/ })).toBeInTheDocument();
  });

  it("still shows service buttons when logged out", () => {
    render(Listing, { ...baseProps, service: services, watched: undefined });

    expect(screen.getByRole("link", { name: /Tubi/ })).toBeInTheDocument();
  });

  it("animates service buttons away once watched flips to true", async () => {
    const { rerender } = render(Listing, {
      ...baseProps,
      service: services,
      watched: false,
    });

    expect(screen.getByRole("link", { name: /Tubi/ })).toBeInTheDocument();

    await rerender({ ...baseProps, service: services, watched: true });

    await waitFor(
      () => {
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("brings service buttons back when watched flips back to false", async () => {
    const { rerender } = render(Listing, {
      ...baseProps,
      service: services,
      watched: true,
    });

    await rerender({ ...baseProps, service: services, watched: false });

    expect(screen.getByRole("link", { name: /Tubi/ })).toBeInTheDocument();
  });
});
