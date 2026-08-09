<script lang="ts">
  import { enhance } from "$app/forms";
  export let form;
</script>

<h2 class="text-2xl font-display mb-4">Add film</h2>

<form method="POST" use:enhance class="flex flex-col gap-3 max-w-sm">
  <label>
    Year
    <input name="year" required class="w-full text-black px-2 py-1" placeholder="2026" />
  </label>
  <label>
    Title
    <input name="title" required class="w-full text-black px-2 py-1" />
  </label>
  <label>
    Date (M/D/YYYY, optional)
    <input name="date" class="w-full text-black px-2 py-1" placeholder="10/1/2026" />
  </label>
  <label>
    JustWatch URL override (optional)
    <input name="justwatch_url" class="w-full text-black px-2 py-1" />
  </label>
  <button type="submit" class="btn bg-green text-white font-bold py-2 px-4 rounded-full self-start"
    >Add via scraper</button
  >
</form>

{#if form?.error}
  <p class="text-red-400 mt-4">{form.error}</p>
{:else if form?.success}
  <p class="text-green mt-4">
    Added "{form.film.title}" via the scraper. <a href="/admin/films" class="underline">Back to films</a>
  </p>
{/if}
