<script setup lang="ts">
import {
  formatRate,
  toMinifiedStatCount,
  toTrendingIcon,
  // toProfileUrl,
  toUppercaseFirstLetter
} from '~/utils/functions'
import { PlatformIcon } from '~/utils/constants'
import { useRankApi } from '~/composables/useRankApi'
import { useAvatars } from '~/composables/useAvatars'

defineExpose({
  id: 'lowest-profiles'
})

const { getLowestRankedProfiles } = useRankApi()
const profiles = await getLowestRankedProfiles('today')
const { avatarCache, isAvatarLoading, preloadAvatars } = useAvatars()

// Preload avatars for all profiles
if (profiles.length > 0) {
  await preloadAvatars(
    profiles.map(profile => ({
      platform: profile.platform,
      profileId: profile.profileId
    }))
  )
}
</script>

<template>
  <UDashboardCard class="relative">
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon
          name="i-heroicons-user-circle"
          class="text-rose-500 dark:text-rose-400 w-6 h-6"
        />
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Declining Profiles
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Profiles showing the steepest drop in ranking today.
          </p>
        </div>
      </div>
    </template>
    <div class="space-y-3">
      <NuxtLink
        v-for="({ platform, profileId, changed, total }, index) in profiles"
        :key="index"
        :to="`/social/${platform}/${profileId}`"
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
          <UAvatar
            v-else
            :initials="profileId.substring(0, 2).toUpperCase()"
            :color="`color-${(index % 5) + 1}`"
            size="md"
          />
        </ClientOnly>

        <div class="flex-1">
          <div class="flex items-center">
            <p class="text-gray-900 dark:text-white font-medium text-base">
              {{ profileId }}
            </p>
            <UBadge
              v-if="changed.rate"
              color="rose"
              variant="subtle"
              size="xs"
              class="ml-1"
            >
              <UIcon
                v-if="formatRate(Number(changed.rate)) !== 'New'"
                :name="toTrendingIcon('negative')"
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
            <p class="text-rose-600 dark:text-rose-400 font-medium text-sm">
              {{ toMinifiedStatCount(Number(changed.ranking)) }}
            </p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </UDashboardCard>
</template>
