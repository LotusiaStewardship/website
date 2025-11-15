import { PlatformConfiguration, type ScriptChunkPlatformUTF8 } from 'lotus-sdk'
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

  if (PlatformConfiguration.get(platform) === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid platform'
    })
  }

  return await getProfileRanking(platform, profileId)
})
