<script setup lang="ts">
import type { GoodsPageLink } from '~/util/types'
import { parsePageLinks } from '~/util/functions'

const { data: page } = await useAsyncData('goods', () =>
  queryContent('/goods').findOne(),
)
if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page not found',
    fatal: true,
  })
}

const config = useRuntimeConfig()
const urls = config.public.url

useSeoMeta({
  title: page.value.ogTitle,
  ogTitle: page.value.ogTitle,
  description: page.value.description,
  ogDescription: page.value.description,
  ogImage: page.value.ogImage,
})
</script>

<template>
  <UContainer>
    <UPageHero
      :title="page.title"
      :description="page.description"
      align="center"
    />
    <UPage v-for="(section, i) in page.sections" :key="i">
      <UPageHeader
        :headline="section.headline"
        :title="section.title"
        :description="section.description"
      />
      <UPageBody>
        <UPageGrid>
          <UPageCard
            v-for="(link, j) in parsePageLinks(section.links, urls) as GoodsPageLink[]"
            :key="j"
            :icon="link.icon"
            :title="link.label"
            :description="`${section.version || link.version} - ${link.type}`"
            :to="link.to"
            :target="link.target"
          />
        </UPageGrid>
      </UPageBody>
    </UPage>
  </UContainer>
</template>
