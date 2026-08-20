<script lang="ts">
  export let watched: number;
  export let total: number;
  export let year = "";

  $: percent = total > 0 ? Math.round((watched / total) * 100) : 0;
  $: label = year ? `Films watched in ${year}` : "Films watched";
</script>

{#if total > 0}
  <div class="mb-7 font-display">
    <div class="flex justify-between items-baseline mb-1">
      <span>{watched} of {total} watched</span>
      <span class="text-green">{percent}%</span>
    </div>
    <div
      class="h-3 w-full border-2 border-green"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={watched}
      aria-valuetext="{watched} of {total} films watched"
    >
      <!-- Inline width because the value is arbitrary; Tailwind can only
           generate classes it can see at build time. -->
      <div
        class="h-full bg-green transition-[width] duration-300"
        style:width="{percent}%"
      ></div>
    </div>
  </div>
{/if}
