<script setup lang="ts">
import { formatTimestamp, truncateTxid, toMinifiedNumber } from '~/utils/functions'

definePageMeta({
  layout: 'explorer',
  title: 'Address Details',
  description: 'Detailed information about address',
  keywords: ['explorer', 'blockchain', 'lotus', 'address'],
  ogTitle: 'Address Explorer',
  ogDescription: 'Detailed information about address'
})

/**
 * Functions
 */
const route = useRoute()
const address = route.params.address as string

// Table pagination state
const page = shallowRef(1)
const rowsPerPage = shallowRef(10)
const { data } = await useAsyncData(
  `address-${address}`,
  () => $fetch(`/api/explorer/address/${address}`, {
    query: {
      page: page.value,
      pageSize: rowsPerPage.value
    }
  }),
  {
    watch: [page, rowsPerPage]
  }
)

/**
 * Constants
 */
/** The columns of the transaction history table */
const txHistoryTableColumns = [
  { key: 'txid', label: 'Transaction ID' },
  { key: 'firstSeen', label: 'First Seen' },
  { key: 'burned', label: 'Burned' },
  { key: 'inputs', label: 'Inputs' },
  { key: 'outputs', label: 'Outputs' },
  { key: 'size', label: 'Size' }
]
/** The number of transactions in the address history (not computed) */
const totalPossibleTransactions = data.value.history.txs.length * data.value.history.numPages
/** Use last-seen of first async data set, as this will be the most recent */
const lastSeen = data.value.lastSeen
/** The balance of the address */
const balance = data.value.balance
/**
 * Vue refs
 */
/** Whether the table page is loading */
const isLoading = shallowRef(false)
/**
 * Vue computed properties
 */
const paginatedTxs = computed(() => {
  // we don't need to slice the array since the data is already paginated
  // but we do want to process the data for the table
  return data.value.history.txs.map((tx) => {
    return {
      ...tx,
      firstSeen: Number(tx.timeFirstSeen) ? tx.timeFirstSeen : tx.block?.timestamp
    }
  })
})
/**
 * SEO meta
 */
const title = shallowRef(`Address ${address}`)
useSeoMeta({
  title,
  description: `Detailed information about address ${address}`,
  ogTitle: title,
  ogDescription: `Detailed information about address ${address}`
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
          icon="i-mdi-wallet-outline"
          :actions="[]"
        >
          <template #title>
            <h2 class="text-2xl font-bold">
              Address Details
            </h2>
            <UBadge
              color="pink"
              variant="subtle"
              size="md"
              :label="address"
            />
          </template>
          <template #description>
            Detailed information about address
          </template>

          <UPageGrid>
            <UDashboardCard
              description="Balance"
              icon="i-fluent-emoji-high-contrast-lotus"
            >
              <template #title>
                <ExplorerAmountXPI :sats="balance" />
              </template>
            </UDashboardCard>
            <UDashboardCard
              v-if="lastSeen"
              :title="formatTimestamp(lastSeen)"
              description="Last Seen"
              icon="i-mdi-clock-outline"
            />
            <!--
            TODO: Add this back in when we have a way to calculate the total burned sats for an address
            <UDashboardCard
              description="Burned by this address"
              icon="i-mdi-fire"
            >
              <template #title>
                <ExplorerAmountXPI :sats="data.numBurnedSats" />
              </template>
            </UDashboardCard>
            -->
            <!--
            <UDashboardCard
              :title="`${totalPossibleTransactions.toLocaleString()}`"
              description="Number of Transactions"
              icon="i-mdi-swap-horizontal"
            />
             -->
          </UPageGrid>

          <UDashboardSection
            orientation="vertical"
            icon="i-mdi-swap-horizontal"
          >
            <template #title>
              <h2 class="text-2xl font-bold">
                Transaction History
              </h2>
            </template>
            <template #description>
              <p class="text-md">
                List of transactions for this address
              </p>
            </template>

            <UTable
              :rows="paginatedTxs"
              :columns="txHistoryTableColumns"
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
                  <UBadge
                    v-if="!row.block"
                    color="yellow"
                    variant="subtle"
                    size="xs"
                    label="Pending"
                  />
                </NuxtLink>
              </template>
              <template #firstSeen-data="{ row }">
                {{ formatTimestamp(row.firstSeen) }}
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
                  :disabled="isLoading"
                  :options="[10, 20, 30, 40]"
                  class="w-20"
                />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-700 dark:text-gray-200">
                  Page {{ page }} of {{ data.history.numPages }}
                </span>
                <UPagination
                  v-model="page"
                  :disabled="isLoading"
                  :total="totalPossibleTransactions"
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
