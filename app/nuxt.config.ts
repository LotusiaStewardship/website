import typescriptPlugin from '@rollup/plugin-typescript'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  vite: {
    build: {
      rollupOptions: {
        // external: ['rank-lib'],
        plugins: [typescriptPlugin()]
      },
      target: 'es2022'
    }
  },
  runtimeConfig: {
    public: {
      url: {
        explorer: 'https://explorer.lotusia.org',
        docs: 'https://docs.givelotus.org',
        github: 'https://github.com/LotusiaStewardship',
        telegram: 'https://t.me/givelotus'
      }
    }
  },
  extends: [process.env.NUXT_UI_PRO_PATH || '@nuxt/ui-pro'],
  modules: [
    '@nuxt/content',
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/fonts',
    '@nuxthq/studio',
    '@vueuse/nuxt'
  ],
  hooks: {
    // Define `@nuxt/ui` components as global to use them in `.md` (feel free to add those you need)
    'components:extend': (components) => {
      const globals = components.filter(c => ['UButton'].includes(c.pascalName))

      globals.forEach(c => c.global = true)
    }
  },
  ui: {
    icons: ['flag', 'heroicons', 'mdi', 'fluent-emoji-high-contrast', 'simple-icons']
  },
  routeRules: {
    '/api/search.json': { prerender: true }
  },
  devtools: {
    enabled: true
  },
  typescript: {
    strict: false
  },
  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },
  css: ['~/assets/css/main.css']
})
