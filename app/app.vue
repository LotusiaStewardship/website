<script setup lang="ts">
const colorMode = useColorMode()

const color = computed(() => colorMode.value === 'dark' ? '#111827' : 'white')

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  titleTemplate: '%s | Lotusia',
  ogSiteName: 'Lotusia',
  ogType: 'website',
  ogImage: 'https://lotusia.org/img/turtles_hero.jpeg',
  twitterImage: 'https://lotusia.org/img/turtles_hero.jpeg',
  twitterCard: 'summary_large_image'
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': 'Lotusia',
        'url': 'https://lotusia.org',
        'description': 'Ethical proof-of-work blockchain built to foster human relationships, build reciprocal culture, and bolster societal value production',
        'publisher': {
          '@type': 'Organization',
          'name': 'Lotusia Stewardship',
          'url': 'https://lotusia.org',
          'sameAs': [
            'https://github.com/LotusiaStewardship',
            'https://t.me/givelotus'
          ]
        }
      })
    }
  ]
})
</script>

<template>
  <div>
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <UNotifications />
  </div>
</template>
