export const CHRONIK_API_URL = process.env.NUXT_URL_CHRONIK
export const RANK_API_URL = process.env.NUXT_URL_RANK
// export const NODE_API_URL = 'https://explorer.lotusia.org/api'
export const NODE_GEOIP_URL = 'https://api.sefinek.net/api/v2/geoip'

export const LotusRPC = {
  address: process.env.NUXT_LOTUS_RPC_HOST,
  port: process.env.NUXT_LOTUS_RPC_PORT,
  user: process.env.NUXT_LOTUS_RPC_USER,
  password: process.env.NUXT_LOTUS_RPC_PASSWORD
}

// Used for correct address display based on configured network
export const Network: 'mainnet' | 'testnet'
  = process.env.NUXT_LOTUS_RPC_PORT === '11604' ? 'testnet' : 'mainnet'

// Used to filter addresses in API requests
export const NetworkCharacter: '_' | 'T'
  = process.env.NUXT_LOTUS_RPC_PORT === '11604' ? 'T' : '_'

export const PlatformURL = {
  twitter: {
    root: 'https://x.com',
    profile(profileId: string) {
      return `${this.root}/${profileId}`
    },
    post(profileId: string, postId: string) {
      return `${this.root}/${profileId}/status/${postId}`
    }
  }
}

export const Addresses = {
  /** Community Fund address for engagement rewards and others */
  communityFund: 'lotus_16PSJLgY94X7B863uGMgurEjxiXyqhetkKT84F52Z',
  /** Minerfund addresses controlled by the Lotusian Stewardship */
  Stewardship: {
    judges: 'lotus_16PSJMaps9sQg7aBQgyY1RdHb2fZYdmWhQPbgus75',
    ruth: 'lotus_16PSJPi88MtH34Ti3dZza4MFRF9XUVd3fKc6Ec3TV',
    firstSamuel: 'lotus_16PSJKi4ucDByLHn3mTQaBijiNZmczAdALVDGS53V'
    // TODO: add secondSamuel address array
  }
}

export const EXPLORER_TABLE_MAX_ROWS = 40

export enum PlatformIcon {
  twitter = 'i-mdi-twitter-circle',
  discord = 'i-mdi-discord-circle',
  telegram = 'i-mdi-telegram-circle',
  reddit = 'i-mdi-reddit-circle',
  youtube = 'i-mdi-youtube-circle',
  tiktok = 'i-mdi-tiktok-circle',
  instagram = 'i-mdi-instagram-circle'
}
