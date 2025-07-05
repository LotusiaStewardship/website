<script setup lang="ts">
// import { useDashboard } from '~/composables/useDashboard'
// const { isNotificationsSlideoverOpen } = useDashboard()
definePageMeta({
  layout: 'explorer',
  title: 'Trending',
  description: 'What is worth your attention today? You decide!',
  ogTitle: 'Trending',
  ogDescription: 'What is worth your attention today? You decide!',
  ogUrl: 'https://lotusia.org/social/trending'
})

/**
 * SEO meta tags
 */
useSeoMeta({
  title: 'Trending',
  description: 'What is worth your attention today? You decide!',
  ogTitle: 'Trending',
  ogDescription: 'What is worth your attention today? You decide!',
  ogUrl: 'https://lotusia.org/social/trending'
})
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <UDashboardNavbar :title="$route.meta.title" />
      <UDashboardPanelContent>
        <UDashboardSection
          orientation="vertical"
          icon="i-mdi-scale-unbalanced"
          :actions="[]"
        >
          <template #title>
            <h2 class="text-2xl font-bold">
              Hot or Not?
            </h2>
          </template>

          <template #description>
            <p class="text-md">
              What is worth your attention today? You decide!
            </p>
          </template>

          <div class="grid gap-8 mt-8">
            <!-- Profiles section -->
            <div class="grid lg:grid-cols-2 gap-8">
              <SocialTrendingTopProfiles />
              <SocialTrendingTopPosts />
            </div>

            <!-- Posts section -->
            <div class="grid lg:grid-cols-2 gap-8">
              <SocialTrendingLowestProfiles />
              <SocialTrendingLowestPosts />
            </div>
          </div>
        </UDashboardSection>
      </UDashboardPanelContent>
    </UDashboardPanel>
  </UDashboardPage>
</template>
