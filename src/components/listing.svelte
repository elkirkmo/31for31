<script lang="ts">
  import { enhance } from "$app/forms";

  export let date: string;
  export let title: string;
  export let service: string;
  export let alt_service: string;
  export let link: string;
  export let alt_link: string;
  export let year: string = "";
  export let watched: boolean | undefined = undefined;

  const forFree = (service: string) => {
    let forFree = false;
    switch (service.toLowerCase()) {
      case "tubi":
      case "plex":
      case "roku":
      case "plutotv":
      case "freevee":
      case "internet archive":
        forFree = true;
        break;
      default:
        forFree = false;
        break;
    }

    if (forFree) {
      return "for FREE";
    } else {
      return "";
    }
  };

  const buttonText = (s: string) => {
    if (s.toLowerCase() === "fandango") return `Check Fandango For Showtimes`;
    return `Stream ${forFree(s)} on ${s}`;
  };
</script>

<div class="mb-5 font-display">
  <b class="text-green">{date}</b>
  <h3 class="text-4xl mb-4">{title}</h3>

  {#if watched !== undefined}
    <form method="POST" action="?/toggleWatched" use:enhance class="mb-4">
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="year" value={year} />
      <label class="flex items-center gap-2 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={watched}
          on:change={(e) => e.currentTarget.form?.requestSubmit()}
          class="accent-green cursor-pointer w-4 h-4"
        />
        <span class="text-sm" class:text-green={watched}>Watched</span>
      </label>
    </form>
  {/if}

  {#if service}<a target="_blank" href={link} rel="noopener noreferrer">
      <button
        type="button"
        class="btn bg-green hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full mb-4"
      >
        {buttonText(service)}
      </button></a
    >{/if}
  {#if alt_service}<a target="_blank" href={alt_link} rel="noopener noreferrer">
      <button
        type="button"
        class="btn bg-green hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full"
      >
        {buttonText(alt_service)}
      </button></a
    >{/if}
  {#if !service && !alt_service}
    <h3>Streaming unavailable</h3>
  {/if}
</div>
