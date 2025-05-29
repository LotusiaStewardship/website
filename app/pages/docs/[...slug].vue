<script setup lang="ts">
import type { NavItem } from '@nuxt/content/types'

const route = useRoute()

const { data: page } = await useAsyncData(route.path, () =>
  queryContent(route.path).findOne()
)
if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page not found',
    fatal: true
  })
}

const { data: navigation } = await useAsyncData(
  `${route.path}-navigationTree`,
  () => fetchContentNavigation(queryContent('/docs').find()),
  { default: () => [] }
)
const navigationTree = computed(() =>
  navigation.value.filter((item: NavItem) => item._path === '/docs')
)

useSeoMeta({
  title: page.value.title,
  ogTitle: page.value.title,
  description: page.value.description,
  ogDescription: page.value.description
})

defineOgImage({
  component: 'Saas',
  title: page.value.title,
  description: page.value.description
})

const headline = computed(() => findPageHeadline(page.value!))
</script>

<template>
  <UContainer>
    <UPage v-if="page">
      <UPageHeader
        :title="page.title"
        :links="page.links"
        :headline="headline"
      />

      <template #left>
        <UPageBody>
          <UNavigationTree
            :level="1"
            :links="mapContentNavigation(navigationTree[0].children)"
            :multiple="false"
            :default-open="true"
          />
        </UPageBody>
      </template>

      <UPageBody prose>
        <ContentRenderer v-if="page.body" :value="page" />
      </UPageBody>

      <template v-if="page.toc !== false" #right>
        <UContentToc title="On this page" :links="page.body?.toc?.links" />
      </template>
    </UPage>
  </UContainer>
</template>
