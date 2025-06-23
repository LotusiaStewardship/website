<script setup lang="ts">
import { format } from 'date-fns'
import {
  VisXYContainer,
  VisLine,
  VisArea,
  VisAxis,
  VisCrosshair,
  VisTooltip
} from '@unovis/vue'
import { toMinifiedStatCount } from '~/utils/functions'

const cardRef = ref<HTMLElement | null>(null)
const { width } = useElementSize(cardRef)

// Update toggle to include quarterly view
const timeFrame = ref<'week' | 'month' | 'quarter'>('week')

interface ChartDataPoint {
  date: Date
  totalVotes: number
  totalPayoutsSent: number
  totalPayoutAmount: number
}

// Define colors that match the preferred visual
const voteColor = 'rgb(88, 151, 251)' // Blue
const payoutColor = 'rgb(41, 211, 116)' // Green
const amountColor = 'rgb(255, 105, 180)' // Pink

// Replace useAsyncData with direct data fetching
const isLoading = ref(false)
const chartData = ref<ChartDataPoint[]>([])

// Function to fetch data
const fetchData = async (timespan: 'week' | 'month' | 'quarter') => {
  isLoading.value = true
  try {
    const rankApi = useRankApi()

    // Use switch statement for better extensibility with future timeframes
    let response
    switch (timespan) {
      case 'week':
        response = await rankApi.getWeeklyWalletActivity()
        break
      case 'month':
        response = await rankApi.getMonthlyWalletActivity()
        break
      case 'quarter':
        response = await rankApi.getQuarterlyWalletActivity()
        break
      default:
        response = await rankApi.getWeeklyWalletActivity()
        break
    }

    console.log(`${timespan} response:`, response)

    if (!response || !Array.isArray(response)) {
      console.error(`Invalid ${timespan} response:`, response)
      chartData.value = []
      isLoading.value = false
      return
    }

    // Create dates based on selected timeframe
    let daysCount
    switch (timespan) {
      case 'week':
        daysCount = 7
        break
      case 'month':
        daysCount = 30
        break
      case 'quarter':
        daysCount = 90
        break
      default:
        daysCount = 7
        break
    }

    const dates = Array.from({ length: daysCount }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (daysCount - 1 - i))
      date.setHours(0, 0, 0, 0)
      return date
    }).reverse()

    // Map API response to chart data points with proper dates
    const dataPoints = dates.map((date, index) => {
      const item
        = response && response[index]
          ? response[index]
          : {
              totalVotes: 0,
              totalPayoutsSent: 0,
              totalPayoutAmount: 0
            }

      // Ensure we're converting to numbers and defaulting to 0 if invalid
      const point = {
        date: date instanceof Date ? date : new Date(date),
        totalVotes: Number(item.totalVotes),
        totalPayoutsSent: Number(item.totalPayoutsSent ?? 0),
        totalPayoutAmount: Number(item.totalPayoutAmount ?? 0)
      }
      return point
    })

    console.log(`${timespan} dataPoints:`, dataPoints)

    // Sort data by date to ensure correct order
    dataPoints.sort((a, b) => a.date.getTime() - b.date.getTime())
    chartData.value = dataPoints
  } catch (error) {
    console.error(`Error fetching ${timespan} wallet activity data:`, error)
    chartData.value = []
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

const chartTicks = computed(() => chartData.value.map(d => d.date))

// Get max values for each type to set proper y-axis domains
const maxVotes = computed(() => {
  const max = Math.max(...chartData.value.map(d => d.totalVotes || 0), 1)
  return max > 1 ? max : 10 // Use a reasonable default if there's no data
})

const maxPayouts = computed(() => {
  const max = Math.max(...chartData.value.map(d => d.totalPayoutsSent || 0), 1)
  return max > 1 ? max : 10
})

const maxAmount = computed(() => {
  const max = Math.max(...chartData.value.map(d => d.totalPayoutAmount || 0), 1)
  return max > 1 ? max : 1000
})

// Separate data by type for separate visualization
const votesData = computed(() => {
  if (!chartData.value.length) return []
  return chartData.value.map(d => ({
    date: d.date,
    value: d.totalVotes,
    originalData: d
  }))
})

const payoutsData = computed(() => {
  if (!chartData.value.length) return []
  return chartData.value.map(d => ({
    date: d.date,
    value: d.totalPayoutsSent,
    originalData: d
  }))
})

const amountData = computed(() => {
  if (!chartData.value.length) return []
  return chartData.value.map(d => ({
    date: d.date,
    value: d.totalPayoutAmount,
    originalData: d
  }))
})

// Ensure x accessor always returns a valid Date
const x = (d: { date: any }) => {
  if (typeof d.date === 'number') {
    return new Date(d.date)
  }
  return d.date instanceof Date ? d.date : new Date()
}

const xTicks = (date: any) => {
  // Check if date is a timestamp (number) and convert to Date
  if (typeof date === 'number') {
    date = new Date(date)
  }

  // Check if date is actually a Date object
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.warn('Invalid date passed to xTicks:', date)
    return ''
  }

  // Format based on timeframe
  switch (timeFrame.value) {
    case 'week':
      return format(date, 'MMM d')
    case 'month': {
      // For month view, show full format for 1st of month and every 5th day
      const day = date.getDate()
      if (day === 1 || day % 5 === 0) {
        return format(date, 'MMM d')
      }
      return format(date, 'd')
    }
    case 'quarter': {
      // For quarter view, show dates in more spaced out format
      const quarterDay = date.getDate()
      // Show 1st of month or every 15th day
      if (quarterDay === 1 || quarterDay === 15) {
        return format(date, 'MMM d')
      }
      return ''
    }
    default:
      return format(date, 'MMM d')
  }
}
const y = (d: { value: number }) => d.value

const totalVotes = computed(() =>
  chartData.value.reduce((acc, item) => acc + (item.totalVotes || 0), 0)
)

const totalPayouts = computed(() =>
  chartData.value.reduce((acc, item) => acc + (item.totalPayoutsSent || 0), 0)
)

const totalPayoutAmount = computed(() =>
  chartData.value.reduce((acc, item) => acc + (item.totalPayoutAmount || 0), 0)
)

const formatNumber = new Intl.NumberFormat('en').format
const formatLotus = (value: number) => `${toMinifiedStatCount(value)} Lotus`

const voteTooltip = (d: { originalData: ChartDataPoint }) => {
  const data = d.originalData
  return `
  <div class="font-medium">${format(data.date, 'MMM d, yyyy')}</div>
  <div class="flex items-center gap-2 mt-1">
    <div class="w-2 h-2 rounded-full" style="background: ${voteColor}"></div>
    <div>Votes Cast: <span style="color: ${voteColor}">${formatNumber(
    data.totalVotes
  )}</span></div>
  </div>
  `
}

const payoutTooltip = (d: { originalData: ChartDataPoint }) => {
  const data = d.originalData
  return `
  <div class="font-medium">${format(data.date, 'MMM d, yyyy')}</div>
  <div class="flex items-center gap-2">
    <div class="w-2 h-2 rounded-full" style="background: ${payoutColor}"></div>
    <div>Rewards Given: <span style="color: ${payoutColor}">${formatNumber(
    data.totalPayoutsSent
  )}</span></div>
  </div>
  `
}

const amountTooltip = (d: { originalData: ChartDataPoint }) => {
  const data = d.originalData
  return `
  <div class="font-medium">${format(data.date, 'MMM d, yyyy')}</div>
  <div class="flex items-center gap-2 mt-1">
    <div class="w-2 h-2 rounded-full" style="background: ${amountColor}"></div>
    <div>Total Reward Amount: <span style="color: ${amountColor}">${formatLotus(
    data.totalPayoutAmount
  )}</span></div>
  </div>
  `
}

// Calculate yAxis domains with some padding
const votesYDomain = computed(() => [0, Math.ceil(maxVotes.value * 1.1)])
const payoutsYDomain = computed(() => [0, Math.ceil(maxPayouts.value * 1.1)])
const amountYDomain = computed(() => [0, Math.ceil(maxAmount.value * 1.1)])

// Computed property for number of ticks based on timeframe
const axisNumTicks = computed(() => {
  switch (timeFrame.value) {
    case 'week':
      return 7
    case 'month':
      return 12
    case 'quarter':
      return 15
    default:
      return 7
  }
})
</script>

<template>
  <UDashboardCard
    ref="cardRef"
    :ui="{ body: { padding: '!pb-3 !px-0' } as any }"
  >
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
          1 Week
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
          1 Month
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
          3 Months
        </button>
      </div>
    </div>

    <template #header>
      <div>
        <div class="flex justify-between items-center mb-1">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{
                timeFrame === 'week'
                  ? 'Weekly'
                  : timeFrame === 'month'
                    ? 'Monthly'
                    : 'Quarterly'
              }}
              Engagement & Rewards
            </h3>
            <p
              class="text-sm text-gray-600 dark:text-gray-300 mb-4 align-middle"
            >
              Install the
              <ULink
                to="https://chromewebstore.google.com/detail/lotusia/bbdehfckfcaablnndggpliihmfmflcbh"
                target="_blank"
                class="text-primary-500 dark:text-primary-400 font-semibold"
              >Lotusia Chrome extension</ULink>
              to engage and earn rewards!
            </p>
          </div>
        </div>

        <div class="flex gap-6">
          <div>
            <p
              class="text-2xl text-gray-900 dark:text-white font-semibold"
              style="color: rgb(88, 151, 251)"
            >
              {{ toMinifiedStatCount(totalVotes, 1) }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Votes Cast
            </p>
          </div>
          <div>
            <p
              class="text-2xl text-gray-900 dark:text-white font-semibold"
              style="color: rgb(41, 211, 116)"
            >
              {{ formatNumber(totalPayouts) }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Rewards Given
            </p>
          </div>
          <div>
            <p
              class="text-2xl text-gray-900 dark:text-white font-semibold"
              style="color: rgb(255, 105, 180)"
            >
              {{ formatLotus(totalPayoutAmount) }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Total Reward Amount
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="p-4 flex justify-center items-center h-60"
    >
      <p class="text-lg text-gray-500 dark:text-gray-400">
        Loading...&nbsp;&nbsp;
      </p>
      <UIcon
        name="i-heroicons-arrow-path"
        class="text-primary-500 animate-spin text-2xl"
      />
    </div>

    <!-- No data state -->
    <div
      v-else-if="chartData.length === 0 || votesData.length === 0"
      class="p-4 flex justify-center items-center h-60"
    >
      <p class="text-gray-500 dark:text-gray-400">
        No data available for this time period
      </p>
    </div>

    <!-- Data available state -->
    <div
      v-else
      class="chart-container"
    >
      <!-- Votes Chart -->
      <div class="chart-section">
        <div
          class="chart-title"
          style="color: rgb(88, 151, 251)"
        >
          Votes Cast
        </div>
        <VisXYContainer
          :data="votesData"
          :padding="{ top: 10, bottom: 20, left: 60, right: 20 }"
          class="h-28"
          :width="width"
        >
          <VisLine
            :x="x"
            :y="y"
            :color="voteColor"
            :stroke-width="2"
            :y-domain="votesYDomain"
          />
          <VisArea
            :x="x"
            :y="y"
            :color="voteColor"
            :opacity="0.1"
            :y-domain="votesYDomain"
          />
          <VisAxis
            type="x"
            :ticks="chartTicks"
            :tick-format="xTicks"
            :num-ticks="axisNumTicks"
            :label-format="xTicks"
          />
          <VisAxis
            type="y"
            position="left"
            :tick-format="formatNumber"
            :domain="votesYDomain"
            :color="voteColor"
          />
          <VisCrosshair
            color="#888"
            :template="voteTooltip"
            :x-accessor="x"
            :y-accessors="[y]"
          />
          <VisTooltip />
        </VisXYContainer>
      </div>

      <!-- Payouts Chart -->
      <div class="chart-section">
        <div
          class="chart-title"
          style="color: rgb(41, 211, 116)"
        >
          Rewards Given
        </div>
        <VisXYContainer
          :data="payoutsData"
          :padding="{ top: 10, bottom: 20, left: 60, right: 20 }"
          class="h-28"
          :width="width"
        >
          <VisLine
            :x="x"
            :y="y"
            :color="payoutColor"
            :stroke-width="2"
            :y-domain="payoutsYDomain"
          />
          <VisArea
            :x="x"
            :y="y"
            :color="payoutColor"
            :opacity="0.1"
            :y-domain="payoutsYDomain"
          />
          <VisAxis
            type="x"
            :ticks="chartTicks"
            :tick-format="xTicks"
            :num-ticks="axisNumTicks"
            :label-format="xTicks"
          />
          <VisAxis
            type="y"
            position="left"
            :tick-format="formatNumber"
            :domain="payoutsYDomain"
            :color="payoutColor"
          />
          <VisCrosshair
            color="#888"
            :template="payoutTooltip"
            :x-accessor="x"
            :y-accessors="[y]"
          />
          <VisTooltip />
        </VisXYContainer>
      </div>

      <!-- Amount Chart -->
      <div class="chart-section">
        <div
          class="chart-title"
          style="color: rgb(255, 105, 180)"
        >
          Total Reward Amount
        </div>
        <VisXYContainer
          :data="amountData"
          :padding="{ top: 10, bottom: 20, left: 60, right: 20 }"
          class="h-28"
          :width="width"
        >
          <VisLine
            :x="x"
            :y="y"
            :color="amountColor"
            :stroke-width="2"
            :y-domain="amountYDomain"
          />
          <VisArea
            :x="x"
            :y="y"
            :color="amountColor"
            :opacity="0.1"
            :y-domain="amountYDomain"
          />
          <VisAxis
            type="x"
            :ticks="chartTicks"
            :tick-format="xTicks"
            :num-ticks="axisNumTicks"
            :label-format="xTicks"
          />
          <VisAxis
            type="y"
            position="left"
            :tick-format="formatLotus"
            :domain="amountYDomain"
            :color="amountColor"
          />
          <VisCrosshair
            color="#888"
            :template="amountTooltip"
            :x-accessor="x"
            :y-accessors="[y]"
          />
          <VisTooltip />
        </VisXYContainer>
      </div>
    </div>
  </UDashboardCard>
</template>

<style scoped>
.chart-container {
  display: flex;
  flex-direction: column;
  height: 96;
}

.chart-section {
  margin-bottom: 1rem;
}

.chart-title {
  padding-left: 60px;
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.unovis-xy-container {
  --vis-crosshair-line-stroke-color: rgb(var(--color-primary-500));
  --vis-crosshair-circle-stroke-color: #fff;

  --vis-axis-grid-color: rgb(var(--color-gray-200));
  --vis-axis-tick-color: rgb(var(--color-gray-200));
  --vis-axis-tick-label-color: rgb(var(--color-gray-400));

  --vis-tooltip-background-color: #fff;
  --vis-tooltip-border-color: rgb(var(--color-gray-200));
  --vis-tooltip-text-color: rgb(var(--color-gray-900));
  --vis-tooltip-padding: 0.75rem;
}

.dark {
  .unovis-xy-container {
    --vis-crosshair-line-stroke-color: rgb(var(--color-primary-400));
    --vis-crosshair-circle-stroke-color: rgb(var(--color-gray-900));

    --vis-axis-grid-color: rgb(var(--color-gray-800));
    --vis-axis-tick-color: rgb(var(--color-gray-800));
    --vis-axis-tick-label-color: rgb(var(--color-gray-500));

    --vis-tooltip-background-color: rgb(var(--color-gray-900));
    --vis-tooltip-border-color: rgb(var(--color-gray-800));
    --vis-tooltip-text-color: #fff;
  }
}
</style>
