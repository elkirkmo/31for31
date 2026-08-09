<script>
  import { enhance } from "$app/forms";
  import { dev } from "$app/environment";
  import siteData from "../../data.json";
  export let form;

  const { heading, intro, legalHeading, legalText, legalLinkText, legalSuffix } =
    siteData.textContent.login;
  const { githubUrl } = siteData.textContent.footer;
</script>

<div class="max-w-sm mx-auto mt-16">
  <h1 class="text-4xl font-display text-green mb-4">{heading}</h1>

  <p class="text-sm mb-8">{intro}</p>

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
        <p class="text-[#ff6b6b] text-sm mb-4">{form.error}</p>
      {/if}
      <button
        type="submit"
        class="w-full bg-green text-white font-bold py-2 px-4 rounded-full hover:opacity-80"
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

  <section class="mt-10 pt-6 border-t border-white/20 text-left">
    <h2 class="font-display text-xl mb-2">{legalHeading}</h2>
    <p class="text-sm">
      {legalText}
      <a
        href={githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="text-green underline">{legalLinkText}</a
      >{legalSuffix}
    </p>
  </section>
</div>
