import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte/svelte5";
import SubmitForm from "./submitForm.svelte";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // use:enhance submits via fetch. The promise deliberately never settles so
  // the in-flight state stays observable; what happens after the response is
  // the action's business, not this component's.
  fetchMock = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderForm() {
  return render(SubmitForm, {
    action: "?/applyAll",
    label: "Apply all matched films",
    busyLabel: "Applying all films…",
  });
}

describe("submit form", () => {
  it("starts as an enabled button showing its label", () => {
    renderForm();

    const button = screen.getByRole("button", {
      name: "Apply all matched films",
    });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-busy", "false");
  });

  it("swaps to the busy label once submitted", async () => {
    renderForm();
    await fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Applying all films/ }),
      ).toBeInTheDocument();
    });
  });

  it("disables the button while the action is in flight", async () => {
    renderForm();
    await fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("cannot be fired a second time", async () => {
    renderForm();
    const button = screen.getByRole("button");

    await fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await fireEvent.click(button);
    await fireEvent.click(button);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("posts to the action it was given", async () => {
    renderForm();
    await fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/applyAll");
  });
});
