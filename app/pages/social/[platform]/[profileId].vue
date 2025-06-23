<script setup lang="ts">
import type { ScriptChunkPlatformUTF8 } from 'rank-lib'
import { PlatformIcon, PlatformURL } from '~/utils/constants'
import { toPercentColor, truncateTxid, formatTimestamp, toUppercaseFirstLetter, toMinifiedPercent, toMinifiedStatCount, getTrendColor } from '~/utils/functions'

definePageMeta({
  layout: 'explorer'
})

/**
 * Functions
 */
// Get route params
const route = useRoute()
const platform = route.params.platform as ScriptChunkPlatformUTF8
const profileId = route.params.profileId as string

console.log(platform, profileId)

// Use API to fetch profile data
const { getAvatar } = useAvatars()
/**
 * Async data
 */
const { data: profileData } = await useAsyncData(
  `profileData-${platform}-${profileId}`,
  () => $fetch(`/api/social/${platform}/${profileId}`)
)
// Posts pagination
const postsPage = ref(1)
const postsRowsPerPage = ref(10)
const { data: postsData } = await useAsyncData(
  `postsData-${platform}-${profileId}`,
  () => $fetch(`/api/social/${platform}/${profileId}/posts`, {
    query: {
      page: postsPage.value,
      pageSize: postsRowsPerPage.value
    }
  }),
  {
    watch: [postsPage, postsRowsPerPage]
  }
)
// Vote history pagination
const historyPage = ref(1)
const historyRowsPerPage = ref(10)
const { data: rankData } = await useAsyncData(
  `rankData-${platform}-${profileId}`,
  () => $fetch(`/api/social/${platform}/${profileId}/votes`, {
    query: {
      page: historyPage.value,
      pageSize: historyRowsPerPage.value
    }
  }),
  {
    watch: [historyPage, historyRowsPerPage]
  }
)
// const { data: avatardata } = await useAsyncData('avatarData-${platform}-${profileId}', () => getAvatar(platform, profileId))

// console.log(profileData.value, rankData.value)
/**
 * Constants
 */
const postsTableColumns = [
  { key: 'id', label: 'Post ID' },
  { key: 'ranking', label: 'Total Ranking' },
  { key: 'satsPositive', label: 'Total Positive' },
  { key: 'satsNegative', label: 'Total Negative' }
]
const historyTableColumns = [
  { key: 'txid', label: 'Transaction ID' },
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'sentiment', label: 'Sentiment' },
  { key: 'burned', label: 'Burned' },
  { key: 'postId', label: 'Post ID' }
]
const platformFormatted = toUppercaseFirstLetter(platform)
const totalPossibleVotes = rankData.value.votes.length * rankData.value.numPages
const voteRatio = toMinifiedPercent(profileData.value.satsPositive.toString(), profileData.value.satsNegative.toString()) + '%'
const percentColor = toPercentColor(voteRatio)
/**
 * Vue refs
 */
const avatarSrc = shallowRef<string>()
// State
const error = shallowRef<string | undefined>()
const loading = shallowRef(true)
const isTableLoading = shallowRef(false)
// const totalPages = computed(() => {
//   return Math.ceil(rankData.value.numPages / pageSize.value)
// })

/**
 * Vue computed properties
 */
/** The formatted ranking of the profile */
const formattedRanking = computed(() => {
  if (!profileData.value || !profileData.value.ranking) return '0'
  const rankingNumber = parseInt(profileData.value.ranking, 10)
  return toMinifiedStatCount(rankingNumber)
})
/** The RankTransactions fetched from the API */
const paginatedRankTransactions = computed(() => {
  return rankData.value.votes.map((tx) => {
    // we can add more processing here later if needed
    // for now we just return the transaction
    return tx
  })
})
/** The external profile URL */
const profileUrl = computed(() => {
  return PlatformURL[platform].profile(profileId)
})
/**
 * Vue lifecycle hooks
 */
onMounted(async () => {
  try {
    const avatarData = await getAvatar(platform, profileId)
    avatarSrc.value = avatarData.src
  } catch (e) {
    error.value = 'Failed to load profile data'
  } finally {
    loading.value = false
  }
})

/**
 * SEO meta
 */
useSeoMeta({
  title: `${profileId} on ${platformFormatted}`,
  description: `View ${profileId}'s reputation on Lotusia Social`,
  ogTitle: `${profileId} on ${platformFormatted}`,
  ogDescription: `View ${profileId}'s reputation on Lotusia Social`,
  ogImage: avatarSrc.value,
  ogUrl: `https://lotusia.org/social/${platform}/${profileId}`
})
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <ExplorerNavbar title="Profile Details" />
      <ExplorerSearch />
      <UDashboardPanelContent>
        <!-- Profile Details -->
        <UDashboardSection
          orientation="vertical"
          :description="`Reputation information for ${platformFormatted} profile`"
          :actions="[]"
        >
          <template #icon>
            <UAvatar
              :src="`${avatarSrc}`"
              size="xl"
              :alt="`${profileId}'s avatar`"
            />
          </template>
          <template #title>
            <h2 class="text-2xl font-bold">
              <NuxtLink
                :to="profileUrl"
                target="_blank"
                external
                class="flex items-center underline"
              >
                {{ profileId }}
                <UIcon
                  :name="PlatformIcon[platform]"
                  class="ml-1"
                />
              </NuxtLink>
            </h2>
            <UBadge
              :color="percentColor"
              variant="soft"
              size="md"
            >
              {{ voteRatio }} Positive
            </UBadge>
          </template>

          <UPageGrid>
            <UDashboardCard
              :title="formattedRanking + ' XPI'"
              description="Ranking"
              icon="i-mdi-check-decagram-outline"
            />
            <UDashboardCard
              :title="profileData.votesPositive.toLocaleString()"
              description="Vote Ratio"
              icon="i-mdi-scale-balance"
            >
              <template #title>
                <span class="text-green-500 dark:text-green-400 font-medium">
                  {{ toMinifiedStatCount(profileData.satsPositive) }} XPI
                </span>
                <span class="mx-1">/</span>
                <span class="text-red-500 dark:text-red-400 font-medium">
                  {{ toMinifiedStatCount(profileData.satsNegative) }} XPI
                </span>
              </template>
            </UDashboardCard>
            <UDashboardCard
              :title="profileData.uniqueVoters.toLocaleString()"
              description="Unique Voters"
              icon="i-heroicons-user-group"
            />
          </UPageGrid>
        </UDashboardSection>

        <!-- Post History -->
        <UDashboardSection
          orientation="vertical"
          icon="i-mdi-post-outline"
        >
          <template #title>
            <h2 class="text-2xl font-bold">
              Post History
            </h2>
          </template>
          <template #description>
            <p class="text-md">
              Posts from this profile that have been ranked by the Lotusia ecosystem
            </p>
          </template>
          <ClientOnly>
            <UTable
              :rows="postsData.posts"
              :columns="postsTableColumns"
            >
              <template #id-data="{ row }">
                <NuxtLink
                  :key="`${profileId}-${row.id}`"
                  class="text-sky-500 dark:text-sky-400 hover:text-sky-600 dark:hover:text-sky-300"
                  :to="PlatformURL[platform].post(profileId, row.id)"
                  target="_blank"
                  external
                >
                  <div class="flex items-center">
                    {{ row.id }}
                    <UIcon
                      name="i-heroicons-arrow-up-right-20-solid"
                      class="ml-1 text-gray-500 dark:text-gray-400"
                    />
                  </div>
                </NuxtLink>
              </template>
              <template #ranking-data="{ row }">
                <span :class="getTrendColor(row.ranking)">
                  {{ toMinifiedStatCount(row.ranking) }} XPI
                </span>
              </template>
              <template #satsPositive-data="{ row }">
                <span class="text-green-500 dark:text-green-400">
                  {{ toMinifiedStatCount(row.satsPositive) }} XPI
                </span>
              </template>
              <template #satsNegative-data="{ row }">
                <span class="text-red-500 dark:text-red-400">
                  {{ toMinifiedStatCount(row.satsNegative) }} XPI
                </span>
              </template>
            </UTable>

            <div class="flex items-center justify-between px-3 py-3.5 border-t border-gray-200 dark:border-gray-700">
              <div class="hidden sm:flex items-center gap-2">
                <span class="text-sm text-gray-700 dark:text-gray-200">
                  Rows per page:
                </span>
                <USelect
                  v-model="postsRowsPerPage"
                  :disabled="isTableLoading"
                  :options="[10, 20, 30, 40]"
                  class="w-20"
                />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-700 dark:text-gray-200">
                  Page {{ postsPage }} of {{ postsData.numPages }}
                </span>
                <UPagination
                  v-model="postsPage"
                  :disabled="isTableLoading"
                  :total="postsData.numPages * postsRowsPerPage"
                  :page-count="postsRowsPerPage"
                />
              </div>
            </div>
          </ClientOnly>
        </UDashboardSection>

        <!-- Vote History -->
        <UDashboardSection
          orientation="vertical"
          icon="i-mdi-ballot-outline"
        >
          <template #title>
            <h2 class="text-2xl font-bold">
              Vote History
            </h2>
          </template>
          <template #description>
            <p class="text-md">
              Complete voting history for this profile
            </p>
          </template>
          <ClientOnly>
            <UTable
              :rows="paginatedRankTransactions"
              :columns="historyTableColumns"
            >
              <template #txid-data="{ row }">
                <NuxtLink
                  class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300"
                  :to="`/explorer/tx/${row.txid}`"
                >
                  {{ truncateTxid(row.txid) }}
                </NuxtLink>
              </template>
              <template #timestamp-data="{ row }">
                {{ formatTimestamp(row.timestamp) }}
              </template>
              <template #burned-data="{ row }">
                <ExplorerAmountXPI :sats="row.sats" />
              </template>
              <template #sentiment-data="{ row }">
                <span
                  v-if="row.sentiment === 'positive'"
                  class="text-green-500 dark:text-green-400"
                >
                  {{ toUppercaseFirstLetter(row.sentiment) }}
                </span>
                <span
                  v-else-if="row.sentiment === 'negative'"
                  class="text-red-500 dark:text-red-400"
                >
                  {{ toUppercaseFirstLetter(row.sentiment) }}
                </span>
              </template>
              <template #postId-data="{ row }">
                <NuxtLink
                  class="text-sky-500 dark:text-sky-400 hover:text-sky-600 dark:hover:text-sky-300"
                  :to="PlatformURL[platform].post(profileId, row.post.id)"
                  target="_blank"
                  external
                >
                  <div class="flex items-center">
                    {{ row.post.id }}
                    <UIcon
                      name="i-heroicons-arrow-up-right-20-solid"
                      class="ml-1 text-gray-500 dark:text-gray-400"
                    />
                  </div>
                </NuxtLink>
              </template>
            </UTable>

            <div class="flex items-center justify-between px-3 py-3.5 border-t border-gray-200 dark:border-gray-700">
              <div class="hidden sm:flex items-center gap-2">
                <span class="text-sm text-gray-700 dark:text-gray-200">
                  Rows per page:
                </span>
                <USelect
                  v-model="historyRowsPerPage"
                  :disabled="isTableLoading"
                  :options="[10, 20, 30, 40]"
                  class="w-20"
                />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-700 dark:text-gray-200">
                  Page {{ historyPage }} of {{ rankData.numPages }}
                </span>
                <UPagination
                  v-model="historyPage"
                  :disabled="isTableLoading"
                  :total="totalPossibleVotes"
                  :page-count="historyRowsPerPage"
                />
              </div>
            </div>
          </ClientOnly>
        </UDashboardSection>
      </UDashboardPanelContent>
    </UDashboardPanel>
  </UDashboardPage>
</template>
