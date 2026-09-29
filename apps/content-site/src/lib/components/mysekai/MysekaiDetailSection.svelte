<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "@iconify/svelte";

  let {
    title,
    icon,
    aside = null,
    children
  }: {
    title: string;
    icon: string;
    /** A compact badge beside the title, such as the ID. */
    aside?: string | null;
    children: Snippet;
  } = $props();
</script>

<section class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <div class="flex items-start justify-between gap-3">
      <h2
        class="flex items-center gap-1.5 text-xs font-semibold tracking-[0.18em] uppercase opacity-60"
      >
        <Icon {icon} class="size-4 shrink-0 translate-y-[0.5px]" aria-hidden="true" />
        <span>{title}</span>
      </h2>
      {#if aside}
        <span class="badge badge-outline border-base-content/20 font-semibold">{aside}</span>
      {/if}
    </div>
    {@render children()}
  </div>
</section>
