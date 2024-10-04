<script>
  import { dev } from '$app/environment';
  import { inject } from '@vercel/analytics';

  inject({ mode: dev ? 'development' : 'production' });
  import '../app.css';

  export let films;
  import Listing from '../components/listing.svelte';
  import data from '../data.json';

  films = data;
</script>

<h1 class="text-6xl font-display">
  <span>Last Podcast on the Left presents: </span>31 for 31
</h1>
<h2 class="text-4xl font-display mb-7 border-b-green bottom-2">
  Movies to Watch This October
</h2>

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
