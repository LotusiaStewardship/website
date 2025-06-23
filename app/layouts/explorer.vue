<script setup lang="ts">
import type { DashboardSidebarLink } from '@nuxt/ui-pro/types'

useSeoMeta({
  titleTemplate: '%s | Lotusia Explorer',
  description: 'Explore the Lotusia blockchain',
  ogTitle: 'Lotusia Explorer',
  ogDescription: 'Explore the Lotusia blockchain'
})

const explorerSidebarLinks: DashboardSidebarLink[] = [
  {
    label: 'Network',
    icon: 'i-mdi-network',
    collapsible: false,
    children: [
      {
        label: 'Overview',
        to: '/explorer'
      },
      {
        label: 'Blocks',
        to: '/explorer/blocks'
      }/* ,
      {
        label: 'Transactions',
        to: '/explorer/transactions',
        disabled: true
      },
      {
        label: 'Addresses',
        to: '/explorer/addresses',
        disabled: true
      },
      {
        label: 'Mining',
        to: '/explorer/mining',
        disabled: true
      } */]
  }
]
const rankSidebarLinks: DashboardSidebarLink[] = [
  {
    label: 'Social Media  ',
    icon: 'i-mdi-nature-people-outline',
    collapsible: false,
    children: [
      {
        label: 'Latest',
        to: '/social/activity'
      },
      {
        label: 'Trending',
        to: '/social/trending'
      },
      {
        label: 'Profiles',
        to: '/social/profiles'
      }
    ]
  }
]
</script>

<template>
  <UDashboardLayout>
    <!-- Header and Sidebar -->
    <UDashboardPanel
      :resizable="false"
      :width="250"
      :collapsible="true"
    >
      <ExplorerHeader />
      <UDashboardNavbar />

      <UDashboardSidebar>
        <!-- Network sidebar (i.e. Lotus Explorer) -->
        <UDashboardSidebarLinks
          :links="explorerSidebarLinks"
        />
        <!-- RANK sidebar (i.e. RANK dashboard) -->
        <UDashboardSidebarLinks
          :links="rankSidebarLinks"
        />
        <!-- Footer -->
        <template #footer>
          <ExplorerFooter />
        </template>
      </UDashboardSidebar>
    </UDashboardPanel>

    <!-- Content -->
    <!-- Page with UDashboardPage as root element -->
    <slot />
  </UDashboardLayout>
</template>
