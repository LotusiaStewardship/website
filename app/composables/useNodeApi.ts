import { NODE_API_URL } from '~/utils/constants'
import type { Lotusia } from '~/utils/types'

enum NodeAPI {
  difficulty = 'getdifficulty',
  networkhashps = 'getnetworkhashps',
  mininginfo = 'getmininginfo',
  connectioncount = 'getconnectioncount',
  blockcount = 'getblockcount',
  peerinfo = 'getpeerinfo',
  txoutsetinfo = 'gettxoutsetinfo',
  verifymessage = 'verifymessage'
}

export const useNodeApi = () => {
  /**
   * Get the mining info from the node
   * @returns MiningInfo
   */
  const getMiningInfo = async (): Promise<Lotusia.Network.MiningInfo> => {
    const response = await fetch(`${NODE_API_URL}/${NodeAPI.mininginfo}`)
    return await response.json()
  }

  const getNetworkInfo = async (): Promise<Lotusia.Network.NetworkInfo> => {
    const response = await fetch(`${NODE_API_URL}/${NodeAPI.mininginfo}`)
    return await response.json()
  }

  const getPeerInfo = async (): Promise<Lotusia.Network.PeerInfo[]> => {
    const response = await fetch(`${NODE_API_URL}/${NodeAPI.peerinfo}`)
    return await response.json()
  }

  const getTxOutSetInfo = async (): Promise<Lotusia.Network.TxOutSetInfo> => {
    const response = await fetch(`${NODE_API_URL}/${NodeAPI.txoutsetinfo}`)
    return await response.json()
  }

  return {
    getMiningInfo,
    getNetworkInfo,
    getTxOutSetInfo,
    getPeerInfo
  }
}
