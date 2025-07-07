<script setup lang="ts">
import { toPercentColor, toMinifiedPercent } from '~/utils/functions'

definePageMeta({
  layout: 'explorer'
})

/**
 * Async data
 */
const page = shallowRef(1)
const rowsPerPage = shallowRef(10)
const { data } = await useAsyncData(
  'profiles',
  () => $fetch(`/api/social/profiles`, {
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
const profilesTableColumns = [
  {
    key: 'index'
  },
  {
    key: 'profileId',
    label: 'Profile'
  },
  {
    key: 'ranking',
    label: 'Ranking'
  },
  {
    key: 'ratio',
    label: 'Vote Ratio'
  }
]

/**
 * Vue refs
 */
const isLoading = shallowRef(false)

/**
 * Vue computed properties
 */
const profiles = computed(() => data.value.profiles)
const numPages = computed(() => data.value.numPages)

/**
 * SEO Meta
 */
useSeoMeta({
  title: 'Profiles',
  description: 'Profiles on Lotusia Social',
  ogTitle: 'Profiles',
  ogDescription: 'Profiles on Lotusia Social',
  // ogImage: 'https://lotusia.org/og-image.png',
  ogUrl: 'https://lotusia.org/social/profiles'
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
          icon="i-mdi-account-circle"
        >
          <template #title>
            <h2 class="text-2xl font-bold">
              Profiles
            </h2>
          </template>
          <template #description>
            <p class="text-md">
              Browse profiles on Lotusia Social
            </p>
          </template>

          <UTable
            :rows="profiles"
            :columns="profilesTableColumns"
          >
            <!-- eslint-disable-next-line vue/no-unused-vars -->
            <template #index-data="{ _row, index }">
              {{ (index + 1 + (page - 1) * rowsPerPage).toLocaleString() }}
            </template>
            <template #profileId-data="{ row }">
              <SocialProfileLink
                :key="`${row.platform}:${row.id}`"
                :platform="row.platform"
                :profile-id="row.id"
              />
            </template>
            <template #ranking-data="{ row }">
              <ExplorerAmountXPI :sats="row.ranking" />
            </template>
            <template #ratio-data="{ row }">
              <UBadge
                :color="toPercentColor(toMinifiedPercent(row.satsPositive, row.satsNegative))"
                variant="soft"
                size="md"
              >
                {{ toMinifiedPercent(row.satsPositive, row.satsNegative) }}% Positive
              </UBadge>
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
        </UDashboardSection>
      </UDashboardPanelContent>
    </UDashboardPanel>
  </UDashboardPage>
</template>

<style scoped></style>
