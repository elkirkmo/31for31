<script lang="ts">
  export let icon: string | null | undefined = undefined;
  export let iconAlt: string = "";
  export let emoji: string | null | undefined = undefined;
  export let text: string;
  export let href: string | null | undefined = undefined;
</script>

{#snippet content()}
  {#if emoji}
    <span aria-hidden="true">{emoji}</span>
  {:else}
    <img src={icon} alt={iconAlt} class="w-8 h-8 rounded-full object-cover" />
  {/if}
  {text}
{/snippet}

{#if href}
  <a target="_blank" {href} rel="noopener noreferrer">
    <button
      type="button"
      class="btn bg-green hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full mb-4 mr-[1pc] inline-flex items-center gap-2"
      on:click
      {...$$restProps}
    >
      {@render content()}
    </button>
  </a>
{:else}
  <button
    type="button"
    class="btn bg-green hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full mb-4 mr-[1pc] inline-flex items-center gap-2"
    on:click
    {...$$restProps}
  >
    {@render content()}
  </button>
{/if}
