<script>
  export let date;
  export let title;
  export let service;
  export let alt_service;
  export let link;
  export let alt_link;

  export const forFree = (service) => {
    let forFree = false;
    switch (service.toLowerCase()) {
      case 'tubi':
      case 'plex':
      case 'roku':
      case 'plutotv':
      case 'freevee':
      case 'internet archive':
        forFree = true;
        break;
      default:
        forFree = false;
        break;
    }

    if (forFree) {
      return 'for FREE';
    } else {
      return '';
    }
  };

  const buttonText = (s) => {
    if (s.toLowerCase() === 'fandango') return `Check Fandango For Showtimes`;
    return `Stream ${forFree(s)} on ${s}`;
  };
</script>

<div
  class={`mb-5 font-display ${service.toLowerCase()} ${alt_service.toLowerCase()}`}
>
  <b class="text-green">{date}</b>
  <h3 class="text-4xl mb-4">{title}</h3>

  {#if service}<a target="_blank" href={link}>
      <button
        type="button"
        class="btn bg-green hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-full mb-4"
      >
        {buttonText(service)}
      </button></a
    >{/if}
  {#if alt_service}<a target="_blank" href={alt_link}>
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
