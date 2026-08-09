<script lang="ts">
  export let data;
</script>

<div class="flex items-center justify-between mb-4">
  <h2 class="text-2xl font-display">Films</h2>
  <div class="flex gap-4">
    <a href="/admin/refresh" class="text-sm text-green underline">Refresh offers</a>
    <a href="/admin/films/new" class="text-sm text-green underline">+ Add film</a>
  </div>
</div>

{#each Object.entries(data.filmsByYear) as [year, films]}
  <h3 class="text-xl mb-2">{year}</h3>
  <ul class="mb-6">
    {#each films as film}
      <li class="flex items-center justify-between py-1 border-b border-white/10">
        <span>{film.date} — {film.title} <span class="text-sm opacity-70">({film.serviceCount} offers)</span></span>
        <a href="/admin/films/{film.id}" class="text-sm text-green underline">Edit</a>
      </li>
    {/each}
  </ul>
{/each}
