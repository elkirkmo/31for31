<script>
  import { enhance } from "$app/forms";
  import { dev } from "$app/environment";
  export let form;
</script>

<div class="max-w-sm mx-auto mt-16">
  <h1 class="text-4xl font-display text-green mb-8">Sign in</h1>

  {#if form?.message}
    <p class="mb-6 text-green">{form.message}</p>
  {:else}
    <form method="POST" action="?/magicLink" use:enhance>
      <label class="block mb-2 text-sm" for="email">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        class="w-full bg-white border border-white rounded px-3 py-2 mb-4 text-green focus:outline-none focus:border-green"
        placeholder="you@example.com"
      />
      {#if form?.error}
        <p class="text-red-400 text-sm mb-4">{form.error}</p>
      {/if}
      <button
        type="submit"
        class="w-full bg-green text-white font-bold py-2 px-4 rounded-full hover:bg-green-700"
      >
        Send magic link
      </button>
    </form>
  {/if}

  {#if dev}
    <form method="POST" action="?/devLogin" use:enhance class="mt-6">
      <button
        type="submit"
        class="w-full border border-white text-white font-bold py-2 px-4 rounded-full hover:border-green hover:text-green"
      >
        Dev login
      </button>
    </form>
  {/if}
</div>
