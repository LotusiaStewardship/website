<script setup lang="ts">
const { data: page } = await useAsyncData('founders', () => queryContent('/founders').findOne())
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

useSeoMeta({
  title: page.value.ogTitle,
  ogTitle: page.value.ogTitle,
  description: page.value.description,
  ogDescription: page.value.description,
  ogImage: '/img/alexandre_guillioud.jpeg'
})

useHead({
  link: [{ rel: 'canonical', href: 'https://lotusia.org/founders' }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        'name': 'Lotusia Stewardship',
        'url': 'https://lotusia.org',
        'logo': { '@type': 'ImageObject', 'url': 'https://lotusia.org/img/logo.png' },
        'description': 'Ethical proof-of-work blockchain built to foster human relationships, build reciprocal culture, and bolster societal value production',
        'foundingDate': '2021',
        'founder': [
          {
            '@type': 'Person',
            'name': 'Alexandre Guillioud',
            'url': 'https://guillioud.com',
            'jobTitle': 'Blockchain Architect & Co-founder',
            'telephone': '+33676479898',
            'description': 'Software architect with 12+ years of experience across embedded systems, blockchain, solar energy and distributed architectures. Core blockchain developer, GPU miner engineer, mining pool operator. Runs Golden Solar (29 photovoltaic installations, 4 MWp). Independent researcher in cognitive security. Previously at myNFT, Veepee, fulll, SmartMeUp, ALTANSIA/Orange, EXL GROUP/Talan.',
            'image': 'https://lotusia.org/img/alexandre_guillioud.jpeg',
            'alumniOf': { '@type': 'EducationalOrganization', 'name': 'ESIEA', 'url': 'https://www.esiea.fr' },
            'sameAs': [
              'https://guillioud.com',
              'https://github.com/boblepointu',
              'https://www.linkedin.com/in/alex--g/',
              'https://orcid.org/0009-0009-4514-5469',
              'https://goldensolar.fr',
              'https://carb-on.earth',
              'https://cogsec.fr',
              'https://blindstack.fr',
              'https://blackcat.events',
              'https://foras.fr',
              'https://soleil-vert-poype.fr'
            ],
            'knowsAbout': ['Software Architecture', 'Blockchain', 'Solidity', 'Solar Energy', 'Cognitive Security', 'WebGPU', 'Terraform', 'AWS', 'Poker Tournament Software', 'Gamification']
          },
          {
            '@type': 'Person',
            'name': 'Matthew Urgero',
            'url': 'https://www.linkedin.com/in/matthew-urgero/',
            'jobTitle': 'Sr. IT Systems Engineer · Architect & Operations',
            'description': 'Senior IT Systems Engineer and Architect & Operations at Lotusia Stewardship. Based in San Tan Valley, Arizona. Focuses on ecosystem operations, strategic planning, long-term sustainability, and community building. Drives the roadmap aligned with Lotusia core values of truth, integrity, and pragmatism.',
            'address': { '@type': 'PostalAddress', 'addressLocality': 'San Tan Valley', 'addressRegion': 'Arizona', 'addressCountry': 'US' },
            'sameAs': [
              'https://www.linkedin.com/in/matthew-urgero/'
            ],
            'worksFor': { '@type': 'Organization', 'name': 'Lotusia Stewardship', 'url': 'https://lotusia.org' }
          }
        ],
        'sameAs': [
          'https://github.com/LotusiaStewardship',
          'https://t.me/givelotus',
          'https://guillioud.com',
          'https://goldensolar.fr',
          'https://carb-on.earth',
          'https://cogsec.fr',
          'https://blindstack.fr',
          'https://blackcat.events'
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
