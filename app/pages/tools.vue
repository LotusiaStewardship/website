<script setup lang="ts">
import { parsePageLinks } from '~/utils/functions'

const { data: page } = await useAsyncData('tools', () =>
  queryContent('/tools').findOne()
)
if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page not found',
    fatal: true
  })
}

const config = useRuntimeConfig()
const urls = config.public.url

useSeoMeta({
  title: page.value.ogTitle,
  ogTitle: page.value.ogTitle,
  description: page.value.description,
  ogDescription: page.value.description,
  ogImage: page.value.ogImage
})
</script>

<template>
  <UContainer>
    <ULandingHero
      :title="page.hero.title"
      :description="page.hero.description"
      orientation="horizontal"
    >
      <template #default>
        <NuxtImg
          :src="page.hero.image"
          style="border-radius: 15%;"
        />
      </template>
    </ULandingHero>
    <ULandingSection
      v-for="(section, i) in page.sections"
      :key="i"
      :headline="section.headline"
      :title="section.title"
      :description="section.description"
      :align="section.align"
      :features="section.features"
      :links="parsePageLinks(section.links, urls)"
    >
      <UPageGrid
        v-if="section.images"
        :ui="{ wrapper: `sm:grid-cols-1 xl:grid-cols-1 py-0` }"
      >
        <template #default>
          <NuxtImg
            v-for="image in section.images"
            :key="image.src"
            :src="image.src"
            style="border-radius: 15%;"
          />
        </template>
      </UPageGrid>
    </ULandingSection>
  </UContainer>
</template>
