<script setup lang="ts">
const { data: page } = await useAsyncData('founders', () => queryContent('/founders').findOne())
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

useSeoMeta({
  title: page.value.ogTitle,
  ogTitle: page.value.ogTitle,
  description: page.value.description,
  ogDescription: page.value.description
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        'name': 'Lotusia Stewardship',
        'url': 'https://lotusia.org',
        'description': 'Ethical proof-of-work blockchain built to foster human relationships, build reciprocal culture, and bolster societal value production',
        'foundingDate': '2021',
        'founder': [
          {
            '@type': 'Person',
            'name': 'Alexandre Guillioud',
            'url': 'https://guillioud.com',
            'jobTitle': 'Blockchain Architect & Co-founder',
            'description': 'Software architect with 12+ years of experience. Core blockchain developer, GPU miner engineer, mining pool operator. Also runs Golden Solar (29 photovoltaic installations) and conducts independent research in cognitive security.',
            'sameAs': [
              'https://guillioud.com',
              'https://github.com/boblepointu',
              'https://www.linkedin.com/in/alex--g/',
              'https://orcid.org/0009-0009-4514-5469',
              'https://goldensolar.fr',
              'https://cogsec.fr'
            ]
          },
          {
            '@type': 'Person',
            'name': 'Matthew Urgero',
            'jobTitle': 'Architect & Operations',
            'description': 'Ecosystem operations and strategic planning. Focuses on long-term sustainability and community building within the Lotusia ecosystem.'
          }
        ],
        'sameAs': [
          'https://github.com/LotusiaStewardship',
          'https://t.me/givelotus'
        ]
      })
    }
  ]
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
          src="/img/turtles_hero.jpeg"
          style="border-radius: 15%;"
          alt="Lotusia Founders"
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
      :links="section.links"
    >
      <NuxtImg
        v-if="i === 0"
        src="/img/alexandre_guillioud.jpeg"
        style="border-radius: 15%; max-width: 400px;"
        alt="Alexandre Guillioud — Lotusia Co-founder"
      />
      <NuxtImg
        v-else
        src="/img/matthew_urgero.jpeg"
        style="border-radius: 15%; max-width: 400px;"
        alt="Matthew Urgero — Lotusia Co-founder"
      />
    </ULandingSection>

    <ULandingCTA
      :title="page.cta.title"
      :description="page.cta.description"
      :links="[
        { label: 'Get Started', to: '/tools', icon: 'i-heroicons-chevron-right-16-solid', size: 'xl', color: 'purple', trailing: true },
        { label: 'Learn More', to: '/ecosystem', icon: 'i-heroicons-information-circle', size: 'xl', trailing: true }
      ]"
      :card="false"
    />
  </UContainer>
</template>
