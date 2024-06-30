<script setup lang="ts">
const { data: page } = await useAsyncData('index', () => queryContent('/').findOne())
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

import { parsePageLinks } from '~/util/functions';
const config = useRuntimeConfig()
const urls = config.public.url

useSeoMeta({
  title: page.value.title,
  ogTitle: page.value.title,
  description: page.value.description,
  ogDescription: page.value.description,
  ogImage: page.value.hero.image,
})
</script>

<template>
  <ULandingHero
    :title="page.hero.title"
    :description="page.description"
    :links="parsePageLinks(page.hero.links, urls)"
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
    :title="section.title"
    :description="section.description"
    :align="section.align"
    :features="section.features"
    :links="parsePageLinks(section.links, urls)"
  >
    <NuxtImg 
      :src="`/img/turtles_${(i + 1)}.jpeg`"
      style="border-radius: 15%;"
    />
  </ULandingSection>

  <ULandingCTA
    :title="page.cta.title"
    :description="page.cta.description"
    :links="parsePageLinks(page.hero.links, urls)"
    :card="false"
  />
</template>

<style scoped>
.landing-grid {
  background-size: 100px 100px;
  background-image:
    linear-gradient(to right, rgb(var(--color-gray-200)) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(var(--color-gray-200)) 1px, transparent 1px);
}
.dark {
  .landing-grid {
    background-image:
      linear-gradient(to right, rgb(var(--color-gray-800)) 1px, transparent 1px),
      linear-gradient(to bottom, rgb(var(--color-gray-800)) 1px, transparent 1px);
  }
}
</style>
