<script lang="ts">
  import { enhance } from "$app/forms";

  export let date: string;
  export let title: string;
  export let service: { name: string; link: string }[];
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
      <label class="watch-checkbox">
        <input
          type="checkbox"
          checked={watched}
          on:change={(e) => e.currentTarget.form?.requestSubmit()}
        />
        <span class="watch-checkmark" />
        <span class="text-sm" class:text-green={watched}>Watched</span>
      </label>
    </form>
  {/if}

  {#each service as s}
    <a target="_blank" href={s.link} rel="noopener noreferrer">
      <button
        type="button"
        class="btn bg-green hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full mb-4"
      >
        {buttonText(s.name)}
      </button></a
    >
  {/each}
  {#if service.length === 0}
    <h3>Streaming unavailable</h3>
  {/if}
</div>

<style>
  /* Checkbox adapted from https://uiverse.io/Praashoo7/white-seahorse-98 */
  .watch-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 0.6em;
    position: relative;
    cursor: pointer;
    font-size: 1rem;
    user-select: none;
  }

  .watch-checkbox input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  .watch-checkmark {
    position: relative;
    height: 2em;
    width: 2em;
    flex-shrink: 0;
    background-color: #1a1a1a;
    border-radius: 50%;
    transition: 0.4s;
  }

  .watch-checkmark:hover {
    box-shadow:
      inset 6px 6px 8px #000000,
      inset -6px -6px 8px #333333;
  }

  .watch-checkbox input:checked ~ .watch-checkmark {
    box-shadow: none;
    background-color: #66cc33;
    transform: rotateX(360deg);
  }

  .watch-checkbox input:checked ~ .watch-checkmark:hover {
    box-shadow: 0 0 10px rgba(102, 204, 51, 0.6);
  }

  .watch-checkmark:after {
    content: "";
    position: absolute;
    display: none;
  }

  .watch-checkbox input:checked ~ .watch-checkmark:after {
    display: block;
  }

  .watch-checkmark:after {
    left: 0.7em;
    top: 0.45em;
    width: 0.35em;
    height: 0.7em;
    border: solid white;
    border-width: 0 0.15em 0.15em 0;
    box-shadow: 0.1em 0.1em 0 rgba(0, 0, 0, 0.3);
    transform: rotate(45deg);
  }
</style>
