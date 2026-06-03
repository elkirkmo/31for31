<script>
  import BgSmoke from "../components/bg-smoke.svelte";
  import Footer from "../components/footer.svelte";
  import { enhance } from "$app/forms";
  import "../app.css";

  export let data;
</script>

<div class="min-h-screen flex flex-col max-w-3xl mx-auto px-4">
  <header class="flex justify-between py-4">
    <a href="/" class="text-sm text-green underline">← Home</a>
    {#if data.session}
      <form method="POST" action="/logout" use:enhance>
        <button type="submit" class="text-sm text-green underline"
          >Log out</button
        >
      </form>
    {:else}
      <a href="/login" class="text-sm text-green underline">Log in</a>
    {/if}
  </header>
  <main class="flex-1">
    <slot />
  </main>
  <Footer />
</div>
<BgSmoke />
