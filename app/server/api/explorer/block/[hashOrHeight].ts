import { useChronikApi } from '@/composables/useChronikApi'
import { toAsyncIterable } from '~/utils/functions'
import { getAddressFromScript } from '~/utils/address'
import { getSumBurnedSats } from '~/utils/transaction'
import type { Block, Tx } from '~/utils/types'

type ExplorerBlock = Block & {
  minedBy: string
}

const { getBlock } = useChronikApi()

export default defineEventHandler(async (event) => {
  const t0 = performance.now()
  const hashOrHeight = getRouterParam(event, 'hashOrHeight')
  if (!hashOrHeight) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing hashOrHeight'
    })
  }
  try {
    const block = await getBlock(hashOrHeight)
    if (!block) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Block not found'
      })
    }
    /** height 0 is genesis block */
    if (block.blockInfo.height === 0) {
      return block as ExplorerBlock
    }
    const minedByScriptHex = block.txs[0]?.outputs[1]?.outputScript
    const minedByAddress = getAddressFromScript(minedByScriptHex)
    // iterate each tx's outputs to calculate sumBurnedSats for the tx
    const txs: Array<Tx & { sumBurnedSats: string }> = []
    for await (const tx of toAsyncIterable(block.txs)) {
      txs.push({
        ...tx,
        sumBurnedSats: getSumBurnedSats(tx).toString()
      })
    }
    block.txs = txs

    const t1 = (performance.now() - t0).toFixed(3)
    console.log(`Block ${hashOrHeight} took ${t1}ms`)

    return {
      ...block,
      minedBy: minedByAddress.toXAddress()
    } as ExplorerBlock
  } catch (error) {
    console.error(error)
    throw createError({
      statusCode: 404,
      statusMessage: 'Block not found'
    })
  }
})
