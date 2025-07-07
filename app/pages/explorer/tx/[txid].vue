<script setup lang="ts">
import { formatTimestamp, truncateTxid, truncateBlockHash, truncateAddress, toUppercaseFirstLetter, getSentimentColor } from '~/utils/functions'

definePageMeta({
  layout: 'explorer',
  title: 'Transaction Details',
  description: 'Explore the blockchain',
  keywords: ['explorer', 'blockchain', 'lotus'],
  ogTitle: 'Transaction Explorer',
  ogDescription: 'Explore Lotus transactions'
})

const route = useRoute()
const txid = route.params.txid as string
/**
 * Async data
 */
const { data: tx } = await useAsyncData(`tx-${txid}`, () => $fetch(`/api/explorer/tx/${txid}`))

/**
 * Constants
 */
const txSize = toMinifiedNumber('blocksize', tx.value?.size ?? 0)
const numInputs = tx.value.inputs.length
const numOutputs = tx.value.outputs.length
const txBlockHash = tx.value.block?.hash ?? null
const txBlockTimestamp = tx.value.block?.timestamp
// const txBlockConfirmations = tx.value.block?.height ? (blockchainInfo.value.tipHeight - tx.value.block.height) + 1 : null
const txFirstSeen = formatTimestamp(tx.value.timeFirstSeen)
let txType: string = 'Regular'
if (tx.value.isCoinbase) {
  txType = 'Coinbase'
}
if (tx.value.outputs.some(output => output.rankOutput)) {
  txType = 'RANK'
}
/**
 * SEO meta
 */
useSeoMeta({
  title: `Transaction ${txid}`,
  description: `Detailed information about transaction ${txid}`,
  ogTitle: `Transaction ${txid}`,
  ogDescription: `Detailed information about transaction ${txid}`
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
          icon="i-mdi-swap-horizontal"
          :actions="[]"
        >
          <template #title>
            <h2 class="text-2xl font-bold">
              Transaction Details
            </h2>
            <div class="flex items-center">
              <UBadge
                color="primary"
                variant="subtle"
                size="md"
              >
                {{ truncateTxid(txid) }}
              </UBadge>
              <UBadge
                class="ml-1"
                :color="tx.confirmations > 0 ? 'green' : 'yellow'"
                variant="subtle"
                size="md"
                :label="tx.confirmations > 0 ? 'Confirmed' : 'Pending'"
              />
            </div>
          </template>
          <template #description>
            Detailed information about transaction
          </template>

          <UPageGrid>
            <UDashboardCard
              :title="txFirstSeen"
              description="Time first seen by the Explorer"
              icon="i-mdi-eye-outline"
            />
            <UDashboardCard
              :title="txSize"
              description="Size"
              icon="i-mdi-weight"
            />
            <UDashboardCard
              :title="txType"
              description="Type"
              icon="i-mdi-swap-horizontal"
            />
          </UPageGrid>

          <UDashboardSection
            v-if="tx.block"
            orientation="vertical"
            icon="i-mdi-cube-outline"
          >
            <template #title>
              <h2 class="text-2xl font-bold">
                Block Information
              </h2>
            </template>
            <template #description>
              Block containing this transaction
            </template>

            <UPageGrid>
              <UDashboardCard
                :title="formatTimestamp(txBlockTimestamp)"
                description="Transaction Confirmed"
                icon="i-mdi-clock-outline"
              />
              <UDashboardCard
                :title="tx.confirmations.toLocaleString()"
                description="Confirmations"
                icon="i-mdi-lock-outline"
              />
              <UDashboardCard
                description="Confirmed in Block"
                icon="i-heroicons-hashtag"
              >
                <template #title>
                  <NuxtLink
                    class="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                    :to="`/explorer/block/${txBlockHash}`"
                  >
                    {{ truncateBlockHash(txBlockHash) }}
                  </NuxtLink>
                </template>
              </UDashboardCard>
            </UPageGrid>
          </UDashboardSection>

          <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Inputs Section -->
            <UDashboardSection
              orientation="vertical"
              icon="i-mdi-arrow-up"
            >
              <template #title>
                <h2 class="text-2xl font-bold flex items-center">
                  Inputs
                  <UBadge
                    color="pink"
                    variant="subtle"
                    size="xs"
                    :label="`${numInputs} inputs`"
                    class="ml-1"
                  />
                </h2>
              </template>

              <template #description>
                Where the Lotus in this transaction is coming from
              </template>

              <div class="space-y-4">
                <div
                  v-for="(input, index) in tx.inputs"
                  :key="input.prevOut.txid"
                  class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div
                    class="flex justify-between items-start mb-2 text-md font-semibold text-gray-600 dark:text-gray-300"
                  >
                    <span class="text-sm">
                      Input #{{ index + 1 }}
                    </span>
                    <!-- Special case for coinbase -->
                    <template v-if="tx.isCoinbase">
                      <UBadge
                        color="green"
                        variant="subtle"
                        size="xs"
                        label="Coinbase"
                      />
                    </template>
                    <!-- Regular case -->
                    <template v-else>
                      <ExplorerAmountXPI :sats="input.value" />
                    </template>
                  </div>
                  <div class="flex items-center justify-between">
                    <template v-if="tx.isCoinbase">
                      <p class="text-sm text-gray-600 dark:text-gray-400">
                        New coins created as Miner reward and Stewardship funding
                      </p>
                    </template>
                    <template v-else>
                      <NuxtLink
                        :to="{ name: 'explorer-tx-txid', params: { txid: input.prevOut.txid } }"
                        :prefetch="false"
                      >
                        <UBadge
                          color="primary"
                          variant="subtle"
                          size="xs"
                          :trailing="true"
                        >
                          <UIcon
                            size="xs"
                            name="i-mdi-arrow-left"
                            class="mr-1"
                          />
                          Received
                        </UBadge>
                      </NuxtLink>
                      <!-- large viewport -->
                      <NuxtLink
                        v-if="input.address"
                        :to="`/explorer/address/${input.address}`"
                        class="hidden md:flex font-mono text-sm text-pink-500 dark:text-pink-400 hover:text-pink-600 dark:hover:text-pink-300"
                      >
                        {{ input.address }}
                      </NuxtLink>
                      <!-- small viewport -->
                      <NuxtLink
                        v-if="input.address"
                        :to="`/explorer/address/${input.address}`"
                        class="flex md:hidden font-mono text-sm text-pink-500 dark:text-pink-400 hover:text-pink-600 dark:hover:text-pink-300"
                      >
                        {{ truncateAddress(input.address) }}
                      </NuxtLink>
                    </template>
                  </div>
                </div>
              </div>
            </UDashboardSection>

            <!-- Outputs Section -->
            <UDashboardSection
              orientation="vertical"
              icon="i-mdi-arrow-down"
            >
              <template #title>
                <h2 class="text-2xl font-bold flex items-center">
                  Outputs
                  <UBadge
                    color="pink"
                    variant="subtle"
                    size="xs"
                    :label="`${numOutputs} outputs`"
                    class="ml-1"
                  />
                </h2>
              </template>

              <template #description>
                Where the Lotus is going, whether burned or given to an address
              </template>

              <div class="space-y-4">
                <div
                  v-for="(output, index) in tx.outputs"
                  :key="output.outputScript"
                  class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div
                    class="flex justify-between items-start mb-2 text-md font-semibold text-gray-600 dark:text-gray-300"
                  >
                    <div class="flex items-center">
                      <ExplorerAmountXPI :sats="output.value" />
                      <UBadge
                        v-if="output.rankOutput"
                        :color="getSentimentColor(output.rankOutput.sentiment)"
                        variant="subtle"
                        size="xs"
                        class="ml-1"
                      >
                        {{ toUppercaseFirstLetter(output.rankOutput.sentiment) }}
                      </UBadge>
                    </div>
                    <span class="text-sm">
                      Output #{{ index + 1 }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between">
                    <!-- rank output -->
                    <SocialProfileLink
                      v-if="output.rankOutput"
                      :platform="output.rankOutput.platform"
                      :profile-id="output.rankOutput.profileId"
                      :post-id="output.rankOutput.postId"
                    />
                    <!-- address in large viewport -->
                    <NuxtLink
                      v-if="output.address"
                      :to="`/explorer/address/${output.address}`"
                      class="hidden md:flex font-mono text-sm text-pink-500 dark:text-pink-400 hover:text-pink-600 dark:hover:text-pink-300"
                    >
                      {{ output.address }}
                    </NuxtLink>
                    <!-- address in small viewport -->
                    <NuxtLink
                      v-if="output.address"
                      :to="`/explorer/address/${output.address}`"
                      class="flex md:hidden font-mono text-sm text-pink-500 dark:text-pink-400 hover:text-pink-600 dark:hover:text-pink-300"
                    >
                      {{ truncateAddress(output.address) }}
                    </NuxtLink>
                    <!-- Badges for burned/spent/unspent -->
                    <template v-if="output.spentBy">
                      <NuxtLink
                        :to="{ name: 'explorer-tx-txid', params: { txid: output.spentBy.txid } }"
                        :prefetch="true"
                      >
                        <UBadge
                          color="primary"
                          variant="subtle"
                          size="xs"
                        >
                          Spent
                          <UIcon
                            class="ml-1"
                            size="xs"
                            name="i-mdi-arrow-right"
                          />
                        </UBadge>
                      </NuxtLink>
                    </template>
                    <!-- Burned -->
                    <template v-else-if="!output.address && Number(output.value) > 0">
                      <UBadge
                        color="red"
                        variant="subtle"
                        size="xs"
                      >
                        Burned
                      </UBadge>
                    </template>
                    <template v-else-if="output.address">
                      <UBadge
                        color="green"
                        variant="subtle"
                        size="xs"
                      >
                        Unspent
                      </UBadge>
                    </template>
                  </div>
                </div>
              </div>
            </UDashboardSection>
          </div>
        </UDashboardSection>
      </UDashboardPanelContent>
    </UDashboardPanel>
  </UDashboardPage>
</template>

<style scoped></style>
