<script setup lang="ts">
import type { Tx } from 'chronik-client'
import type { ShallowRef } from 'vue'

/** The columns of the transaction history table */
const tableColumns = [
  { key: 'txid', label: 'Transaction ID' },
  { key: 'firstSeen', label: 'First Seen' },
  { key: 'burned', label: 'Burned' },
  { key: 'inputs', label: 'Inputs' },
  { key: 'outputs', label: 'Outputs' },
  { key: 'size', label: 'Size' }
]

defineProps<{
  tableType: 'block' | 'address'
  page: number
  rowsPerPage: number
  isLoading: boolean
  numTransactions: number
  paginationStart: number
  paginationEnd: number
  txs: Tx[]
}>()
</script>

<template>
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
      List of transactions {{ tableType === 'address' ? 'for this address' : 'in this block' }}
    </template>

    <UTable
      :rows="txs"
      :columns="tableColumns"
    >
      <template #txid-data="{ row }">
        <NuxtLink
          :to="`/explorer/tx/${row.txid}`"
          class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300"
        >
          {{ truncateSha256(row.txid) }}
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
        {{ formatTimestamp(row.timeFirstSeen) }}
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
          Showing {{ paginationStart }} to {{ paginationEnd }} of {{ numTransactions }} results
        </span>
        <UPagination
          v-model="page"
          :disabled="isLoading"
          :total="Number(numTransactions)"
          :page-count="rowsPerPage"
        />
      </div>
    </div>
  </UDashboardSection>
</template>

<style scoped></style>
