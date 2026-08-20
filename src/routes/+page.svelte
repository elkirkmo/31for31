<script lang="ts">
  import { dev } from "$app/environment";
  import { inject } from "@vercel/analytics";

  inject({ mode: dev ? "development" : "production" });

  import { onMount } from "svelte";
  import Listing from "../components/listing.svelte";
  import Filter from "../components/filter.svelte";
  import ProgressBar from "../components/progressBar.svelte";
  import siteData from "../data.json";
  import { collectFilterOptions } from "$lib/services";
  import { readStoredYear, storeYear } from "$lib/yearPreference";

  export let data;

  $: years = Object.keys(data.filmsByYear).reverse();
  // Default to the newest year the server sent us rather than a hardcoded
  // one, so a year appearing on its October 1 becomes the landing view.
  let pickedYear: string | null = null;
  $: selectedYear = pickedYear ?? years[0];
  $: films = data.filmsByYear[selectedYear] ?? [];
  $: watchedForYear = (data.watched?.[selectedYear] ?? []) as string[];
  // Counted against this year's films rather than off watchedForYear.length:
  // progress can hold titles that have since been renamed or dropped, which
  // would otherwise push the count past the total.
  $: watchedCount = films.filter((film) =>
    watchedForYear.includes(film.title),
  ).length;
  $: filterOptions = collectFilterOptions(films);
  let selectedServices: Set<string> | undefined = undefined;
  let selectedPrices: Set<string> | undefined = undefined;

  // Restored after mount, not during init: the server has no localStorage,
  // so reading it earlier would render one year server-side and a different
  // one on hydration.
  onMount(() => {
    pickedYear = readStoredYear(years);
  });

  function pickYear(year: string) {
    pickedYear = year;
    storeYear(year);
  }

  const {
    heading,
    subheading,
    headingPrefix,
    description,
    podcastLinkText,
    podcastLinkUrl,
  } = siteData.textContent;
</script>

<svelte:head>
  <title>31 for 31 — Halloween Movies | Last Podcast on the Left</title>
  <meta
    name="description"
    content="Where to stream the 31 for 31 Halloween Movies selected by Ed and Henry from Last Podcast on the Left."
  />
  <meta property="og:title" content="31 for 31 — Halloween Movies" />
  <meta
    property="og:description"
    content="Where to stream Ed and Henry's 31 for 31 Halloween picks."
  />
</svelte:head>

<h1 class="lg:text-6xl mt-7 text-5xl font-display text-green">
  <span class="text-white text-3xl">{headingPrefix}</span>{heading}
</h1>
<h2 class="lg:text-4xl text-2xl font-display mb-7 border-b-2 border-green">
  {subheading}
</h2>

<p class="mb-7 mx-2">
  {description}
  <a
    href={podcastLinkUrl}
    target="_blank"
    rel="noopener noreferrer"
    class="text-green underline"
  >
    {podcastLinkText}</a
  >
</p>

<h3>Past Years</h3>
<ul id="pastYears" class="flex justify-center gap-4 list-none mb-[30px]">
  {#each years as year}
    <li>
      <button
        type="button"
        class="cursor-pointer font-display"
        class:text-green={selectedYear === year}
        class:underline={selectedYear === year}
        on:click={() => pickYear(year)}
        >{year}
      </button>
    </li>
  {/each}
</ul>

{#if data.session}
  <ProgressBar watched={watchedCount} total={films.length} year={selectedYear} />
{/if}

{#key selectedYear}
  <Filter
    services={filterOptions.services}
    prices={filterOptions.prices}
    bind:selectedServices
    bind:selectedPrices
  />
{/key}

{#each films as film}
  <Listing
    date={film.date}
    title={film.title}
    service={film.service}
    year={selectedYear}
    watched={data.session ? watchedForYear.includes(film.title) : undefined}
    visibleServices={selectedServices}
    visiblePrices={selectedPrices}
  />
{/each}
