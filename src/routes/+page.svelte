<script lang="ts">
  import { dev } from "$app/environment";
  import { inject } from "@vercel/analytics";

  inject({ mode: dev ? "development" : "production" });

  import Listing from "../components/listing.svelte";
  import siteData from "../data.json";

  export let data;

  const years = Object.keys(siteData).filter((k) => k !== "textContent");
  let selectedYear = "2025";
  $: films = siteData[selectedYear as "2024" | "2025"];
  $: watchedForYear = (data.watched?.[selectedYear] ?? []) as string[];

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
<ul id="pastYears" class="flex justify-center gap-4 list-none">
  {#each years as year}
    <li>
      <button
        type="button"
        class="cursor-pointer font-display"
        class:text-green={selectedYear === year}
        class:underline={selectedYear === year}
        on:click={() => (selectedYear = year)}
        >{year}
      </button>
    </li>
  {/each}
</ul>

{#each films as film}
  <Listing
    date={film.date}
    title={film.title}
    service={film.service}
    year={selectedYear}
    watched={data.session ? watchedForYear.includes(film.title) : undefined}
  />
{/each}
