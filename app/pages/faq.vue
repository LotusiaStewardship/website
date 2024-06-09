<script setup lang="ts">
const { data: page } = await useAsyncData('faq', () => queryContent('/faq').findOne())
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

function createLinkHash(question: string) {
  return question
    .toLowerCase()
    .replace(/\s/, '-')
    .replace(/[^a-zA-Z0-9]/g, '');
}
</script>
<template>
  <UContainer>
    <UPageHero
      :title="page.title"
      :description="page.description"
      :links="page.links"
      align="center"
    />
    <UPage>
      <UPageBody>
        <div v-for="(question, index) in page.questions"
          :key="index"
          class="pb-16"
        >
          <div class="question-text">
            {{ question.text }}
          </div>
          <div 
            class="py-2 flex flex-wrap gap-x-3 gap-y-1.5"
          > {{ question.answer }}
          </div>
          <div v-if="question.table">
            <UTable
              :columns="question.table.columns"
              :rows="question.table.rows"
            />
          </div>
          <div v-if="question.note"
            class="question-note pb-2 flex flex-wrap gap-x-3 gap-y-1.5 items-center"
          >
            <span>
              <UIcon name="i-heroicons-information-circle-solid" />
              &nbsp;{{ question.note }}
            </span>
          </div>
          <UPageLinks v-if="question.links"
            :links="question.links"
          />
        </div>
      </UPageBody>
    </UPage>
    <ULandingCTA
      :title="page.cta.title"
      :description="page.cta.description"
      :links="page.cta.links"
      :card="false"
      :ui="{ body: { padding: false }}"
      class="mb-24 sm:mb-32"
    />
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