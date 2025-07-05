import type { ScriptChunkPlatformUTF8 } from '~/submodules/rank-lib'
import { useRankApi } from '~/composables/useRankApi'

const { getProfilePosts } = useRankApi()

export default defineEventHandler(async (event) => {
  const { platform, profileId } = getRouterParams(event)
  const { page, pageSize } = getQuery(event)

  if (!platform || !profileId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid platform or profileId'
    })
  }

  const pageNumber = Number(page) || 1
  const pageSizeNumber = Number(pageSize) || 10

  const posts = await getProfilePosts(
    platform as ScriptChunkPlatformUTF8,
    profileId,
    pageNumber,
    pageSizeNumber
  )
  return posts
})
