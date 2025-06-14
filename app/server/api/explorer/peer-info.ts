import { NODE_GEOIP_URL } from '~/utils/constants'
import type { GeoIPResponse, Lotusia } from '~/utils/types'
import { useNodeApi } from '~/composables/useNodeApi'

const { getPeerInfo } = useNodeApi()
const runtimeCache = new Map<string, GeoIPResponse>()

export default defineEventHandler(async () => {
  const peerInfo = await getPeerInfo()
  const peers: Lotusia.Network.PeerInfo[] = []
  for (const peer of peerInfo) {
    // only match IPv4 addresses
    if (!peer.addr.match(/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/)) {
      continue
    }
    // skip private IP addresses
    if (peer.addr.match(/^10\./) || peer.addr.match(/^172\.16\./) || peer.addr.match(/^192\.168\./)) {
      continue
    }
    const ip = peer.addr.split(':')[0]
    if (runtimeCache.has(ip)) {
      peers.push({
        ...peer,
        addr: ip,
        geoip: runtimeCache.get(ip)!.data
      })
      continue
    }
    const response = await fetch(`${NODE_GEOIP_URL}/${ip}`)
    const json = await response.json() as GeoIPResponse
    console.log('GeoIP response for IP', ip, json)
    if (json.success) {
      runtimeCache.set(ip, json)
      peers.push({
        ...peer,
        addr: ip,
        geoip: json.data
      })
    }
  }
  return peers
})
