<script lang="ts">
  import Button from "./button.svelte";

  export let services: string[] = [];
  export let prices: string[] = [];

  export let selectedServices: Set<string> = new Set(services);
  export let selectedPrices: Set<string> = new Set(prices);

  export let open = false;

  $: allServicesSelected =
    services.length > 0 && services.every((s) => selectedServices.has(s));
  $: allPricesSelected =
    prices.length > 0 && prices.every((p) => selectedPrices.has(p));

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  function toggleOpen() {
    open = !open;
  }

  function toggleShowAllServices() {
    selectedServices = allServicesSelected ? new Set() : new Set(services);
  }

  function toggleService(name: string) {
    const next = new Set(selectedServices);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    selectedServices = next;
  }

  function toggleShowAllPrices() {
    selectedPrices = allPricesSelected ? new Set() : new Set(prices);
  }

  function togglePrice(type: string) {
    const next = new Set(selectedPrices);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    selectedPrices = next;
  }
</script>

<div class="relative mb-6 flex justify-center">
  <Button
    emoji="🎃"
    text="Filter"
    aria-expanded={open}
    on:click={toggleOpen}
  />

  {#if open}
    <div
      class="absolute z-10 top-full mt-2 w-72 max-w-[90vw] rounded-lg border border-white/20 bg-black p-4 shadow-lg text-left"
    >
      <fieldset class="m-0 mb-4 border-0 p-0">
        <legend class="text-xl mb-2">Services</legend>
        <div class="max-h-48 overflow-y-auto">
          <label
            class="flex items-center gap-2 py-1 border-b border-white/10 text-sm font-bold"
          >
            <input
              type="checkbox"
              class="accent-green"
              checked={allServicesSelected}
              on:change={toggleShowAllServices}
            />
            Show All
          </label>
          {#each services as name}
            <label
              class="flex items-center gap-2 py-1 border-b border-white/10 text-sm"
            >
              <input
                type="checkbox"
                class="accent-green"
                checked={selectedServices.has(name)}
                on:change={() => toggleService(name)}
              />
              {name}
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset class="m-0 border-0 p-0">
        <legend class="text-xl mb-2">Prices</legend>
        <div class="max-h-48 overflow-y-auto">
          <label
            class="flex items-center gap-2 py-1 border-b border-white/10 text-sm font-bold"
          >
            <input
              type="checkbox"
              class="accent-green"
              checked={allPricesSelected}
              on:change={toggleShowAllPrices}
            />
            Show All
          </label>
          {#each prices as type}
            <label
              class="flex items-center gap-2 py-1 border-b border-white/10 text-sm"
            >
              <input
                type="checkbox"
                class="accent-green"
                checked={selectedPrices.has(type)}
                on:change={() => togglePrice(type)}
              />
              {capitalize(type)}
            </label>
          {/each}
        </div>
      </fieldset>
    </div>
  {/if}
</div>
