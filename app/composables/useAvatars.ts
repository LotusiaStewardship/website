import type { ScriptChunkPlatformUTF8 } from 'rank-lib'
import {
  getProfileAvatar,
  getProfileInitials,
  getProfileColor
} from '~/utils/avatar'

/**
 * Composable for handling profile avatars with caching
 */
export function useAvatars() {
  // Cache for avatar URLs to avoid repeated requests
  const avatarCache = ref<Record<string, string>>({})
  // Cache for loading states
  const loadingAvatars = ref<Record<string, boolean>>({})

  /**
   * Get an avatar URL for a profile, with caching
   *
   * @param platform The platform (e.g., 'twitter')
   * @param profileId The profile ID on the platform
   * @returns Object with avatar URL, loading state, and fallback props
   */
  async function getAvatar(platform: string, profileId: string) {
    const cacheKey = `${platform}:${profileId}`

    // Return from cache if available
    if (avatarCache.value[cacheKey]) {
      return {
        src: avatarCache.value[cacheKey],
        loading: false,
        initials: getProfileInitials(profileId),
        color: getProfileColor(profileId)
      }
    }

    // Set loading state
    loadingAvatars.value[cacheKey] = true

    try {
      const avatarUrl = await getProfileAvatar(platform, profileId)
      if (avatarUrl) {
        // Cache the result
        avatarCache.value[cacheKey] = avatarUrl
      }

      loadingAvatars.value[cacheKey] = false

      return {
        src: avatarUrl,
        loading: false,
        initials: getProfileInitials(profileId),
        color: getProfileColor(profileId)
      }
    } catch (error) {
      console.error('Error fetching avatar:', error)
      loadingAvatars.value[cacheKey] = false

      // Return fallback properties
      return {
        src: null,
        loading: false,
        initials: getProfileInitials(profileId),
        color: getProfileColor(profileId)
      }
    }
  }

  /**
   * Check if avatar is currently loading
   *
   * @param platform The platform (e.g., 'twitter')
   * @param profileId The profile ID on the platform
   * @returns Boolean indicating if avatar is loading
   */
  function isAvatarLoading(
    platform: ScriptChunkPlatformUTF8,
    profileId: string
  ) {
    const cacheKey = `${platform}:${profileId}`
    return loadingAvatars.value[cacheKey] || false
  }

  /**
   * Preload avatars for a list of profiles
   *
   * @param profiles Array of profile objects with platform and profileId
   */
  async function preloadAvatars(
    profiles: Array<{ platform: string, profileId: string }>
  ) {
    profiles.forEach((profile) => {
      getAvatar(profile.platform, profile.profileId)
    })
  }

  return {
    // state
    avatarCache,
    loadingAvatars,
    // functions
    getAvatar,
    isAvatarLoading,
    preloadAvatars
  }
}
