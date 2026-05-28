<script>
  import { dev } from "$app/environment";
  import { inject } from "@vercel/analytics";

  inject({ mode: dev ? "development" : "production" });
  import "../app.css";

  export let films;
  import Listing from "../components/listing.svelte";
  import BgSmoke from "../components/bg-smoke.svelte";
  import Footer from "../components/footer.svelte";
  import data from "../data.json";

  films = data["2025"];
  const {
    heading,
    subheading,
    headingPrefix,
    description,
    podcastLinkText,
    podcastLinkUrl,
  } = data.textContent;
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

{#each films as film}
  <Listing
    date={film.date}
    title={film.title}
    service={film.service}
    link={film.link}
    alt_service={film.alt_service}
    alt_link={film.alt_link}
  />
{/each}
<BgSmoke />
<Footer />
