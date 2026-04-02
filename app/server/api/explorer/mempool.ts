export default defineEventHandler(async () => {
  const { $rpc } = useNitroApp()
  const txids = await $rpc.getRawMemPool()
  const txs = await Promise.all(txids.map(txid => $rpc.getRawTransaction(txid)))
  return txs
})
