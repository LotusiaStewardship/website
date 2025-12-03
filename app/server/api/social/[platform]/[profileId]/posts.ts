import { PlatformConfiguration, type ScriptChunkPlatformUTF8 } from 'lotus-sdk/lib/rank'
import { useRankApi } from '~/composables/useRankApi'

const { getProfilePosts } = useRankApi()

export default defineEventHandler(async (event) => {
  const { platform: platformParam, profileId } = getRouterParams(event)
  const platform = platformParam as ScriptChunkPlatformUTF8

  if (!platform || !profileId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid platform or profileId'
    })
  }

  if (PlatformConfiguration.get(platform) === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid platform'
    })
  }

  const { page, pageSize } = getQuery(event)
  const pageNumber = Number(page) || 1
  const pageSizeNumber = Number(pageSize) || 10

  return await getProfilePosts(
    platform,
    profileId,
    pageNumber,
    pageSizeNumber
  )
})
