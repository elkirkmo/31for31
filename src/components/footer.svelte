<script>
  import data from '../data.json'
  const { creditText, creditHandle, creditSuffix, disclaimer, disclaimerLinkText, githubUrl } = data.textContent.footer
</script>

<footer class="mb-7">
  <h5 class="mb-5">
    {creditText} <a
      href={githubUrl}
      target="_blank"
      rel="noopener noreferrer"
      class="text-green">{creditHandle}</a
    >{creditSuffix}
  </h5>
  <i class="text-sm"
    >{disclaimer} <a
      href={githubUrl}
      target="_blank"
      rel="noopener noreferrer"
      class="text-green">{disclaimerLinkText}</a
    >.
  </i>
</footer>
