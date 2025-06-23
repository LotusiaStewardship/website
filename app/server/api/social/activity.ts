import { useRankApi } from '~/composables/useRankApi'

const { getVoteActivity } = useRankApi()

export default defineEventHandler(async (event) => {
  const { page, pageSize } = getQuery(event)
  const pageNum = Number(page) || 1
  const pageSizeNum = Number(pageSize) || 10
  try {
    return await getVoteActivity(pageNum, pageSizeNum)
  } catch (e) {
    return { votes: [], numPages: 0 }
  }
})
