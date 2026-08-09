<script lang="ts">
  import { enhance } from "$app/forms";
  import { cubicOut } from "svelte/easing";
  import Button from "./button.svelte";

  export let date: string;
  export let title: string;
  export let service: {
    name: string;
    link: string | null;
    type: string;
    price: number | null;
    currency?: string | null;
    icon?: string | null;
  }[];
  export let year: string = "";
  export let watched: boolean | undefined = undefined;
  export let visibleServices: Set<string> | undefined = undefined;
  export let visiblePrices: Set<string> | undefined = undefined;

  const typeOrder = ["free", "subscription", "rent", "buy"];

  $: availableServices = service
    .filter(
      (s) =>
        s.type !== "cinema" &&
        !s.name.includes("Amazon Channel") &&
        !s.name.includes("Apple TV Channel") &&
        (visibleServices === undefined || visibleServices.has(s.name)) &&
        (visiblePrices === undefined || visiblePrices.has(s.type)),
    )
    .sort((a, b) => {
      const aIndex = typeOrder.indexOf(a.type);
      const bIndex = typeOrder.indexOf(b.type);
      return (
        (aIndex === -1 ? typeOrder.length : aIndex) -
        (bIndex === -1 ? typeOrder.length : bIndex)
      );
    });

  $: shownServices = watched === true ? [] : availableServices;

  // `watched === undefined` means nobody is logged in: the checkbox is still
  // shown, but inert, with a hint pointing at the login page.
  $: hintId = `watch-hint-${year}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const formatPrice = (price: number, currency?: string | null) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
    }).format(price);

  const buttonText = ({
    name,
    type,
    price,
    currency,
  }: {
    name: string;
    type: string;
    price: number | null;
    currency?: string | null;
  }) => {
    const uppercaseType = type.charAt(0).toUpperCase() + type.slice(1);

    if (type === "subscription") return `Stream with your ${name} ${type}`;
    const priceText =
      price !== null ? ` for ${formatPrice(price, currency)}` : "";
    return `${uppercaseType} on ${name}${priceText}`;
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  function poof(
    node: Element,
    { delay = 0, duration = 400 }: { delay?: number; duration?: number } = {},
  ) {
    return {
      delay,
      duration,
      easing: cubicOut,
      css: (t: number, u: number) => `
        opacity: ${t};
        transform: scale(${t}) translateY(${-u * 20}px) rotate(${u * 20}deg);
        filter: blur(${u * 5}px);
        pointer-events: ${t < 1 ? "none" : "auto"};
      `,
    };
  }
</script>

<div class="mb-5 font-display">
  <b class="text-green">{date}</b>
  <div class="flex items-center justify-center mb-4">
    <h3
      class="text-4xl"
      class:line-through={watched === true}
      class:decoration-green={watched === true}
    >
      {title}
    </h3>

    <div class="watch-hint ml-[30px] shrink-0">
      {#if watched === undefined}
        <label class="watch-checkbox watch-checkbox--locked">
          <input
            type="checkbox"
            checked={false}
            aria-disabled="true"
            aria-describedby={hintId}
            on:click={(e) => e.preventDefault()}
          />
          <span class="watch-checkmark"></span>
          <span class="text-sm">Watched</span>
        </label>
        <span id={hintId} class="watch-tooltip text-sm">
          Create an account to save progress.
          <a href="/login" class="text-green underline">Log in</a>
        </span>
      {:else}
        <form method="POST" action="?/toggleWatched" use:enhance>
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="year" value={year} />
          <label class="watch-checkbox">
            <input
              type="checkbox"
              checked={watched}
              on:change={(e) => e.currentTarget.form?.requestSubmit()}
            />
            <span class="watch-checkmark"></span>
            <span class="text-sm" class:text-green={watched}>Watched</span>
          </label>
        </form>
      {/if}
    </div>
  </div>

  {#each shownServices as s, i}
    {#if i > 0 && s.type !== shownServices[i - 1].type}
      <hr class="w-full border-t-2 border-white mb-5" />
    {/if}
    {#if i === 0 || s.type !== shownServices[i - 1].type}
      <h3 class="text-xl mb-2">{capitalize(s.type)}</h3>
    {/if}
    <span class="inline-block" in:poof out:poof={{ delay: i * 60 }}>
      <Button
        href={s.link}
        icon={s.icon}
        iconAlt="{s.name} icon"
        text={buttonText(s)}
      />
    </span>
  {/each}
  {#if shownServices.length === 0 && watched !== true}
    <h3>Streaming unavailable</h3>
  {/if}
</div>

<style>
  /* Checkbox adapted from https://uiverse.io/Praashoo7/white-seahorse-98 */
  .watch-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 0.6em;
    position: relative;
    cursor: pointer;
    font-size: 1rem;
    user-select: none;
  }

  .watch-checkbox input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  .watch-checkbox input:focus-visible ~ .watch-checkmark {
    outline: 2px solid #66cc33;
    outline-offset: 3px;
  }

  /* Logged-out state: present, but visibly inert. */
  .watch-checkbox--locked,
  .watch-checkbox--locked input {
    cursor: help;
  }

  .watch-checkbox--locked .watch-checkmark {
    opacity: 0.5;
  }

  .watch-checkbox--locked .watch-checkmark::before {
    animation: none;
    opacity: 0.2;
  }

  .watch-hint:hover .watch-checkbox--locked .watch-checkmark,
  .watch-hint:focus-within .watch-checkbox--locked .watch-checkmark {
    opacity: 0.85;
  }

  .watch-hint {
    position: relative;
    display: inline-flex;
    /* Vertical-only padding: enlarges the hover target without shifting the
       checkbox in its centred flex row. */
    padding: 0.4em 0;
  }

  .watch-tooltip {
    position: absolute;
    bottom: calc(100% + 0.35em);
    right: -0.5rem;
    z-index: 20;
    width: max-content;
    max-width: min(16rem, 70vw);
    padding: 0.5em 0.75em;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 0.5rem;
    background-color: #000000;
    box-shadow: 0 0 12px rgba(0, 0, 0, 0.9);
    text-align: left;
    opacity: 0;
    transform: translateY(0.35em);
    pointer-events: none;
    /* Appears instantly on hover, but lingers before fading so the pointer has
       time to travel down to the link. The delay is cancelled while hovered. */
    transition:
      opacity 0.2s ease 0.4s,
      transform 0.2s ease 0.4s,
      pointer-events 0.2s ease 0.4s;
    /* Keeps pointer-events on through the fade, so the link stays clickable
       during the grace period rather than only while strictly hovered. */
    transition-behavior: allow-discrete;
  }

  /* Invisible bridge across the gap between checkbox and tooltip, so moving the
     pointer between the two never leaves the hover area. */
  .watch-tooltip::before {
    content: "";
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: 1em;
  }

  /* Downward-pointing arrow tucked under the "Watched" label. */
  .watch-tooltip::after {
    content: "";
    position: absolute;
    top: 100%;
    right: 1.5rem;
    border: 0.4rem solid transparent;
    border-top-color: rgba(255, 255, 255, 0.25);
  }

  .watch-hint:hover .watch-tooltip,
  .watch-hint:focus-within .watch-tooltip {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
    transition-delay: 0s;
  }

  @media (prefers-reduced-motion: reduce) {
    /* No movement or fade, but keep the grace period before it disappears. */
    .watch-tooltip {
      transform: none;
      transition:
        opacity 0s linear 0.4s,
        pointer-events 0s linear 0.4s;
    }
  }

  .watch-checkmark {
    position: relative;
    height: 2em;
    width: 2em;
    flex-shrink: 0;
    background-color: #1a1a1a;
    border-radius: 50%;
    transition: 0.4s;
    --glow-color: 255, 255, 255;
  }

  .watch-checkmark::before {
    content: "";
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(var(--glow-color), 0.55) 0%,
      rgba(var(--glow-color), 0.25) 45%,
      rgba(var(--glow-color), 0) 75%
    );
    z-index: -1;
    pointer-events: none;
    animation: spooky-glow 2.4s ease-in-out infinite;
  }

  @keyframes spooky-glow {
    0%,
    100% {
      opacity: 0.55;
      transform: scale(0.9);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .watch-checkmark::before {
      animation: none;
    }
  }

  .watch-checkmark:hover {
    box-shadow:
      inset 6px 6px 8px #000000,
      inset -6px -6px 8px #333333;
  }

  .watch-checkbox input:checked ~ .watch-checkmark {
    box-shadow: none;
    background-color: #66cc33;
    transform: rotateX(360deg);
    --glow-color: 102, 204, 51;
  }

  .watch-checkbox input:checked ~ .watch-checkmark:hover {
    box-shadow: 0 0 10px rgba(102, 204, 51, 0.6);
  }

  .watch-checkbox input:not(:checked) ~ .watch-checkmark {
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.6);
  }

  .watch-checkmark:after {
    content: "";
    position: absolute;
    display: none;
  }

  .watch-checkbox input:checked ~ .watch-checkmark:after {
    display: block;
  }

  .watch-checkmark:after {
    left: 0.7em;
    top: 0.45em;
    width: 0.35em;
    height: 0.7em;
    border: solid white;
    border-width: 0 0.15em 0.15em 0;
    box-shadow: 0.1em 0.1em 0 rgba(0, 0, 0, 0.3);
    transform: rotate(45deg);
  }
</style>
