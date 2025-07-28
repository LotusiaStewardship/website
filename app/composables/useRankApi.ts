import type {
  ScriptChunkPlatformUTF8,
  IndexedPostRanking,
  IndexedRanking,
  ScriptChunkSentimentUTF8
} from '~/submodules/rank-lib'
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

type ProfileData = IndexedRanking & {
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
  firstSeen: string // bigint to string
  timestamp: string // bigint to string
  sats: string // bigint to string
}

type ProfileVoteActivity = {
  votes: ProfileRankTransactionAPI[]
  numPages: number
}

type ProfileRankTransactionAPI = {
  txid: string
  sentiment: ScriptChunkSentimentUTF8
  timestamp: string // bigint to string
  sats: string // bigint to string
  post: {
    id: string
    ranking: string
  }
}
/**
 * API response for `apiGetProfiles`
 */
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
/**
 * API response for `apiGetPlatformProfilePosts`
 */
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

export const useRankApi = () => {
  const getProfiles = async (
    page: number = 1,
    pageSize: number = 10
  ): Promise<ProfilesAPI> => {
    const url = `${RANK_API_URL}/profiles/${page}/${pageSize}`
    const response = await fetch(url)
    return (await response.json()) as ProfilesAPI
  }
  /**
   *
   * @param platform
   * @param profileId
   * @param page
   * @param pageSize
   * @returns
   */
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
  /**
   * Get the vote activity for all profiles
   * @param page - The page number
   * @param pageSize - The number of items per page
   * @returns The vote activity for all profiles
   */
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
  ): Promise<IndexedPostRanking> => {
    const url = `${RANK_API_URL}/${platform}/${profileId}/${postId}`
    const response = await fetch(url)
    return (await response.json()) as IndexedPostRanking
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
        // Generate 30 days of empty data
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
        // Generate 30 days of empty data
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
      // Generate 30 days of empty data
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
        // Generate 90 days of empty data
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
        // Generate 90 days of empty data
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
      // Generate 90 days of empty data
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
        // Return empty data
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

  // Search for profiles across platforms
  const searchProfiles = async (query: string): Promise<IndexedRanking[]> => {
    if (!query || query.trim().length < 2) return []
    const url = `${RANK_API_URL}/search/profile/${query}`
    try {
      const response = await fetch(url)
      return (await response.json()) as IndexedRanking[]
    } catch (error) {
      console.error('Error searching profiles:', error)
      return []
    }
  }

  return {
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
}
