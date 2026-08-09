<script lang="ts">
  import { enhance } from "$app/forms";
  export let data;
  export let form;
</script>

<h2 class="text-2xl font-display mb-4">Edit film</h2>

<form method="POST" action="?/update" use:enhance class="flex flex-col gap-3 max-w-sm">
  <label>
    Title
    <input name="title" required value={data.film.title} class="w-full text-black px-2 py-1" />
  </label>
  <label>
    Date (M/D/YYYY, optional)
    <input name="date" value={data.film.date} class="w-full text-black px-2 py-1" />
  </label>
  <label>
    JustWatch URL override (optional)
    <input
      name="justwatch_url"
      value={data.film.justwatch_url ?? ""}
      class="w-full text-black px-2 py-1"
    />
  </label>
  <button type="submit" class="btn bg-green text-white font-bold py-2 px-4 rounded-full self-start"
    >Save via scraper</button
  >
</form>

<form method="POST" action="?/delete" use:enhance class="mt-4">
  <button type="submit" class="text-sm text-red-400 underline">Delete via scraper</button>
</form>

{#if form?.error}
  <p class="text-red-400 mt-4">{form.error}</p>
{:else if form?.deleted}
  <p class="text-green mt-4">
    Deleted via the scraper. <a href="/admin/films" class="underline">Back to films</a>
  </p>
{:else if form?.success}
  <p class="text-green mt-4">Saved via the scraper.</p>
{:else if form?.rescraped}
  <p class="text-green mt-4">Offers updated from a fresh scrape.</p>
{/if}

<h3 class="text-xl mt-8 mb-2">Offers</h3>

<form method="POST" action="?/rescrape" use:enhance class="mb-4">
  <button type="submit" class="text-sm text-green underline">Rescrape this film</button>
</form>

{#if form?.rescrapePreview}
  <p class="text-sm mb-4">
    +{form.rescrapePreview.added} -{form.rescrapePreview.removed} ~{form.rescrapePreview.changed}
    ({form.rescrapePreview.unchanged} unchanged)
  </p>
  <form method="POST" action="?/applyRescrape" use:enhance class="mb-6">
    <button type="submit" class="text-sm text-green underline">Apply</button>
  </form>
{/if}

<h4 class="text-lg mb-2">Current offers (from our database)</h4>
{#if data.film.services.length === 0}
  <p class="text-sm opacity-70">No offers stored yet.</p>
{:else}
  <ul>
    {#each data.film.services as service}
      <li class="py-1 border-b border-white/10 text-sm">
        {service.name} — {service.type}{service.price !== null ? ` ($${service.price})` : ""}
      </li>
    {/each}
  </ul>
{/if}
