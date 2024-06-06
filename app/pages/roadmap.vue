<script setup lang="ts">
const { data: page } = await useAsyncData('roadmap', () => queryContent('/roadmap').findOne())
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}
useSeoMeta({
  title: page.value.title,
  ogTitle: page.value.title,
  description: page.value.description,
  ogDescription: page.value.description
})
</script>
<template>
  <UContainer>
    <UPageHero
      :title="page.hero.title"
      :description="page.hero.description"
      align="center"
    />
  </UContainer>
</template>