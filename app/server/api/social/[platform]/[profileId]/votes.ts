import { useRankApi } from '~/composables/useRankApi'

const { getProfileRankTransactions } = useRankApi()

export default defineEventHandler(async (event) => {
  const { platform, profileId } = getRouterParams(event)
  const { page, pageSize } = getQuery(event)
  const pageNum = Number(page) || 1
  const pageSizeNum = Number(pageSize) || 10
  const response = await getProfileRankTransactions(
    platform,
    profileId,
    pageNum,
    pageSizeNum
  )
  return response
})
