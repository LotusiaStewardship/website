import RPC from '~/utils/rpc'

const { getRawMemPool, getRawTransaction } = RPC

export default defineEventHandler(async () => {
  const txids = await getRawMemPool()
  const txs = await Promise.all(txids.map(txid => getRawTransaction(txid)))
  return txs
})
