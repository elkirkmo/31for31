<script>
  import { dev } from '$app/environment';
  import { inject } from '@vercel/analytics';

  inject({ mode: dev ? 'development' : 'production' });
  import '../app.css';

  export let films;
  import Listing from '../components/listing.svelte';
  import BgSmoke from '../components/bg-smoke.svelte';
  import Footer from '../components/footer.svelte';
  import data from '../data.json';

  films = data;
</script>

<h1 class="lg:text-6xl mt-7 text-5xl font-display text-green">
  <span class="text-white text-3xl">Last Podcast on the Left presents: </span>31
  for 31
</h1>
<h2 class="lg:text-4xl text-2xl font-display mb-7 border-b-green bottom-2">
  Movies to Watch This October
</h2>

<p class="mb-7 mx-2">
  Here's where to stream (almost) all of the 31 for 31 Halloween Movies selected
  by Ed and Henry from <a
    href="https://open.spotify.com/episode/1P11eNk7cJzwRtJOk7KCaV?si=881b4ced12e24d92"
    target="_blank"
    class="text-green underline"
  >
    Last Podcast on the Left: Side Stories</a
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
