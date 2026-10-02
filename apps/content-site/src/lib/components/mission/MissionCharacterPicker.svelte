<script lang="ts">
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import type { MissionCharacterOption } from "$lib/domain/mission";
  import { resolveUnitLogoUrl } from "$lib/domain/unit-icon";

  let {
    characters,
    status,
    selectedId,
    getImageSrc,
    labels,
    onSelect,
    onRetry
  }: {
    characters: MissionCharacterOption[];
    status: "loading" | "ready" | "error";
    selectedId: number | null;
    getImageSrc: (id: number) => string | null;
    labels: {
      title: string;
      loading: string;
      error: string;
      retry: string;
      otherGroup: string;
      /** Small screens only: names the selected avatar that reopens the collapsed grid. */
      change: string;
    };
    onSelect: (id: number) => void;
    onRetry: () => void;
  } = $props();

  const titleId = $props.id();
  const gridId = `${titleId}-grid`;
  // Small screens collapse the grid once a character is chosen; wider screens always show it.
  let expanded = $state(false);
  const collapsed = $derived(selectedId !== null && !expanded);
  // Characters arrive in seq order, which already keeps each unit together.
  const groups = $derived(
    characters.reduce<{ key: string; label: string; characters: MissionCharacterOption[] }[]>(
      (result, character) => {
        const key = character.unit ?? "";
        const last = result.at(-1);
        if (last?.key === key) {
          last.characters.push(character);
        } else {
          result.push({
            key,
            label: character.unitName ?? character.unit ?? labels.otherGroup,
            characters: [character]
          });
        }
        return result;
      },
      []
    )
  );
  const selected = $derived(characters.find((character) => character.id === selectedId) ?? null);
  // Units whose logo failed to load fall back to their name.
  let failedLogos = $state<string[]>([]);
  const selectedGroup = $derived(
    groups.find((group) => group.characters.some((character) => character.id === selectedId)) ??
      null
  );
</script>

<!-- Each unit shows its logo, named for assistive technology; without one, its name. -->
{#snippet unitName(group: { key: string; label: string })}
  {@const logo = failedLogos.includes(group.key) ? null : resolveUnitLogoUrl(group.key)}
  {#if logo}
    <img
      src={logo}
      alt={group.label}
      class="h-9 w-auto max-w-32 object-contain"
      loading="lazy"
      decoding="async"
      onerror={() => (failedLogos = [...failedLogos, group.key])}
    />
  {:else}
    <p class="text-xs wrap-anywhere text-(--archive-text-muted)">{group.label}</p>
  {/if}
{/snippet}

<!-- Avatars stay grey until hovered, focused, or chosen; the chosen one also keeps its ring. -->
{#snippet avatar(character: MissionCharacterOption, active: boolean)}
  <CharacterAvatar
    src={getImageSrc(character.id)}
    characterId={character.id}
    label={character.name}
    variant="sm"
    class="size-full! transition-[filter] duration-180 motion-reduce:transition-none in-data-low-motion:transition-none {active
      ? 'grayscale-0'
      : 'grayscale group-hover:grayscale-0 group-focus-visible:grayscale-0'}"
    decorative
  />
{/snippet}

<section class="grid min-w-0 gap-3" aria-labelledby={titleId}>
  <h2 id={titleId} class="text-sm font-semibold text-(--archive-text-strong)">{labels.title}</h2>
  {#if status === "loading"}
    <p role="status" class="sr-only">{labels.loading}</p>
    <div class="flex flex-wrap gap-2" aria-hidden="true">
      {#each Array.from({ length: 12 }) as _, index (index)}
        <div class="size-12 rounded-full bg-(--archive-surface-sunken)"></div>
      {/each}
    </div>
  {:else if status === "error"}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p role="alert" class="text-sm text-error">{labels.error}</p>
      <button type="button" class="btn btn-link touch-target px-0" onclick={onRetry}>
        {labels.retry}
      </button>
    </div>
  {:else}
    <!-- Small screens drop the unit column and flow every unit into one compact grid. -->
    <div
      id={gridId}
      class="flex-wrap gap-1 sm:grid sm:gap-3"
      class:hidden={collapsed}
      class:flex={!collapsed}
    >
      {#each groups as group (group.key)}
        <div class="contents sm:grid sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-2">
          <div class="sr-only sm:not-sr-only">{@render unitName(group)}</div>
          <ul class="contents sm:flex sm:flex-wrap sm:gap-2" aria-label={group.label}>
            {#each group.characters as character (character.id)}
              <li class="last:mr-2 sm:last:mr-0">
                <button
                  type="button"
                  class="group btn btn-circle btn-ghost size-11 p-0 sm:size-12"
                  class:ring-2={character.id === selectedId}
                  class:ring-primary={character.id === selectedId}
                  aria-pressed={character.id === selectedId}
                  aria-label={character.name}
                  title={character.name}
                  onclick={() => {
                    expanded = false;
                    onSelect(character.id);
                  }}
                >
                  {@render avatar(character, character.id === selectedId)}
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
    {#if collapsed && selected}
      <!-- Small screens: once a character is chosen, only their unit and avatar stay; the
           avatar reopens the grid, and choosing a character collapses it again. -->
      <div class="grid grid-cols-[8rem_auto] items-center gap-2 sm:hidden">
        {@render unitName(selectedGroup ?? { key: "", label: labels.otherGroup })}
        <button
          type="button"
          class="group btn btn-circle btn-ghost size-11 p-0 ring-2 ring-primary"
          aria-label={`${labels.change}: ${selected.name}`}
          title={selected.name}
          aria-controls={gridId}
          aria-expanded="false"
          onclick={() => (expanded = true)}
        >
          {@render avatar(selected, true)}
        </button>
      </div>
    {/if}
  {/if}
</section>
