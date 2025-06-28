/* eslint-disable @typescript-eslint/no-namespace */
import type { PageLink } from '@nuxt/ui-pro/types'

export type GoodsPageLink = PageLink & {
  version?: string
}

export type GoodsPage = {
  title: string
  description: string
  links: GoodsPageLink[]
}

export namespace Lotusia {
  export namespace Network {

    export type Name = 'main' | 'test'

    export const Name = {
      main: 'main' as const,
      test: 'test' as const
    }

    export const NameMap: Record<keyof typeof Name, string> = {
      main: 'Mainnet',
      test: 'Testnet'
    }

    /** The targeted block time in milliseconds */
    export const TARGET_BLOCK_TIME = 120_000 // 2 minutes
  }
}

export type { Tx, Block, TxInput, TxOutput } from 'chronik-client'
export type {
  IndexedPostRanking,
  IndexedRanking,
  ScriptChunkSentimentUTF8,
  ScriptChunkPlatformUTF8
} from '~/submodules/rank-lib'

export type GeoIPData = {
  country: string
  city: string
}

export type GeoIPResponse = {
  success: boolean
  status: string
  ip: string
  data: GeoIPData
  type: 'unicast'
}
