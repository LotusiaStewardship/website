import RPC from '~/utils/rpc'

export const useNodeRpc = () => {
  return {
    getMiningInfo: RPC.getMiningInfo,
    getPeerInfo: RPC.getPeerInfo,
    getBlockCount: RPC.getBlockCount,
    getBlockHash: RPC.getBlockHash,
    getBlock: RPC.getBlock,
    getRawTransaction: RPC.getRawTransaction,
    getRawMemPool: RPC.getRawMemPool
  }
}
