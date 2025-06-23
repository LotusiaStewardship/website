import { useRankApi } from '~/composables/useRankApi'

const { getProfiles } = useRankApi()

export default defineEventHandler(async (event) => {
  const { page, pageSize } = getQuery(event)
  const pageNum = Number(page) || 1
  const pageSizeNum = Number(pageSize) || 10
  return await getProfiles(pageNum, pageSizeNum)
})
