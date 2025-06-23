<script setup lang="ts">
import { truncateBlockHash } from '~/utils/functions'

definePageMeta({
  layout: 'explorer',
  title: 'Blocks',
  description: 'Latest blocks in the blockchain',
  icon: 'i-mdi-blockchain'
})

/** The current page of the table */
const page = shallowRef(1)
/** The number of rows per page of the table */
const rowsPerPage = shallowRef(10)
/** The latest blocks in the blockchain */
// const { data: blockchainInfo } = await useAsyncData('blockchainInfo', () => $fetch('/api/explorer/chain-info'))
const { data } = await useAsyncData(
  'networkLatestBlocks',
  () => $fetch(`/api/explorer/blocks`, {
    query: {
      page: page.value,
      pageSize: rowsPerPage.value
    }
  }),
  {
    watch: [page, rowsPerPage]
  }
)

/** Primary function to refresh the table with the latest blocks */
const refreshNetworkLatestBlocks = async () => {
  const response = await $fetch(`/api/explorer/blocks`, {
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
/** The columns of the latest blocks table */
const networkLatestBlocksTableColumns = [
  { key: 'height', label: 'Height' },
  { key: 'hash', label: 'Hash' },
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'burned', label: 'Burned' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'size', label: 'Size' }
]
/**
 * Vue refs
 */
/** The interval to refresh the network latest blocks */
const refreshInterval = ref<NodeJS.Timeout | null>(null)
/** Whether the table is refreshing the block range */
const isLoading = shallowRef(false)
/**
 * Vue computed properties
 */
/** The paginated blocks */
const paginatedBlocks = computed(() => {
  return data.value.blocks.map((block) => {
    return {
      height: block.height,
      hash: block.hash,
      timestamp: formatTimestamp(block.timestamp),
      burned: block.sumBurnedSats,
      transactions: block.numTxs,
      size: toMinifiedNumber('blocksize', block.blockSize)
    }
  })
})
/** The start of the pagination */
const paginationStart = computed(() => ((page.value - 1) * rowsPerPage.value + 1))
/** The end of the pagination */
const paginationEnd = computed(() => Math.min(page.value * rowsPerPage.value, data.value.tipHeight))
/**
 * Vue lifecycle hooks
 */
onBeforeUnmount(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
onBeforeMount(() => {
  refreshInterval.value = setInterval(refreshNetworkLatestBlocks, 5_000)
})
/**
 * SEO meta
 */
useSeoMeta({
  title: 'Blocks',
  description: 'Latest blocks in the blockchain',
  ogTitle: 'Blocks',
  ogDescription: 'Latest blocks in the blockchain',
  ogImage: 'https://lotusia.com/og-image.png',
  ogUrl: 'https://lotusia.org/explorer/blocks'
})
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <ExplorerNavbar :title="$route.meta.title" />
      <ExplorerSearch />
      <UDashboardPanelContent>
        <UDashboardSection
          orientation="vertical"
          icon="i-mdi-cube-outline"
        >
          <template #title>
            <h2 class="text-2xl font-bold">
              Blocks
            </h2>
          </template>
          <template #description>
            <p class="text-md">
              Latest blocks in the blockchain
            </p>
            <p class="text-md">
              This information is refreshed every 5 seconds.
            </p>
          </template>

          <UTable
            :rows="paginatedBlocks"
            :columns="networkLatestBlocksTableColumns"
          >
            <template #height-data="{ row }">
              {{ row.height.toLocaleString() }}
            </template>
            <template #hash-data="{ row }">
              <NuxtLink
                :to="`/explorer/block/${row.hash}`"
                class="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
              >
                {{ truncateBlockHash(row.hash) }}
              </NuxtLink>
            </template>
            <template #burned-data="{ row }">
              <ExplorerAmountXPI :sats="row.burned" />
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
                Showing {{ paginationStart }} to {{ paginationEnd }} of {{ data.tipHeight.toLocaleString() }} results
              </span>
              <UPagination
                v-model="page"
                :disabled="isLoading"
                :ui="{ size: 'xs', activeButton: { color: 'blue' } }"
                :total="data.tipHeight"
                :page-count="rowsPerPage"
              />
            </div>
          </div>
        </UDashboardSection>
      </UDashboardPanelContent>
    </UdashboardPanel>
  </UDashboardPage>
</template>
