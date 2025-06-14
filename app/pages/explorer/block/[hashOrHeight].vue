<script setup lang="ts">
import {
  formatTimestamp,
  truncateAddress,
  truncateBlockHash,
  truncateTxid,
  toMinifiedNumber
} from '~/utils/functions'

definePageMeta({
  layout: 'explorer',
  title: 'Block Details',
  description: 'Detailed information about block',
  keywords: ['explorer', 'blockchain', 'lotus'],
  ogTitle: 'Block Explorer',
  ogDescription: 'Detailed information about block'
})

const route = useRoute()
const hashOrHeight = route.params.hashOrHeight as string | number

const { data: block } = await useAsyncData(`block-${hashOrHeight}`, () => $fetch(`/api/explorer/block/${hashOrHeight}`))

// Table pagination state
const page = shallowRef(1)
const rowsPerPage = shallowRef(10)
/**
 * Constants
 */
const numTransactions = block.value?.txs?.length ?? 0
const blockHeight = block.value.blockInfo.height
const blockHash = block.value.blockInfo.hash
const blockTimestamp = formatTimestamp(block.value?.blockInfo?.timestamp ?? 0)
const blockSize = toMinifiedNumber('blocksize', block.value.blockInfo.blockSize)
const blockSubsidy = block.value.blockInfo.sumCoinbaseOutputSats ?? '0'
const burnedSats = block.value.blockInfo.sumBurnedSats ?? '0'
const minedBy = block.value.minedBy
/** The columns of the block transaction table */
const blockTxTableColumns = [
  { key: 'txid', label: 'Transaction ID' },
  { key: 'firstSeen', label: 'First Seen' },
  { key: 'burned', label: 'Burned' },
  { key: 'inputs', label: 'Inputs' },
  { key: 'outputs', label: 'Outputs' },
  { key: 'size', label: 'Size' }
]
/**
 * Vue computed properties
 */
/** The height of the block */
const formattedBlockHeight = computed(() => blockHeight.toLocaleString())

/**
 * Pagination display computed properties
 */
/** The paginated transactions */
const paginatedTxs = computed(() => {
  const start = (page.value - 1) * rowsPerPage.value
  const end = start + rowsPerPage.value
  return block.value.txs.slice(start, end)
})
/** The start of the pagination */
const paginationStart = computed(() => ((page.value - 1) * rowsPerPage.value + 1))
/** The end of the pagination */
const paginationEnd = computed(() => Math.min(page.value * rowsPerPage.value, numTransactions))
/**
 * SEO meta
 */
const title = shallowRef(`Block ${blockHash}`)
useSeoMeta({
  title,
  description: `Detailed information about block ${blockHash}`,
  ogTitle: title,
  ogDescription: `Detailed information about block ${blockHash}`
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
          :actions="[]"
        >
          <template #title>
            <h2 class="text-2xl font-bold flex items-center">
              Block Details
              <UBadge
                class="ml-1"
                color="blue"
                variant="subtle"
                size="xs"
                :label="`#${formattedBlockHeight}`"
              />
            </h2>
            <UBadge
              color="blue"
              variant="subtle"
              size="md"
              :label="truncateBlockHash(blockHash)"
            />
          </template>
          <template #description>
            Detailed information about block
          </template>

          <UPageGrid>
            <UDashboardCard
              :title="blockTimestamp"
              description="Timestamp"
              icon="i-mdi-clock-outline"
            />
            <UDashboardCard
              description="Block Subsidy"
              icon="i-mdi-flower-tulip-outline"
            >
              <template #title>
                <ExplorerAmountXPI :sats="blockSubsidy" />
              </template>
            </UDashboardCard>
            <UDashboardCard
              v-if="minedBy"
              description="Mined By"
              icon="i-mdi-pickaxe"
            >
              <template #title>
                <NuxtLink
                  :to="`/explorer/address/${minedBy}`"
                  class="text-pink-500 dark:text-pink-400 hover:text-pink-600 dark:hover:text-pink-300"
                >
                  {{ truncateAddress(minedBy) }}
                </NuxtLink>
              </template>
            </UDashboardCard>
            <UDashboardCard
              :title="blockSize"
              description="Block Size"
              icon="i-mdi-weight"
            />
            <UDashboardCard
              :title="numTransactions.toString()"
              description="Number of Transactions"
              icon="i-mdi-swap-horizontal"
            />
            <UDashboardCard
              description="Burned"
              icon="i-mdi-fire"
            >
              <template #title>
                <ExplorerAmountXPI :sats="burnedSats" />
              </template>
            </UDashboardCard>
          </UPageGrid>

          <UDashboardSection
            orientation="vertical"
            icon="i-mdi-swap-horizontal"
          >
            <template #title>
              <h2 class="text-2xl font-bold">
                Transactions
              </h2>
            </template>
            <template #description>
              <p class="text-md">
                List of transactions in this block
              </p>
            </template>

            <UTable
              :rows="paginatedTxs"
              :columns="blockTxTableColumns"
            >
              <template #txid-data="{ row }">
                <NuxtLink
                  :to="`/explorer/tx/${row.txid}`"
                  class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300"
                >
                  {{ truncateTxid(row.txid) }}
                  <template v-if="row.isCoinbase">
                    <UBadge
                      color="green"
                      variant="subtle"
                      size="xs"
                      label="Coinbase"
                    />
                  </template>
                </NuxtLink>
              </template>
              <template #firstSeen-data="{ row }">
                {{ formatTimestamp(row.timeFirstSeen || block.blockInfo.timestamp) }}
              </template>
              <template #burned-data="{ row }">
                <ExplorerAmountXPI :sats="row.sumBurnedSats" />
              </template>
              <template #inputs-data="{ row }">
                {{ row.inputs.length }}
              </template>
              <template #outputs-data="{ row }">
                {{ row.outputs.length }}
              </template>
              <template #size-data="{ row }">
                {{ toMinifiedNumber('blocksize', row.size) }}
              </template>
            </UTable>

            <div class="flex items-center justify-between px-3 py-3.5 border-t border-gray-200 dark:border-gray-700">
              <div class="hidden sm:flex items-center gap-2">
                <span class="text-sm text-gray-700 dark:text-gray-200">
                  Rows per page:
                </span>
                <USelect
                  v-model="rowsPerPage"
                  :options="[10, 20, 30, 40]"
                  class="w-20"
                />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-700 dark:text-gray-200">
                  Showing {{ paginationStart }} to {{ paginationEnd }} of {{ numTransactions }} results
                </span>
                <UPagination
                  v-model="page"
                  :total="Number(numTransactions)"
                  :page-count="rowsPerPage"
                />
              </div>
            </div>
          </UDashboardSection>
        </UDashboardSection>
      </UDashboardPanelContent>
    </UDashboardPanel>
  </UDashboardPage>
</template>

<style scoped></style>
