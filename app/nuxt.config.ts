// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      url: {
        explorer: 'https://explorer.lotusia.org',
        docs: 'https://docs.givelotus.org',
        github: 'https://github.com/LotusiaStewardship',
        telegram: 'https://t.me/givelotus'
      }
    },
    // Lotus API configuration
    url: {
      chronik: process.env.NUXT_URL_CHRONIK,
      rank: process.env.NUXT_URL_RANK
    },
    // Lotus JSON-RPC configuration
    rpc: {
      host: process.env.NUXT_LOTUS_RPC_HOST,
      port: process.env.NUXT_LOTUS_RPC_PORT,
      user: process.env.NUXT_LOTUS_RPC_USER,
      password: process.env.NUXT_LOTUS_RPC_PASSWORD
    }
  },
  extends: [process.env.NUXT_UI_PRO_PATH || '@nuxt/ui-pro'],
  modules: [
    '@nuxt/ui',
    '@nuxt/content',
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/fonts',
    '@nuxthq/studio',
    '@vueuse/nuxt',
    'nuxt-site-config'
  ],
  hooks: {
    // Define `@nuxt/ui` components as global to use them in `.md` (feel free to add those you need)
    'components:extend': (components) => {
      const globals = components.filter(c => ['UButton'].includes(c.pascalName))

      globals.forEach(c => (c.global = true))
    }
  },
  ui: {
    icons: [
      'flag',
      'heroicons',
      'mdi',
      'fluent-emoji-high-contrast',
      'simple-icons'
    ]
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
