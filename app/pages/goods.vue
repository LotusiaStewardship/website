<script setup lang="ts">
const { data: page } = await useAsyncData('goods', () => queryContent('/goods').findOne())
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

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
    <UPageHero
      :title="page.title"
      :description="page.description"
      align="center"
    />
    <UPage v-for="(section, i) in page.sections"
      :key="i"
    >
      <UPageHeader
        :headline="section.headline"
        :title="section.title"
        :description="section.description"
      />
      <UPageBody>
        <UPageGrid>
          <UPageCard v-for="(link, j) in section.links"
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