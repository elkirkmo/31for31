<script lang="ts">
  import { enhance } from "$app/forms";
  import SubmitForm from "../../../components/submitForm.svelte";
  export let form;
</script>

<h2 class="text-2xl font-display mb-4">Refresh streaming offers</h2>

<p class="text-sm opacity-70 mb-4">
  Scrapes every film the <a
    href="https://31for31scraper.vercel.app"
    target="_blank"
    rel="noopener noreferrer"
    class="underline">scraper</a
  > knows about and shows what would change before writing anything. Only films
  already in our own table can be matched — a newly added film won't show up here
  until it's been rescraped individually from its edit page.
</p>

<form method="POST" action="?/preview" use:enhance class="mb-6">
  <button type="submit" class="btn bg-green text-white font-bold py-2 px-4 rounded-full">
    Preview refresh
  </button>
</form>

{#if form?.error}
  <p class="text-red-400 mb-4">{form.error}</p>
{/if}

{#if form?.appliedOne}
  <p class="text-green mb-4">Applied film #{form.appliedOne}.</p>
{/if}

{#if form?.appliedAll !== undefined}
  <p class="text-green mb-4">Applied {form.appliedAll} film(s).</p>
  <!-- A film losing every offer is the one change worth reading, so it gets
       its own block rather than being absorbed into the applied count. -->
  {#if form.cleared?.length}
    <div class="mb-4">
      <p class="text-sm">
        {form.cleared.length} film(s) now have no streaming services at all:
      </p>
      <ul class="text-sm mb-2">
        {#each form.cleared as name}
          <li>{name}</li>
        {/each}
      </ul>
      <p class="text-sm opacity-70">
        A few films really do stream nowhere. If one of these shouldn't, rescrape
        it from its edit page — an offer list can come back empty because a page
        moved, not because the film left every service.
      </p>
    </div>
  {/if}
  {#if form.errors?.length}
    <ul class="text-red-400 text-sm mb-4">
      {#each form.errors as err}
        <li>{err}</li>
      {/each}
    </ul>
  {/if}
{/if}

{#if form?.preview}
  <SubmitForm
    action="?/applyAll"
    label="Apply all matched films"
    busyLabel="Applying all films…"
    class="mb-4"
  />

  {#if form.preview.length === 0}
    <p class="text-sm opacity-70 mb-4">No matched films to refresh.</p>
  {:else}
    <div class="overflow-x-auto mb-6">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left border-b border-white/20">
            <th class="pr-4">Film</th>
            <th class="pr-4">Old</th>
            <th class="pr-4">New</th>
            <th class="pr-4">Diff</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each form.preview as row}
            <tr class="border-b border-white/10">
              <td class="pr-4 py-1">{row.title} ({row.year})</td>
              <td class="pr-4">{row.oldCount}</td>
              <td class="pr-4">{row.newCount}</td>
              <td class="pr-4">+{row.added} -{row.removed} ~{row.changed}</td>
              <td>
                <form method="POST" action="?/applyOne" use:enhance>
                  <input type="hidden" name="filmId" value={row.filmId} />
                  <button type="submit" class="text-sm text-green underline">Apply</button>
                </form>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if form.unmatched.length > 0}
    <h3 class="text-lg mb-2">Unmatched ({form.unmatched.length})</h3>
    <p class="text-sm opacity-70 mb-2">
      In the scraper's own list but not found in our films table by (year, title).
    </p>
    <ul class="text-sm opacity-70">
      {#each form.unmatched as title}
        <li>{title}</li>
      {/each}
    </ul>
  {/if}
{/if}
