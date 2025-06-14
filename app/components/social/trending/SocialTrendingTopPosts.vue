<script setup lang="ts">
import { PlatformIcon } from '~/utils/constants'
// import type { APIResponse } from '~/types'
import {
  formatRate,
  toMinifiedStatCount,
  truncatePostId,
  // toProfileUrl,
  toExternalPostUrl,
  toTrendingIcon,
  toUppercaseFirstLetter
} from '~/utils/functions'
import { useRankApi } from '~/composables/useRankApi'

defineExpose({
  id: 'top-posts'
})

const { getTopRankedPosts } = useRankApi()
const userPosts = await getTopRankedPosts('today')
const { avatarCache, isAvatarLoading, preloadAvatars } = useAvatars()

// Preload avatars for all posts
if (userPosts.length > 0) {
  await preloadAvatars(
    userPosts.map(post => ({
      platform: post.platform,
      profileId: post.profileId
    }))
  )
}
</script>

<template>
  <UDashboardCard class="relative">
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon
          name="i-heroicons-document-text"
          class="text-emerald-500 dark:text-emerald-400 w-6 h-6"
        />
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Trending Posts
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Posts with the highest engagement growth today.
          </p>
        </div>
      </div>
    </template>
    <div class="space-y-3">
      <NuxtLink
        v-for="(
          { changed, platform, profileId, postId, total }, index
        ) in userPosts"
        :key="index"
        :to="toExternalPostUrl(platform, profileId, postId)"
        target="_blank"
        class="p-3 -mx-2 last:-mb-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex items-center gap-4 relative transition-all duration-200 ease-in-out"
      >
        <ClientOnly>
          <UAvatar
            v-if="!isAvatarLoading(platform, profileId)"
            :src="avatarCache[`${platform}:${profileId}`]"
            :alt="profileId"
            :initials="profileId.substring(0, 2).toUpperCase()"
            :color="
              avatarCache[`${platform}:${profileId}`]
                ? undefined
                : `color-${(index % 5) + 1}`
            "
            size="md"
          />
        </ClientOnly>

        <div class="flex-1">
          <div class="flex items-center">
            <p class="text-gray-900 dark:text-white font-medium text-base">
              Post #{{ truncatePostId(postId) }}
            </p>
            <UBadge
              v-if="changed.rate"
              color="emerald"
              variant="subtle"
              size="xs"
              class="ml-1"
            >
              <UIcon
                v-if="formatRate(Number(changed.rate)) !== 'New'"
                :name="toTrendingIcon('positive')"
              />
              {{ formatRate(Number(changed.rate)) }}
            </UBadge>
          </div>
          <div
            class="flex items-center text-gray-500 dark:text-gray-400 text-sm mt-1"
          >
            <UIcon
              :name="PlatformIcon[platform]"
              class="mr-1 w-4 h-4"
            />
            {{ toUppercaseFirstLetter(platform) }}
            <span class="mx-2">•</span>
            <span class="flex items-center">
              <UIcon
                name="i-heroicons-arrow-trending-up"
                class="w-4 h-4 mr-1 text-emerald-500"
              />
              {{ changed.votesPositive }}
              <span class="mx-1">upvotes</span>
            </span>
            <span class="mx-2">•</span>
            <span class="flex items-center">
              <UIcon
                name="i-heroicons-arrow-trending-down"
                class="w-4 h-4 mr-1 text-rose-500"
              />
              {{ changed.votesNegative }}
              <span class="mx-1">downvotes</span>
            </span>
          </div>
        </div>

        <div class="text-right">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Ranking
          </p>
          <p class="text-gray-900 dark:text-white font-medium text-lg">
            {{ toMinifiedStatCount(Number(total.ranking)) }}
          </p>
          <div class="flex items-center justify-end">
            <p
              class="text-emerald-600 dark:text-emerald-400 font-medium text-sm"
            >
              +{{ toMinifiedStatCount(Number(changed.ranking)) }}
            </p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </UDashboardCard>
</template>
