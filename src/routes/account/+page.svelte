<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "../../components/button.svelte";
  import { displayFilmDate } from "$lib/filmDate";

  export let data;
  export let form;

  let confirming = false;

  const CONFIRM_MESSAGE =
    "This permanently deletes your 31 for 31 account and every film you've marked as watched.\n\nThis cannot be undone. Delete your account?";

  // Last line of defence against a stray tap or mis-click landing on the
  // submit button: a modal the browser draws itself, which can't be missed
  // or clicked through by accident.
  const confirmDelete = ({ cancel }: { cancel: () => void }) => {
    if (!window.confirm(CONFIRM_MESSAGE)) cancel();
  };
</script>

<svelte:head>
  <title>My Account — 31 for 31</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<h1 class="text-4xl font-display text-green mb-2">My Account</h1>
<p class="text-sm mb-10">
  Everything 31 for 31 stores about you is on this page.
</p>

<section class="mb-10 text-left">
  <h2 class="text-2xl font-display mb-2">Email</h2>
  <div
    class="flex flex-wrap items-center justify-between gap-x-4 border-b border-white/10 pt-2"
  >
    <span class="mb-4">{data.email}</span>
    <Button
      emoji="🗑️"
      text="Delete my account"
      aria-expanded={confirming}
      on:click={() => (confirming = !confirming)}
    />
  </div>

  {#if confirming}
    <div class="mt-4 rounded-lg border border-[#ff6b6b] p-4">
      <p class="text-sm mb-4">
        This permanently deletes your account and every film you've marked as
        watched. It can't be undone, and it only ever affects your own account.
        The film list itself stays exactly where it is — you can keep browsing
        without an account.
      </p>

      {#if form?.error}
        <p class="text-[#ff6b6b] text-sm mb-4">{form.error}</p>
      {/if}

      <form
        method="POST"
        action="?/deleteAccount"
        use:enhance={confirmDelete}
        class="flex flex-wrap items-center gap-4"
      >
        <button
          type="submit"
          class="bg-[#ff6b6b] text-black font-bold py-2 px-4 rounded-full hover:opacity-80"
        >
          Yes, delete everything
        </button>
        <button
          type="button"
          class="text-sm text-green underline"
          on:click={() => (confirming = false)}
        >
          Cancel
        </button>
      </form>
    </div>
  {/if}
</section>

<section class="text-left">
  <h2 class="text-2xl font-display mb-1">Films you've marked as watched</h2>
  <p class="text-sm opacity-70 mb-4">
    {data.totalWatched}
    {data.totalWatched === 1 ? "film" : "films"}. This is the only other thing stored
    against your account.
  </p>

  {#if data.years.length === 0}
    <p class="text-sm">
      Nothing yet — tick a film off on the <a href="/" class="text-green underline"
        >home page</a
      > and it'll show up here.
    </p>
  {:else}
    {#each data.years as year}
      <h3 class="text-xl mb-2">{year}</h3>
      <ul class="mb-6">
        {#each data.watchedByYear[year] as film}
          <li
            class="flex items-center justify-between py-1 border-b border-white/10"
          >
            <span>
              {#if film.date !== null}{displayFilmDate(film.date)} — {/if}{film.title}
            </span>
            {#if film.date === null}
              <span class="text-sm opacity-70">no longer on the list</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/each}
  {/if}
</section>
