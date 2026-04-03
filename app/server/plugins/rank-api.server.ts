import type { ProfileAPI, PostAPI } from 'xpi-ts/lib/rank/api'
import type {
  ScriptChunkPlatformUTF8,
  ScriptChunkSentimentUTF8
} from 'xpi-ts/lib/lokad'
import type {
  APIResponse,
  WalletActivity,
  WalletActivitySummary,
  Timespan,
  RankActivityResult,
  WalletSummaryResult
} from '~/types'
import { RANK_API_URL } from '~/utils/constants'

type VoterDetails = {
  ranking: string
  votesPositive: number
  votesNegative: number
  votesNeutral: number
}

type ProfileData = ProfileAPI & {
  voters: VoterDetails[]
}

type VoteActivity = {
  votes: RankTransactionAPI[]
  numPages: number
}

type RankTransactionAPI = {
  platform: ScriptChunkPlatformUTF8
  profileId: string
  postId: string
  scriptPayload: string
  txid: string
  sentiment: ScriptChunkSentimentUTF8
  firstSeen: string
  timestamp: string
  sats: string
}

type ProfileVoteActivity = {
  votes: ProfileRankTransactionAPI[]
  numPages: number
}

type ProfileRankTransactionAPI = {
  txid: string
  sentiment: ScriptChunkSentimentUTF8
  timestamp: string
  sats: string
  post: {
    id: string
    ranking: string
  }
}

type ProfilesAPI = {
  profiles: Array<{
    id: string
    platform: ScriptChunkPlatformUTF8
    ranking: string
    satsPositive: string
    satsNegative: string
    votesPositive: number
    votesNegative: number
  }>
  numPages: number
}

type ProfilePostsAPI = {
  posts: Array<{
    id: string
    ranking: string
    satsPositive: string
    satsNegative: string
    votesPositive: number
    votesNegative: number
  }>
  numPages: number
}

export default defineNitroPlugin((nitroApp) => {
  const getProfiles = async (
    page: number = 1,
    pageSize: number = 10
  ): Promise<ProfilesAPI> => {
    const url = `${RANK_API_URL}/profiles/${page}/${pageSize}`
    const response = await fetch(url)
    return (await response.json()) as ProfilesAPI
  }

  const getProfilePosts = async (
    platform: ScriptChunkPlatformUTF8,
    profileId: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<ProfilePostsAPI> => {
    const url = `${RANK_API_URL}/${platform}/${profileId}/posts/${page}/${pageSize}`
    const response = await fetch(url)
    return (await response.json()) as ProfilePostsAPI
  }

  const getVoteActivity = async (
    page: number = 1,
    pageSize: number = 10
  ): Promise<VoteActivity> => {
    const url = `${RANK_API_URL}/votes/${page}/${pageSize}`
    const response = await fetch(url)
    return (await response.json()) as VoteActivity
  }

  const getTopRankedProfiles = async (
    timespan: Timespan = 'today'
  ): Promise<APIResponse[]> => {
    const url = `${RANK_API_URL}/stats/profiles/top-ranked/${timespan}`
    const response = await fetch(url)
    return (await response.json()) as APIResponse[]
  }

  const getLowestRankedProfiles = async (
    timespan: Timespan = 'today'
  ): Promise<APIResponse[]> => {
    const url = `${RANK_API_URL}/stats/profiles/lowest-ranked/${timespan}`
    const response = await fetch(url)
    return (await response.json()) as APIResponse[]
  }

  const getTopRankedPosts = async (
    timespan: Timespan = 'today'
  ): Promise<APIResponse[]> => {
    const url = `${RANK_API_URL}/stats/posts/top-ranked/${timespan}`
    const response = await fetch(url)
    return (await response.json()) as APIResponse[]
  }

  const getLowestRankedPosts = async (
    timespan: Timespan = 'today'
  ): Promise<APIResponse[]> => {
    const url = `${RANK_API_URL}/stats/posts/lowest-ranked/${timespan}`
    const response = await fetch(url)
    return (await response.json()) as APIResponse[]
  }

  const getProfileRanking = async (
    platform: ScriptChunkPlatformUTF8,
    profileId: string
  ): Promise<ProfileData> => {
    const url = `${RANK_API_URL}/${platform}/${profileId}`
    const response = await fetch(url)
    return (await response.json()) as ProfileData
  }

  const getProfileRankTransactions = async (
    platform: ScriptChunkPlatformUTF8,
    profileId: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<ProfileVoteActivity> => {
    const url = `${RANK_API_URL}/txs/${platform}/${profileId}/${page}/${pageSize}`
    const response = await fetch(url)
    return (await response.json()) as ProfileVoteActivity
  }

  const getPostRanking = async (
    platform: ScriptChunkPlatformUTF8,
    profileId: string,
    postId: string
  ): Promise<PostAPI> => {
    const url = `${RANK_API_URL}/${platform}/${profileId}/${postId}`
    const response = await fetch(url)
    return (await response.json()) as PostAPI
  }

  const getWalletActivity = async (
    scriptPayload: string,
    startTime?: string,
    endTime?: string
  ): Promise<WalletActivity[]> => {
    const url = `${RANK_API_URL}/wallet/${scriptPayload}${
      startTime ? `/${startTime}` : ''
    }${endTime ? `/${endTime}` : ''}`
    const response = await fetch(url)
    return await response.json()
  }

  const getWalletActivitySummary = async (
    scriptPayload: string,
    startTime?: Timespan,
    endTime?: Timespan
  ): Promise<WalletActivitySummary> => {
    const url = `${RANK_API_URL}/wallet/summary/${scriptPayload}${
      startTime ? `/${startTime}` : ''
    }${endTime ? `/${endTime}` : ''}`
    const response = await fetch(url)
    return await response.json()
  }

  const getWeeklyWalletActivity = async (): Promise<RankActivityResult[]> => {
    const url = `${RANK_API_URL}/charts/wallet/activity/week`
    const response = await fetch(url)
    return await response.json()
  }

  const getMonthlyWalletActivity = async (): Promise<RankActivityResult[]> => {
    try {
      const url = `${RANK_API_URL}/charts/wallet/activity/month`
      const response = await fetch(url)

      if (!response.ok) {
        console.warn(
          'Monthly wallet activity endpoint returned error:',
          response.status
        )
        return Array(30)
          .fill(0)
          .map(() => ({
            totalVotes: 0,
            totalPayoutsSent: 0,
            totalPayoutAmount: 0,
            broadcastWorkflowId: '',
            broadcastRunId: ''
          }))
      }

      const data = await response.json()
      if (!Array.isArray(data) || data.length === 0) {
        return Array(30)
          .fill(0)
          .map(() => ({
            totalVotes: 0,
            totalPayoutsSent: 0,
            totalPayoutAmount: 0
          }))
      }
      return data
    } catch (error) {
      console.error('Failed to fetch monthly wallet activity:', error)
      return Array(30)
        .fill(0)
        .map(() => ({
          totalVotes: 0,
          totalPayoutsSent: 0,
          totalPayoutAmount: 0
        }))
    }
  }

  const getQuarterlyWalletActivity = async (): Promise<
    RankActivityResult[]
  > => {
    try {
      const url = `${RANK_API_URL}/charts/wallet/activity/quarter`
      const response = await fetch(url)

      if (!response.ok) {
        console.warn(
          'Quarterly wallet activity endpoint returned error:',
          response.status
        )
        return Array(90)
          .fill(0)
          .map(() => ({
            totalVotes: 0,
            totalPayoutsSent: 0,
            totalPayoutAmount: 0,
            broadcastWorkflowId: '',
            broadcastRunId: ''
          }))
      }

      const data = await response.json()
      if (!Array.isArray(data) || data.length === 0) {
        return Array(90)
          .fill(0)
          .map(() => ({
            totalVotes: 0,
            totalPayoutsSent: 0,
            totalPayoutAmount: 0
          }))
      }
      return data
    } catch (error) {
      console.error('Failed to fetch quarterly wallet activity:', error)
      return Array(90)
        .fill(0)
        .map(() => ({
          totalVotes: 0,
          totalPayoutsSent: 0,
          totalPayoutAmount: 0
        }))
    }
  }

  const getWeeklyWalletSummary = async (): Promise<WalletSummaryResult> => {
    try {
      const url = `${RANK_API_URL}/charts/wallet/summary/week`
      const response = await fetch(url)

      if (!response.ok) {
        console.warn(
          'Weekly wallet summary endpoint returned error:',
          response.status
        )
        return {
          totalVotes: 0,
          totalUpvotes: 0,
          totalDownvotes: 0,
          totalUniqueWallets: 0,
          totalSatsBurned: 0
        }
      }

      const data = await response.json()
      if (!data) {
        return {
          totalVotes: 0,
          totalUpvotes: 0,
          totalDownvotes: 0,
          totalUniqueWallets: 0,
          totalSatsBurned: 0
        }
      }
      return data
    } catch (error) {
      console.error('Failed to fetch weekly wallet summary:', error)
      return {
        totalVotes: 0,
        totalUpvotes: 0,
        totalDownvotes: 0,
        totalUniqueWallets: 0,
        totalSatsBurned: 0
      }
    }
  }

  const getMonthlyWalletSummary = async (): Promise<WalletSummaryResult> => {
    try {
      const url = `${RANK_API_URL}/charts/wallet/summary/month`
      const response = await fetch(url)

      if (!response.ok) {
        console.warn(
          'Monthly wallet summary endpoint returned error:',
          response.status
        )
        return {
          totalVotes: 0,
          totalUpvotes: 0,
          totalDownvotes: 0,
          totalUniqueWallets: 0,
          totalSatsBurned: 0
        }
      }

      const data = await response.json()
      if (!data) {
        return {
          totalVotes: 0,
          totalUpvotes: 0,
          totalDownvotes: 0,
          totalUniqueWallets: 0,
          totalSatsBurned: 0
        }
      }
      return data
    } catch (error) {
      console.error('Failed to fetch monthly wallet summary:', error)
      return {
        totalVotes: 0,
        totalUpvotes: 0,
        totalDownvotes: 0,
        totalUniqueWallets: 0,
        totalSatsBurned: 0
      }
    }
  }

  const getQuarterlyWalletSummary = async (): Promise<WalletSummaryResult> => {
    try {
      const url = `${RANK_API_URL}/charts/wallet/summary/quarter`
      const response = await fetch(url)

      if (!response.ok) {
        console.warn(
          'Quarterly wallet summary endpoint returned error:',
          response.status
        )
        return {
          totalVotes: 0,
          totalUpvotes: 0,
          totalDownvotes: 0,
          totalUniqueWallets: 0,
          totalSatsBurned: 0
        }
      }

      const data = await response.json()
      if (!data) {
        return {
          totalVotes: 0,
          totalUpvotes: 0,
          totalDownvotes: 0,
          totalUniqueWallets: 0,
          totalSatsBurned: 0
        }
      }
      return data
    } catch (error) {
      console.error('Failed to fetch quarterly wallet summary:', error)
      return {
        totalVotes: 0,
        totalUpvotes: 0,
        totalDownvotes: 0,
        totalUniqueWallets: 0,
        totalSatsBurned: 0
      }
    }
  }

  const searchProfiles = async (query: string): Promise<ProfileAPI[]> => {
    if (!query || query.trim().length < 2) return []
    const url = `${RANK_API_URL}/search/profile/${query}`
    try {
      const response = await fetch(url)
      return (await response.json()) as ProfileAPI[]
    } catch (error) {
      console.error('Error searching profiles:', error)
      return []
    }
  }

  nitroApp.$rankApi = {
    getProfiles,
    getProfilePosts,
    getVoteActivity,
    getTopRankedProfiles,
    getLowestRankedProfiles,
    getTopRankedPosts,
    getLowestRankedPosts,
    getProfileRanking,
    getProfileRankTransactions,
    getPostRanking,
    getWalletActivity,
    getWalletActivitySummary,
    getWeeklyWalletActivity,
    getMonthlyWalletActivity,
    getQuarterlyWalletActivity,
    getWeeklyWalletSummary,
    getMonthlyWalletSummary,
    getQuarterlyWalletSummary,
    searchProfiles
  }
})

declare module 'nitropack' {
  interface NitroApp {
    $rankApi: {
      getProfiles: (page?: number, pageSize?: number) => Promise<ProfilesAPI>
      getProfilePosts: (
        platform: ScriptChunkPlatformUTF8,
        profileId: string,
        page?: number,
        pageSize?: number,
      ) => Promise<ProfilePostsAPI>
      getVoteActivity: (
        page?: number,
        pageSize?: number,
      ) => Promise<VoteActivity>
      getTopRankedProfiles: (timespan?: Timespan) => Promise<APIResponse[]>
      getLowestRankedProfiles: (timespan?: Timespan) => Promise<APIResponse[]>
      getTopRankedPosts: (timespan?: Timespan) => Promise<APIResponse[]>
      getLowestRankedPosts: (timespan?: Timespan) => Promise<APIResponse[]>
      getProfileRanking: (
        platform: ScriptChunkPlatformUTF8,
        profileId: string,
      ) => Promise<ProfileData>
      getProfileRankTransactions: (
        platform: ScriptChunkPlatformUTF8,
        profileId: string,
        page?: number,
        pageSize?: number,
      ) => Promise<ProfileVoteActivity>
      getPostRanking: (
        platform: ScriptChunkPlatformUTF8,
        profileId: string,
        postId: string,
      ) => Promise<PostAPI>
      getWalletActivity: (
        scriptPayload: string,
        startTime?: string,
        endTime?: string,
      ) => Promise<WalletActivity[]>
      getWalletActivitySummary: (
        scriptPayload: string,
        startTime?: Timespan,
        endTime?: Timespan,
      ) => Promise<WalletActivitySummary>
      getWeeklyWalletActivity: () => Promise<RankActivityResult[]>
      getMonthlyWalletActivity: () => Promise<RankActivityResult[]>
      getQuarterlyWalletActivity: () => Promise<RankActivityResult[]>
      getWeeklyWalletSummary: () => Promise<WalletSummaryResult>
      getMonthlyWalletSummary: () => Promise<WalletSummaryResult>
      getQuarterlyWalletSummary: () => Promise<WalletSummaryResult>
      searchProfiles: (query: string) => Promise<ProfileAPI[]>
    }
  }
}
