import { useRankApi } from '~/composables/useRankApi'

const { getProfileRanking } = useRankApi()

export default defineEventHandler(async (event) => {
  const { platform, profileId } = getRouterParams(event)
  return await getProfileRanking(platform, profileId)
})
