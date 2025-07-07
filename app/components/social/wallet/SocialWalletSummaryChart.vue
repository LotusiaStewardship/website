<script setup lang="ts">
import type { WalletSummaryResult } from '~/types'
import { toMinifiedStatCount } from '~/utils/functions'

// Update toggle to include quarterly view
const timeFrame = shallowRef<'week' | 'month' | 'quarter'>('week')

// Replace useAsyncData with direct data fetching
const isLoading = shallowRef(false)
const summaryData = ref<WalletSummaryResult>({
  totalVotes: 0,
  totalUpvotes: 0,
  totalDownvotes: 0,
  totalUniqueWallets: 0,
  totalSatsBurned: 0
})

// Function to fetch data
const fetchData = async (timespan: 'week' | 'month' | 'quarter') => {
  isLoading.value = true
  try {
    const rankApi = useRankApi()

    // Use the appropriate API method based on timeframe
    let data: WalletSummaryResult
    switch (timespan) {
      case 'week':
        data = await rankApi.getWeeklyWalletSummary()
        break
      case 'month':
        data = await rankApi.getMonthlyWalletSummary()
        break
      case 'quarter':
        data = await rankApi.getQuarterlyWalletSummary()
        break
      default:
        data = await rankApi.getWeeklyWalletSummary()
        break
    }

    console.log(`${timespan} summary response:`, data)

    if (!data) {
      console.error(`Invalid ${timespan} summary response:`, data)
      summaryData.value = {
        totalVotes: 0,
        totalUpvotes: 0,
        totalDownvotes: 0,
        totalUniqueWallets: 0,
        totalSatsBurned: 0
      }
    } else {
      summaryData.value = data
    }
  } catch (error) {
    console.error(`Error fetching ${timespan} wallet summary data:`, error)
    summaryData.value = {
      totalVotes: 0,
      totalUpvotes: 0,
      totalDownvotes: 0,
      totalUniqueWallets: 0,
      totalSatsBurned: 0
    }
  } finally {
    isLoading.value = false
  }
}

// Watch for timeFrame changes and refetch data
watch(
  timeFrame,
  async () => {
    console.log('TimeFrame changed to:', timeFrame.value)
    await fetchData(timeFrame.value)
  },
  { immediate: true }
)

const formatNumber = new Intl.NumberFormat('en').format
const formatLotus = (value: number) => `${toMinifiedStatCount(value)} XPI`
</script>

<template>
  <UDashboardCard>
    <template #header>
      <div>
        <div class="flex justify-between items-center mb-1">
          <p class="text-lg text-gray-500 dark:text-gray-400 font-medium">
            {{
              timeFrame === 'week'
                ? 'Weekly'
                : timeFrame === 'month'
                  ? 'Monthly'
                  : 'Quarterly'
            }}
            Voter Summary
          </p>
        </div>
      </div>
    </template>
    <!-- Centered timeframe tabs at the very top of the card -->
    <div class="flex justify-center pt-4 pb-2">
      <div class="flex rounded-md shadow-sm">
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-l-md"
          :class="[
            timeFrame === 'week'
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
              : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          ]"
          :disabled="isLoading"
          @click="timeFrame = 'week'"
        >
          Weekly
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium"
          :class="[
            timeFrame === 'month'
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
              : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          ]"
          :disabled="isLoading"
          @click="timeFrame = 'month'"
        >
          Monthly
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-r-md"
          :class="[
            timeFrame === 'quarter'
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
              : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          ]"
          :disabled="isLoading"
          @click="timeFrame = 'quarter'"
        >
          Quarterly
        </button>
      </div>
    </div>
    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="p-4 flex justify-center items-center h-60"
    >
      <UIcon
        name="i-heroicons-arrow-path"
        class="text-primary-500 animate-spin text-2xl"
      />
    </div>

    <!-- Data available state -->
    <div v-else>
      <div class="grid grid-cols-2 gap-6">
        <!-- Votes Statistics -->
        <div class="border border-gray-200 dark:border-gray-700 p-4 rounded-lg">
          <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
            Vote Activity
          </h3>
          <div class="space-y-4">
            <div>
              <p class="text-2xl text-gray-900 dark:text-white font-semibold">
                {{ formatNumber(summaryData.totalVotes) }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Total Votes
              </p>
            </div>
            <div class="flex gap-6">
              <div>
                <p class="text-xl text-green-600 dark:text-green-400 font-medium">
                  {{ formatNumber(summaryData.totalUpvotes) }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Upvotes
                </p>
              </div>
              <div>
                <p class="text-xl text-red-600 dark:text-red-400 font-medium">
                  {{ formatNumber(summaryData.totalDownvotes) }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Downvotes
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Wallet Statistics -->
        <div class="border border-gray-200 dark:border-gray-700 p-4 rounded-lg">
          <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
            Wallet Activity
          </h3>
          <div class="space-y-4">
            <div>
              <p class="text-2xl text-gray-900 dark:text-white font-semibold">
                {{ formatNumber(summaryData.totalUniqueWallets) }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Unique Wallets
              </p>
            </div>
            <div>
              <p
                class="text-xl font-medium"
                style="color: rgb(255, 105, 180)"
              >
                {{ formatLotus(summaryData.totalSatsBurned) }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Total Burned
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UDashboardCard>
</template>
