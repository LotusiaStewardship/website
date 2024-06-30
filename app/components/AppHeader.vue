<script setup lang="ts">
import type { NavItem } from '@nuxt/content/dist/runtime/types'

const config = useRuntimeConfig()
const navigation = inject<Ref<NavItem[]>>('navigation', ref([]))

const links = [{
  label: 'Ecosystem',
  to: '/ecosystem'
}, {
  label: 'Public Goods',
  to: '/goods'
}, {
  label: 'Roadmap',
  to: '/roadmap'
}, {
  label: 'FAQ',
  to: '/faq'
}, {
  label: 'Blog',
  to: '/blog'
}, {
  label: 'More',
  children:[
    {
      label: 'Docs',
      to: config.public.url.docs,
      target: '_blank'
    }, {
      label: 'Block Explorer',
      to: config.public.url.explorer,
      target: '_blank'
    }
  ]
}]
</script>

<template>
  <UHeader :links="links">
    <template #logo class="items-center">
      <NuxtImg src="/img/logo.png" class="xs:scale-85 md:scale-100" />
    </template>

    <template #panel>
      <UNavigationTree
        :links="mapContentNavigation(navigation)"
        default-open
      />
    </template>

    <template #right>
      <UButton
        :to="config.public.url.telegram"
        target="_blank"
        icon="i-simple-icons-telegram"
        size="sm"
        color="gray"
        variant="ghost"
      />
      <UButton
        :to="config.public.url.github"
        target="_blank"
        icon="i-simple-icons-github"
        size="sm"
        color="gray"
        variant="ghost"
      />
      <UColorModeToggle size="sm" />
    </template>
  </UHeader>
</template>
