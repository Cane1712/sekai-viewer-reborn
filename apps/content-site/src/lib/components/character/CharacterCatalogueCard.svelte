<script lang="ts">
  import { resolve } from "$app/paths";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import type { CharacterCatalogueItem } from "$lib/domain/character";

  let { character, region }: { character: CharacterCatalogueItem; region: string } = $props();
  const href = $derived(resolve("/character/[region]/[id]", { region, id: character.id }));
</script>

<a
  {href}
  class="character-card flex size-18! flex-none items-center justify-center rounded-full outline-none transition-transform duration-180 ease-out hover-lift focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:size-20!"
  title={character.name}
  aria-label={character.name}
>
  <CharacterAvatar
    src={getLocalCharacterThumbnailAssetURL(character.id)}
    label={character.name}
    characterId={character.id}
    accentColor={character.unitRecord?.colorCode}
    variant="default"
    decorative
    class="size-full! bg-base-100 shadow-sm"
    imageClass="size-full object-contain"
  />
</a>
