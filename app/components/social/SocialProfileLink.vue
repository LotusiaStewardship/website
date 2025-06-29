<script setup lang="ts">
import type { ScriptChunkPlatformUTF8 } from '~/submodules/rank-lib'
import { PlatformIcon, PlatformURL } from '~/utils/constants'

const { avatarCache, preloadAvatars } = useAvatars()

const props = defineProps<{
  platform: ScriptChunkPlatformUTF8
  profileId: string
  postId?: string
}>()

preloadAvatars([{
  platform: props.platform,
  profileId: props.profileId
}])
</script>

<template>
  <span class="flex items-center">
    <NuxtLink
      :to="`/social/${props.platform}/${props.profileId}`"
      target="_blank"
      class="font-semibold underline flex items-center"
    >
      <UAvatar
        :src="avatarCache[`${props.platform}:${props.profileId}`]"
        size="sm"
        :alt="`${props.profileId}'s avatar`"
        class="mr-2"
      />
      <span class="text-sm">
        {{ props.profileId }}
      </span>
      <UIcon
        :name="PlatformIcon[props.platform]"
        class="ml-1"
      />
    </NuxtLink>
    <NuxtLink
      v-if="props.postId"
      :to="PlatformURL[props.platform].post(props.profileId, props.postId)"
      target="_blank"
      class="ml-2"
    >
      <UBadge
        color="primary"
        variant="subtle"
        size="xs"
      >
        See Post
        <UIcon
          name="i-mdi-arrow-right"
          class="ml-1"
        />
      </UBadge>
    </NuxtLink>
  </span>
</template>
