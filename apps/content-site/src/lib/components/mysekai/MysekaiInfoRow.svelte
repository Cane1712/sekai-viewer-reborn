<script lang="ts">
  import type { Snippet } from "svelte";

  let { label, children }: { label: string; children: Snippet } = $props();
</script>

<div class="content-card-inset rounded-xl p-3 sm:px-4">
  <dt class="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">{label}</dt>
  <dd class="mt-1 text-sm font-medium wrap-anywhere">{@render children()}</dd>
</div>
