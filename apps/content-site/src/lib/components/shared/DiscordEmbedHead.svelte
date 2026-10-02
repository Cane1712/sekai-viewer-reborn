<script lang="ts">
  import { DISCORD_SITE_NAME, type DiscordEmbedSeo } from "$lib/seo/discord-embed";

  let { seo }: { seo: DiscordEmbedSeo } = $props();
</script>

<!-- Render inside the page's `<svelte:head>`: link-preview tags for detail pages. -->
<title>{seo.pageTitle}</title>
<meta property="og:site_name" content={DISCORD_SITE_NAME} />
<meta property="og:title" content={seo.title} />
{#if seo.description}
  <meta property="og:description" content={seo.description} />
{/if}
{#if seo.imageUrl}
  <meta property="og:image" content={seo.imageUrl} />
{/if}
<meta property="og:url" content={seo.canonicalUrl} />
<meta property="og:type" content="article" />
<meta name="twitter:card" content="summary_large_image" />
<!-- Trusted server-built JSON (angle brackets escaped); renders Discord's component embed. -->
<!-- eslint-disable-next-line svelte/no-at-html-tags -- input is server-built JSON, not user HTML -->
{@html seo.inlineScriptHtml}
