import { describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/svelte/svelte5";
import { afterEach } from "vitest";
import Filter from "./filter.svelte";

afterEach(() => cleanup());

const baseProps = {
  services: ["Netflix", "Tubi", "Shudder"],
  prices: ["free", "subscription", "rent"],
};

function openFilter(
  props: Partial<typeof baseProps> & { canHideWatched?: boolean } = {},
) {
  render(Filter, { ...baseProps, ...props });
  fireEvent.click(screen.getByRole("button", { name: "Filter" }));
}

describe("dropdown toggle", () => {
  it("does not show filter options until the Filter button is clicked", () => {
    render(Filter, baseProps);

    expect(screen.queryByText("Services")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Filter" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("shows Services and Prices sections after clicking Filter", async () => {
    render(Filter, baseProps);

    await fireEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByText("Prices")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Filter" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("hides the dropdown again on a second click", async () => {
    render(Filter, baseProps);
    const button = screen.getByRole("button", { name: "Filter" });

    await fireEvent.click(button);
    await fireEvent.click(button);

    expect(screen.queryByText("Services")).not.toBeInTheDocument();
  });
});

describe("Services section", () => {
  it("starts with Show All and every service checked", async () => {
    await openFilter();
    const group = within(screen.getByRole("group", { name: "Services" }));

    expect(group.getByLabelText("Show All")).toBeChecked();
    for (const name of baseProps.services) {
      expect(group.getByLabelText(name)).toBeChecked();
    }
  });

  it("unchecking Show All unchecks every service", async () => {
    await openFilter();
    const group = within(screen.getByRole("group", { name: "Services" }));

    await fireEvent.click(group.getByLabelText("Show All"));

    expect(group.getByLabelText("Show All")).not.toBeChecked();
    for (const name of baseProps.services) {
      expect(group.getByLabelText(name)).not.toBeChecked();
    }
  });

  it("re-checking Show All checks every service again", async () => {
    await openFilter();
    const group = within(screen.getByRole("group", { name: "Services" }));
    const showAll = group.getByLabelText("Show All");

    await fireEvent.click(showAll);
    await fireEvent.click(showAll);

    expect(showAll).toBeChecked();
    for (const name of baseProps.services) {
      expect(group.getByLabelText(name)).toBeChecked();
    }
  });

  it("unchecking a single service leaves the others checked and unchecks Show All", async () => {
    await openFilter();
    const group = within(screen.getByRole("group", { name: "Services" }));

    await fireEvent.click(group.getByLabelText("Netflix"));

    expect(group.getByLabelText("Netflix")).not.toBeChecked();
    expect(group.getByLabelText("Tubi")).toBeChecked();
    expect(group.getByLabelText("Shudder")).toBeChecked();
    expect(group.getByLabelText("Show All")).not.toBeChecked();
  });

  it("manually checking every service again re-checks Show All", async () => {
    await openFilter();
    const group = within(screen.getByRole("group", { name: "Services" }));

    await fireEvent.click(group.getByLabelText("Netflix"));
    await fireEvent.click(group.getByLabelText("Netflix"));

    expect(group.getByLabelText("Show All")).toBeChecked();
  });

  it("does not affect the Prices section", async () => {
    await openFilter();
    const services = within(screen.getByRole("group", { name: "Services" }));
    const prices = within(screen.getByRole("group", { name: "Prices" }));

    await fireEvent.click(services.getByLabelText("Show All"));

    expect(prices.getByLabelText("Show All")).toBeChecked();
    expect(prices.getByLabelText("Free")).toBeChecked();
  });
});

describe("Prices section", () => {
  it("starts with Show All and every price type checked, labeled capitalized", async () => {
    await openFilter();
    const group = within(screen.getByRole("group", { name: "Prices" }));

    expect(group.getByLabelText("Show All")).toBeChecked();
    expect(group.getByLabelText("Free")).toBeChecked();
    expect(group.getByLabelText("Subscription")).toBeChecked();
    expect(group.getByLabelText("Rent")).toBeChecked();
  });

  it("unchecking Show All unchecks every price type", async () => {
    await openFilter();
    const group = within(screen.getByRole("group", { name: "Prices" }));

    await fireEvent.click(group.getByLabelText("Show All"));

    expect(group.getByLabelText("Free")).not.toBeChecked();
    expect(group.getByLabelText("Subscription")).not.toBeChecked();
    expect(group.getByLabelText("Rent")).not.toBeChecked();
  });

  it("allows selecting an individual price type after unchecking Show All", async () => {
    await openFilter();
    const group = within(screen.getByRole("group", { name: "Prices" }));

    await fireEvent.click(group.getByLabelText("Show All"));
    await fireEvent.click(group.getByLabelText("Free"));

    expect(group.getByLabelText("Free")).toBeChecked();
    expect(group.getByLabelText("Subscription")).not.toBeChecked();
    expect(group.getByLabelText("Show All")).not.toBeChecked();
  });
});

describe("Progress section", () => {
  it("is absent for a logged-out reader, who has nothing watched to hide", async () => {
    await openFilter();

    expect(
      screen.queryByRole("group", { name: "Progress" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Hide watched")).not.toBeInTheDocument();
  });

  it("shows an unchecked Hide watched box when the reader can have progress", async () => {
    await openFilter({ canHideWatched: true });
    const group = within(screen.getByRole("group", { name: "Progress" }));

    expect(group.getByLabelText("Hide watched")).not.toBeChecked();
  });

  it("checks and unchecks Hide watched", async () => {
    await openFilter({ canHideWatched: true });
    const box = screen.getByLabelText("Hide watched");

    await fireEvent.click(box);
    expect(box).toBeChecked();

    await fireEvent.click(box);
    expect(box).not.toBeChecked();
  });

  it("does not disturb the Services or Prices sections", async () => {
    await openFilter({ canHideWatched: true });

    await fireEvent.click(screen.getByLabelText("Hide watched"));

    const services = within(screen.getByRole("group", { name: "Services" }));
    const prices = within(screen.getByRole("group", { name: "Prices" }));
    expect(services.getByLabelText("Show All")).toBeChecked();
    expect(prices.getByLabelText("Show All")).toBeChecked();
  });
});

describe("empty option lists", () => {
  it("renders no checkboxes and an unchecked Show All when there are no services", async () => {
    await openFilter({ services: [] });
    const group = within(screen.getByRole("group", { name: "Services" }));

    expect(group.getByLabelText("Show All")).not.toBeChecked();
    expect(group.queryAllByRole("checkbox")).toHaveLength(1);
  });
});
