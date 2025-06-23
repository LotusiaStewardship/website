<script setup lang="ts">
import { parsePageLinks } from '~/utils/functions'

const { data: page } = await useAsyncData('roadmap', () => queryContent('/roadmap').findOne())
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

const config = useRuntimeConfig()
const urls = config.public.url

useSeoMeta({
  title: page.value.ogTitle,
  ogTitle: page.value.ogTitle,
  description: page.value.description,
  ogDescription: page.value.description,
  ogImage: page.value.hero.ogImage
})

const newStatusObject = (
  planned: string,
  ongoing: string,
  complete: string
) => {
  return { planned, ongoing, complete }
}

const cardStyling = {
  icon: newStatusObject(
    'i-heroicons-minus-circle',
    'i-heroicons-ellipsis-horizontal-circle',
    'i-heroicons-check-circle'
  ),
  ui: {
    wrapper: newStatusObject(
      '',
      'border-b border-l border-purple-400 dark:border-purple-800',
      'border-2 drop-shadow-lg dark:drop-shadow-xl border-purple-400 dark:border-purple-800'
    ),
    icon: newStatusObject(
      'text-gray-300 dark:text-gray-600',
      'text-primary',
      'text-primary'
    )
  }
}
</script>

<template>
  <UContainer>
    <UPageHero
      :title="page.hero.title"
      :description="page.hero.description"
      align="center"
    />
    <UPage
      v-for="(section, i) in page.sections"
      :key="i"
    >
      <UPageHeader
        :headline="section.headline"
        :title="section.title"
      />
      <UPageBody>
        <UPageGrid>
          <UPageCard
            v-for="(card, j) in section.cards"
            :key="j"
            :title="card.title"
            :description="card.description"
            :ui="{
              wrapper: cardStyling.ui.wrapper[card.status],
              icon: {
                base: cardStyling.ui.icon[card.status]
              }
            }"
            :icon="cardStyling.icon[card.status]"
          >
            <UPageBody
              :ui="{ wrapper: 'mt-2 pb-0' }"
            >
              <template #default>
                <UCheckbox
                  v-for="(item, k) in card.checklist"
                  :key="k"
                  disabled
                  :label="item.label"
                  :model-value="item.complete"
                  :ui="{
                    wrapper: ((k + 1) == card.checklist.length ? 'mt-4 mb-0': 'mt-4 mb-4'),
                    base: 'disabled:opacity-100 disabled:cursor-default'
                  }"
                />
                <UPageLinks
                  active
                  :links="parsePageLinks(card.links, urls)"
                  :ui="{ wrapper: 'mt-4', container: 'lg:space-y-3' }"
                />
              </template>
            </UPageBody>
          </UPageCard>
        </UPageGrid>
      </UPageBody>
    </UPage>
  </UContainer>
</template>
