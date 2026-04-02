export default defineEventHandler(async event => {
  const { page, pageSize } = getQuery(event)
  const pageNum = Number(page) || 1
  const pageSizeNum = Number(pageSize) || 10
  const { $rankApi } = useNitroApp()
  return await $rankApi.getProfiles(pageNum, pageSizeNum)
})
