/**
 * Utility functions for handling user avatars
 */
import type { ScriptChunkPlatformUTF8 } from 'rank-lib'

/**
 * Get Twitter/X profile image URL through unavatar.io
 *
 * @param profileId Twitter/X username
 * @returns URL to the profile image
 */
const getTwitterProfileImageUrl = (profileId: string): string => {
  // Use unavatar.io with the updated X endpoint (Twitter has been rebranded to X)
  // Tests show this is now returning actual profile images and not placeholders
  return `https://unavatar.io/x/${profileId}`

  // Alternative options if the above doesn't work:
  // return `https://corsproxy.io/?${encodeURIComponent(
  //   `https://unavatar.io/x/${profileId}`,
  // )}`
}

/**
 * Get a fallback avatar URL using Gravatar's default avatar service
 *
 * @param profileId The profile ID to generate avatar for
 * @returns URL to a generated avatar
 */
const getFallbackAvatarUrl = (profileId: string): string => {
  // Use Gravatar's identicon service which generates consistent
  // avatars based on the hash of the input string
  // This doesn't require any API keys and works reliably

  // Create a simple hash from the profileId for use with Gravatar
  // Not a true MD5 but gives us a consistent hex string for the avatar
  const simpleHash = Array.from(profileId)
    .reduce((hash, char) => {
      return ((hash << 5) - hash + char.charCodeAt(0)) | 0
    }, 0)
    .toString(16)
    .replace('-', '') // Remove negative sign if present

  // Pad the hash to ensure it's at least 32 chars (MD5 length)
  const paddedHash = simpleHash.padStart(32, '0')

  // Use Gravatar with identicon (generated geometric pattern)
  return `https://www.gravatar.com/avatar/${paddedHash}?s=80&d=identicon&r=g`
}

/**
 * Generate an initial-based avatar as a data URL
 *
 * @param initials Two-letter initials to display
 * @param backgroundColor Background color for the avatar
 * @param textColor Text color for the initials
 * @returns Data URL of the generated avatar
 */
const generateInitialsAvatar = (
  initials: string,
  backgroundColor: string = '#3498db',
  textColor: string = '#ffffff',
  size: number = 80
): string => {
  if (typeof document === 'undefined') {
    return ''
  }

  // Create a canvas element
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return ''
  }

  // Draw background
  ctx.fillStyle = backgroundColor
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()

  // Draw text
  ctx.fillStyle = textColor
  ctx.font = `bold ${size / 2.5}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initials, size / 2, size / 2)

  // Return as data URL
  return canvas.toDataURL('image/png')
}

/**
 * Resize and compress an image locally
 *
 * @param imageUrl URL of the image to resize
 * @param size Desired size (width/height)
 * @returns Promise resolving to a data URL of the resized image
 */
const resizeAndCompressImage = async (
  imageUrl: string,
  size: number = 80
): Promise<string> => {
  try {
    // Create an image element to load the image
    const img = new Image()

    // Create a promise to handle the image loading
    const imageLoadPromise = new Promise<HTMLImageElement>(
      (resolve, reject) => {
        img.onload = () => resolve(img)
        img.onerror = () =>
          reject(new Error(`Failed to load image: ${imageUrl}`))

        // Set crossOrigin to anonymous to avoid CORS issues when drawing to canvas
        img.crossOrigin = 'anonymous'
        img.src = imageUrl
      }
    )

    // Wait for the image to load
    const loadedImg = await imageLoadPromise

    // Create a canvas for resizing
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    // Get the canvas context and draw the resized image
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Could not get canvas context')
    }

    // Draw the image with proper sizing
    // Calculate dimensions to maintain aspect ratio
    const aspectRatio = loadedImg.width / loadedImg.height
    let drawWidth = size
    let drawHeight = size
    let offsetX = 0
    let offsetY = 0

    if (aspectRatio > 1) {
      // Image is wider than tall
      drawWidth = size
      drawHeight = size / aspectRatio
      offsetY = (size - drawHeight) / 2
    } else {
      // Image is taller than wide
      drawHeight = size
      drawWidth = size * aspectRatio
      offsetX = (size - drawWidth) / 2
    }

    // Draw with a nice smooth quality
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(loadedImg, offsetX, offsetY, drawWidth, drawHeight)

    // Convert to data URL with compression (0.8 quality JPEG)
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch (error) {
    console.error('Error resizing image:', error)
    throw error
  }
}

/**
 * Get avatar URL for a profile based on platform
 *
 * @param platform The platform (e.g., 'twitter')
 * @param profileId The profile ID on the platform
 * @returns Promise resolving to the avatar URL or null if not found
 */
export const getProfileAvatar = async (
  platform: string,
  profileId: string
): Promise<string | null> => {
  // Default avatar to use when no avatar is found
  const defaultAvatar = '/images/default-avatar.svg'

  // Generate avatar initials for fallback
  const initials = getProfileInitials(profileId)

  // Skip external image loading if we're not in a browser
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return getFallbackAvatarUrl(profileId)
  }

  try {
    if (platform.toLowerCase() === 'twitter') {
      // First try: Use unavatar.io service
      try {
        const twitterImageUrl = getTwitterProfileImageUrl(profileId)
        try {
          const resizedImage = await resizeAndCompressImage(twitterImageUrl)
          return resizedImage
        } catch (resizeError) {
          console.warn(
            'Error resizing Twitter image via unavatar:',
            resizeError
          )
          // Return the unresized URL directly
          return twitterImageUrl
        }
      } catch (twitterError) {
        console.warn('Error fetching Twitter image via unavatar:', twitterError)
        // Continue to fallbacks
      }

      // Second try: Use Gravatar as fallback
      try {
        const fallbackUrl = getFallbackAvatarUrl(profileId)
        try {
          const resizedGravatar = await resizeAndCompressImage(fallbackUrl)
          return resizedGravatar
        } catch (gravError) {
          console.warn('Error with Gravatar fallback:', gravError)
          return fallbackUrl
        }
      } catch (fallbackError) {
        console.warn('Error with fallback avatar:', fallbackError)
      }

      // Last try: Generate canvas-based avatar with initials (final fallback)
      try {
        // Generate a background color based on the profile ID for consistency
        const colors = [
          '#3498db',
          '#e74c3c',
          '#2ecc71',
          '#f39c12',
          '#9b59b6',
          '#1abc9c'
        ]
        const colorIndex = Math.abs(
          profileId.split('').reduce((a, b) => {
            return a + b.charCodeAt(0)
          }, 0) % colors.length
        )

        return generateInitialsAvatar(initials, colors[colorIndex])
      } catch (canvasError) {
        console.warn('Canvas avatar generation failed:', canvasError)
        // Fall through to the default avatar
      }
    }

    // For other platforms, just use Gravatar
    return getFallbackAvatarUrl(profileId)
  } catch (error) {
    console.error('Error in avatar generation:', error)
    // Last resort: return default avatar
    return defaultAvatar
  }
}

/**
 * Generate initials from a profile ID for use in avatar fallbacks
 *
 * @param profileId The profile ID to generate initials from
 * @returns Two-letter initials based on the profile ID
 */
export const getProfileInitials = (profileId: string): string => {
  if (!profileId) return '??'
  return profileId.substring(0, 2).toUpperCase()
}

/**
 * Get a color for an avatar based on the profile ID
 * This provides consistent colors for the same profile
 *
 * @param profileId The profile ID to derive color from
 * @returns A color name from the theme
 */
export const getProfileColor = (profileId: string): string => {
  const colors = [
    'primary',
    'success',
    'info',
    'warning',
    'danger',
    'orange',
    'purple',
    'indigo'
  ]

  // Simple hash function to get consistent color for the same profile ID
  let hash = 0
  for (let i = 0; i < profileId.length; i++) {
    hash = profileId.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Get a positive number for the index
  const index = Math.abs(hash) % colors.length
  return colors[index]
}
