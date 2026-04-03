export default defineEventHandler(async (event) => {
  const { page, pageSize } = getQuery(event)
  const pageNum = Number(page) || 1
  const pageSizeNum = Number(pageSize) || 10
  const { $rankApi } = useNitroApp()
  try {
    return await $rankApi.getVoteActivity(pageNum, pageSizeNum)
  } catch (e) {
    return { votes: [], numPages: 0 }
  }
})
