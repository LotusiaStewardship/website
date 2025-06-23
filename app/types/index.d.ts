import type { ParsedContent } from '@nuxt/content/dist/runtime/types'

export type {
  IndexedPostRanking,
  IndexedRanking,
  ScriptChunkSentimentUTF8,
  ScriptChunkPlatformUTF8
} from 'rank-lib'

export interface BlogPost extends ParsedContent {
  title: string
  description: string
  date: string
  image?: HTMLImageElement
  badge?: Badge
  authors?: ({
    name: string
    description?: string
    avatar?: Avatar
  } & Link)[]
}
// API Response type that matches the backend response structure
export type APIResponse = {
  platform: ScriptChunkPlatformUTF8
  profileId: string
  postId?: string
  total: {
    ranking: string
    votesPositive: number
    votesNegative: number
  }
  changed: {
    ranking: string
    rate: string
    votesPositive: number
    votesNegative: number
  }
  votesTimespan: Array<string>
}

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}

export type {
  RankAPIParams,
  IndexedRanking,
  IndexedPostRanking,
  PostMeta,
  RankOutput,
  RankTransaction,
  Block,
  RankTarget,
  Profile,
  ProfileMap,
  AuthorizationData,
  LogEntry
} from 'rank-lib'

export type WalletActivity = {
  date: string
  timestamp: bigint
  txid: string
  scriptPayload: string
  profileId: string | null
  postId: string | null
  sentiment: string
  sats: bigint
  height: number
}

export type WalletActivitySummary = {
  scriptPayload: string
  totalVotes: number
  totalSats: string
  lastSeen: string
  firstSeen: string
}

export type Timespan =
  | 'now'
  | 'today'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'all'

export type RankActivityResult = {
  totalVotes: number
  totalPayoutsSent: number
  totalPayoutAmount: number
}

export type WalletSummaryResult = {
  totalVotes: number
  totalUpvotes: number
  totalDownvotes: number
  totalUniqueWallets: number
  totalSatsBurned: number
}
