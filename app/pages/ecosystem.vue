<script setup lang="ts">
const { data: page } = await useAsyncData('ecosystem', () => queryContent('/ecosystem').findOne())
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
  <ULandingHero
    :title="page.hero.title"
    :description="page.hero.description"
    orientation="horizontal"
  >
    <template #default>
      <NuxtImg
        :src="page.hero.image.light"
        style="border-radius: 15%;"
      />
    </template>
  </ULandingHero>
  <template v-for="(section, i) in page.sections"
    :key="i"
  >
    <ULandingSection 
      :headline="section.headline"
      :title="section.title"
      :description="section.description"
      :align="section.align"
      :features="section.features"
    >
      <UPageGrid v-if="section.quotes"
      :ui="{ wrapper: `xl:grid-cols-1` }"
      >
        <ULandingTestimonial v-for="(quote, k) in section.quotes"
          :key="k"
          :quote="quote.text"
          :author="{ name: quote.author, description: quote.title, avatar: { src: quote.avatar } }"
          class="break-inside-avoid bg-gray-100/50 dark:bg-gray-800/50"
        />
      </UPageGrid>
      <NuxtImg v-else
        :src="`/img/ecosystem_${(i + 1)}_0.jpg`"
        style="border-radius: 15%;"
      />
    </ULandingSection>
    <ULandingSection v-for="(subsection, j) in section.subsections"
      :key="j"
      :title="subsection.title"
      :description="subsection.description"
      :align="subsection.align"
      :features="subsection.features"
    >
      <NuxtImg
        :src="`/img/ecosystem_${(i + 1)}_${(j + 1)}.jpg`"
        style="border-radius: 15%;"
      />
    </ULandingSection>
  </template>
</template>