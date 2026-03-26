<script setup lang="ts">
import { parsePageLinks } from '~/utils/functions'

const { data: page } = await useAsyncData('faq', () => queryContent('/faq').findOne())
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
  ogImage: page.value.ogImage
})

useHead({
  link: [{ rel: 'canonical', href: 'https://lotusia.org/faq' }]
})

function createLinkHash(question: string) {
  return question
    .toLowerCase()
    .replace(/\s/, '-')
    .replace(/[^a-zA-Z0-9]/g, '')
}
</script>

<template>
  <UContainer>
    <UPageHero :title="page.title" :description="page.description" :links="parsePageLinks(page.links, urls)"
      align="center" />
    <UPage>
      <UPageBody>
        <div v-for="(question, index) in page.questions" :key="index" class="pb-16">
          <div class="question-text">
            {{ question.text }}
          </div>
          <div class="py-2 flex flex-wrap gap-x-3 gap-y-1.5">
            {{ question.answer }}
          </div>
          <div v-if="question.table">
            <UTable :columns="question.table.columns" :rows="question.table.rows" />
          </div>
          <div v-if="question.note" class="question-note pb-2 flex flex-wrap gap-x-3 gap-y-1.5 items-center">
            <span>
              <UIcon name="i-heroicons-information-circle-solid" />
              &nbsp;{{ question.note }}
            </span>
          </div>
          <UPageLinks v-if="question.links" :links="parsePageLinks(question.links, urls)" />
        </div>

        <!-- Technical Specifications Section -->
        <div v-if="page.technical" class="py-16">
          <UPageHeader :title="page.technical.title" :description="page.technical.description" class="mb-12" />

          <!-- Technical Questions -->
          <div v-for="(question, index) in page.technical.questions" :key="index" class="pb-16">
            <div class="question-text">
              {{ question.text }}
            </div>
            <div class="py-2 flex flex-wrap gap-x-3 gap-y-1.5 whitespace-pre-wrap break-words">
              {{ question.answer }}
            </div>
            <div v-if="question.note" class="question-note pb-2 flex flex-wrap gap-x-3 gap-y-1.5 items-center">
              <span>
                <UIcon name="i-heroicons-information-circle-solid" />
                &nbsp;{{ question.note }}
              </span>
            </div>
          </div>

          <!-- Technical Tables -->
          <div v-for="section in page.technical.sections" :key="section.title" class="mb-12">
            <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              {{ section.title }}
            </h3>
            <UTable :columns="section.table.columns" :rows="section.table.rows" :ui="{
              th: { padding: 'px-4 py-3.5' },
              td: { padding: 'px-4 py-3.5' }
            }" />
          </div>
        </div>
      </UPageBody>
    </UPage>
    <ULandingCTA :title="page.cta.title" :description="page.cta.description"
      :links="parsePageLinks(page.cta.links, urls)" :card="false" :ui="{ body: { padding: false } }"
      class="mb-24 sm:mb-32" />
  </UContainer>
</template>

<style scoped>
.question-text {
  font-weight: bold;
  font-size: larger;
}

.question-note {
  font-weight: bolder;
  font-size: small;
}
</style>
