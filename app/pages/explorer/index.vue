<script setup lang="ts">
import { Lotusia } from '~/utils/types'

definePageMeta({
  layout: 'explorer',
  title: 'Overview',
  description: 'Explore the Lotusia blockchain and ecosystem',
  keywords: ['explorer', 'blockchain', 'lotus'],
  ogTitle: 'Explorer',
  ogDescription: 'Explore the Lotusia blockchain and ecosystem'
})

useSeoMeta({
  title: 'Overview',
  description: 'Explore the Lotusia blockchain and ecosystem',
  ogTitle: 'Overview | Lotusia Explorer',
  ogDescription: 'Explore the Lotusia blockchain and ecosystem'
})

/**
 * Functions
 */
/** Primary function to refresh the network overview */
const refreshNetworkOverview = async () => {
  // set reactive values after all the data is fetched
  const overview = await $fetch('/api/explorer/overview')
  const block = await $fetch(`/api/explorer/block/${overview.mininginfo.blocks}`)
  networkOverview.value = overview
  blockchainTip.value = block
}
/**
 * Async data
 */
const { data: networkOverview } = await useAsyncData(
  'networkOverview',
  async () => $fetch('/api/explorer/overview')
)
const { data: blockchainTip } = await useAsyncData(
  'blockchainTip',
  async () => $fetch(`/api/explorer/block/${networkOverview.value.mininginfo.blocks}`)
)
/**
 * Constants
 */
const networkName = Lotusia.Network.NameMap[networkOverview.value.mininginfo.chain]
const peerinfoTableColumns = [
  { key: 'country', label: 'Country' },
  { key: 'addr', label: 'Address' },
  { key: 'subver', label: 'Version' },
  { key: 'blocks', label: 'Blocks' }
]
/**
 * Vue refs
 */
const refreshInterval = ref<NodeJS.Timeout | null>(null)
/**
 * Vue computed properties
 */
/** The average block time (previous 6 blocks) */
const averageBlockTime = computed(() => {
  const latestBlockTime = Number(blockchainTip.value.blockInfo.timestamp)
  const medianBlockTime = Number(blockchainTip.value.blockDetails.medianTimestamp)
  return toMinifiedTime((latestBlockTime - medianBlockTime) / 6)
})
const networkPendingTransactions = computed(() =>
  networkOverview.value.mininginfo.pooledtx.toLocaleString()
)
const networkHashrate = computed(() =>
  toMinifiedNumber('hashrate', networkOverview.value.mininginfo.networkhashps || 0)
)
const networkBlockCount = computed(() =>
  networkOverview.value.mininginfo.blocks.toLocaleString()
)
const networkDifficulty = computed(() =>
  Number(networkOverview.value.mininginfo.difficulty).toFixed(1)
)
/**
 * Vue lifecycle hooks
 */
onBeforeUnmount(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
onMounted(async () => {
  refreshInterval.value = setInterval(refreshNetworkOverview, 5_000)
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
          icon="i-mdi-earth"
          :actions="[]"
        >
          <template #title>
            <h2 class="text-2xl font-bold">
              Network
            </h2>
            <UBadge
              color="green"
              variant="subtle"
              size="sm"
              :label="networkName"
            />
          </template>
          <template #description>
            <p class="text-md">
              Up-to-date information about the Lotusia blockchain network
            </p>
            <p class="text-md">
              This information is refreshed every 5 seconds.
            </p>
          </template>
          <UAlert
            v-if="networkOverview.mininginfo.warnings"
            title="ATTENTION: Network warning"
            :description="networkOverview.mininginfo.warnings"
            variant="outline"
            color="orange"
            icon="i-mdi-alert-circle-outline"
          />
          <UPageGrid>
            <UDashboardCard
              :title="`${networkOverview.peerinfo.length} Connections`"
              description="Number of Lotus nodes connected to the Explorer"
              icon="i-mdi-ip-network-outline"
            />
            <UDashboardCard
              :title="`${networkBlockCount} Blocks`"
              description="Total number of blocks in the blockchain"
              icon="i-mdi-cube-outline"
            />
            <UDashboardCard
              :title="`${networkPendingTransactions} Pending Transactions`"
              description="Number of transactions waiting to be confirmed"
              icon="i-mdi-transit-connection-variant"
            />
            <UDashboardCard
              :title="`~${networkHashrate}/s Hashrate`"
              description="Approximately how many hashes are being computed per second"
              icon="i-mdi-lightning-bolt-outline"
            />
            <UDashboardCard
              :title="`~${networkDifficulty} Difficulty`"
              description="Difficulty of the most recent block (i.e. mining difficulty)"
              icon="i-mdi-weight-lifter"
            />
            <UDashboardCard
              :title="`~${averageBlockTime} Avg. Block Time`"
              description="Calculated from the last 6 blocks"
              icon="i-mdi-clock-outline"
            />
          </UPageGrid>
        </UDashboardSection>
        <UDashboardSection>
          <template #title>
            <h2 class="text-2xl font-bold">
              Peer Info
            </h2>
          </template>
          <template #description>
            <p class="text-md">
              List of Lotus nodes connected to the Explorer
            </p>
          </template>
          <UTable
            :rows="networkOverview.peerinfo"
            :columns="peerinfoTableColumns"
          >
            <template #country-data="{ row }">
              <UIcon
                :name="`i-flag-${row.geoip.country.toLowerCase()}-4x3`"
                class="w-4 h-4"
              />
            </template>
            <template #addr-data="{ row }">
              <span class="font-semibold">{{ row.addr }}</span>
            </template>
            <template #subver-data="{ row }">
              <span class="font-mono">{{ row.subver }}</span>
            </template>
            <template #blocks-data="{ row }">
              <span class="font-semibold">{{ row.synced_blocks.toLocaleString() }}</span>
            </template>
          </UTable>
        </UDashboardSection>
      </UDashboardPanelContent>
    </UdashboardPanel>
  </UDashboardPage>
</template>

<style scoped></style>
