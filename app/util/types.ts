import type { PageLink } from '@nuxt/ui-pro/types'

export type GoodsPageLink = PageLink & {
  version?: string
}

export type GoodsPage = {
  title: string
  description: string
  links: GoodsPageLink[]
}
