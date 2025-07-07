import { PLATFORMS, type ScriptChunkPlatformUTF8 } from '~/submodules/rank-lib'
import { useRankApi } from '~/composables/useRankApi'

const { getProfileRanking } = useRankApi()

export default defineEventHandler(async (event) => {
  const { platform: platformParam, profileId } = getRouterParams(event)
  const platform = platformParam as ScriptChunkPlatformUTF8

  if (!platform || !profileId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid platform or profileId'
    })
  }

  if (PLATFORMS[platform] === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid platform'
    })
  }

  return await getProfileRanking(
    platform,
    profileId
  )
})
