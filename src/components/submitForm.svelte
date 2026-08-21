<script lang="ts">
  import { enhance } from "$app/forms";

  export let action: string;
  export let label: string;
  export let busyLabel = "Working…";
  let className = "";
  export { className as class };

  // Busy state lives here rather than on the page so that a form inside an
  // {#if} block gets a fresh, enabled button every time the block remounts.
  // Nothing resets it on completion: these actions replace the surrounding
  // markup, and a spent button shouldn't come back armed.
  let busy = false;
</script>

<form
  method="POST"
  {action}
  class={className}
  use:enhance={() => {
    busy = true;
    return async ({ update }) => {
      await update();
    };
  }}
>
  <slot />
  <button
    type="submit"
    disabled={busy}
    aria-busy={busy}
    class="btn bg-green text-white font-bold py-2 px-4 rounded-full inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {#if busy}
      <!-- border-t-[transparent] is an arbitrary value on purpose: the
           Tailwind config replaces the palette with green/white/black, so
           border-t-transparent would silently generate nothing. -->
      <span
        class="inline-block w-4 h-4 border-2 border-white border-t-[transparent] rounded-full animate-spin"
        aria-hidden="true"
      ></span>
      {busyLabel}
    {:else}
      {label}
    {/if}
  </button>
</form>
