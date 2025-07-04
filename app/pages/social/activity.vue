<script setup lang="ts">
import { PlatformURL } from '~/utils/constants'
import { formatTimestamp, toMinifiedStatCount, truncateTxid } from '~/utils/functions'

definePageMeta({
  layout: 'explorer',
  title: 'Latest Activity',
  description: 'Latest voter activity for all profiles across all platforms',
  icon: 'i-mdi-chart-line'
})
/** The current page of the table */
const page = shallowRef(1)
/** The number of rows per page of the table */
const rowsPerPage = shallowRef(10)
const { data } = await useAsyncData(
  'voteActivity',
  () => $fetch(`/api/social/activity`, {
    query: {
      page: page.value,
      pageSize: rowsPerPage.value
    }
  }),
  {
    watch: [page, rowsPerPage]
  }
)

const refreshVoteActivity = async () => {
  const response = await $fetch(`/api/social/activity`, {
    query: {
      page: page.value,
      pageSize: rowsPerPage.value
    }
  })
  data.value = response
}

/**
 * Constants
 */
const voteActivityTableColumns = [
  { key: 'txid', label: 'Transaction ID' },
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'profileId', label: 'Profile' },
  { key: 'vote', label: 'Vote' },
  { key: 'postId', label: 'Post ID' }
]

/**
 * Vue refs
 */
/** The interval to refresh the vote activity */
const refreshInterval = ref<NodeJS.Timeout | null>(null)
/** Whether the table is loading data */
const isLoading = shallowRef(false)

/**
 * Vue computed properties
 */
const votes = computed(() => data.value.votes)
const numPages = computed(() => data.value.numPages)
/**
 * Vue lifecycle hooks
 */
onBeforeUnmount(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
onBeforeMount(() => {
  refreshInterval.value = setInterval(refreshVoteActivity, 5_000)
})

/**
 * SEO meta
 */
useSeoMeta({
  title: 'Latest Activity',
  description: 'Latest voter activity for all profiles across all platforms',
  ogTitle: 'Latest Activity',
  ogDescription: 'Latest voter activity for all profiles across all platforms',
  ogImage: 'https://lotusia.com/og-image.png',
  ogUrl: 'https://lotusia.org/social/activity'
})
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <ExplorerNavbar
        :title="$route.meta.title"
        :actions="[]"
      />
      <ExplorerSearch />
      <UDashboardPanelContent>
        <UDashboardSection
          orientation="vertical"
          icon="i-mdi-chart-line"
        >
          <template #title>
            <h2 class="text-2xl font-bold">
              Vote Activity
            </h2>
          </template>
          <template #description>
            <p class="text-md">
              Vote activity for all profiles across all platforms
            </p>
            <p class="text-md">
              This information is refreshed every 5 seconds
            </p>
          </template>
        </UDashboardSection>

        <UTable
          :rows="votes"
          :columns="voteActivityTableColumns"
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
            {{ formatTimestamp(Number(row.firstSeen) > 0 ? row.firstSeen : row.timestamp) }}
          </template>
          <template #profileId-data="{ row }">
            <SocialProfileLink
              :key="`${row.profileId}-${row.postId}-${row.txid}`"
              :platform="row.platform"
              :profile-id="row.profileId"
            />
          </template>
          <template #vote-data="{ row }">
            <span
              v-if="row.sentiment === 'positive'"
              class="text-green-500 dark:text-green-400 flex items-center"
            >
              <UIcon
                name="i-heroicons-arrow-up-20-solid"
                class="mr-1"
              />
              {{ toMinifiedStatCount(row.sats) }} XPI
            </span>
            <span
              v-else-if="row.sentiment === 'negative'"
              class="text-red-500 dark:text-red-400 flex items-center"
            >
              <UIcon
                name="i-heroicons-arrow-down-20-solid"
                class="mr-1"
              />
              {{ toMinifiedStatCount(row.sats) }} XPI
            </span>
            <span
              v-else-if="row.sentiment === 'neutral'"
              class="text-gray-500 dark:text-gray-400 flex items-center"
            >
              <UIcon
                name="i-heroicons-minus-circle"
                class="mr-1"
              />
              {{ toMinifiedStatCount(row.sats) }} XPI
            </span>
          </template>
          <template #postId-data="{ row }">
            <NuxtLink
              class="text-sky-500 dark:text-sky-400 hover:text-sky-600 dark:hover:text-sky-300"
              :to="PlatformURL[row.platform].post(row.profileId, row.postId)"
              target="_blank"
              external
            >
              <div class="flex items-center">
                {{ row.postId }}
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
              v-model="rowsPerPage"
              :disabled="isLoading"
              :options="[10, 20, 30, 40]"
              class="w-20"
            />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-700 dark:text-gray-200">
              Page {{ page }} of {{ numPages }}
            </span>
            <UPagination
              v-model="page"
              :disabled="isLoading"
              :ui="{ size: 'xs', activeButton: { color: 'blue' } }"
              :total="numPages * rowsPerPage"
              :page-count="rowsPerPage"
            />
          </div>
        </div>
      </UDashboardPanelContent>
    </UDashboardPanel>
  </UDashboardPage>
</template>
