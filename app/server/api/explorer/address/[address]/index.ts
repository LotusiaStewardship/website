import { useChronikApi } from '@/composables/useChronikApi'
import { getChronikScriptType, getScriptPayload } from '~/utils/chronik'
import { getSumBurnedSats } from '~/utils/transaction'
import { EXPLORER_TABLE_MAX_ROWS } from '~/utils/constants'

const { getTxHistoryPage } = useChronikApi()

export default defineEventHandler(async (event) => {
  const address = getRouterParam(event, 'address')
  const { page, pageSize } = getQuery(event)

  if (!address) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing address'
    })
  }

  const scriptType = getChronikScriptType(address)
  const scriptPayload = getScriptPayload(address)
  if (!scriptType || !scriptPayload) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid address'
    })
  }

  const pageNum = Number(page) || 1
  const pageSizeNum = Number(pageSize) || 10

  const history = await getTxHistoryPage(
    scriptType,
    scriptPayload,
    // Chronik tx history page is 0-indexed, but we want to show the user a 1-indexed page
    pageNum > 0 ? pageNum - 1 : 0,
    pageSizeNum > EXPLORER_TABLE_MAX_ROWS ? EXPLORER_TABLE_MAX_ROWS : pageSizeNum
  )

  // find the address last seen time
  // use latest block time if available, otherwise use the most recent tx firstSeen time
  const lastSeenTx = history.txs[0]
  let lastSeen: string | null = null
  if (lastSeenTx) {
    lastSeen = lastSeenTx.block?.timestamp ?? lastSeenTx.timeFirstSeen
  }
  const txs = history.txs.map(tx => ({
    ...tx,
    sumBurnedSats: getSumBurnedSats(tx).toString()
  }))

  return {
    lastSeen,
    // TODO: Add this back when we have a way to calculate the total burned sats for an address
    // numBurnedSats: txs.reduce((acc, tx) => acc + BigInt(tx.sumBurnedSats), BigInt(0)).toString(),
    history: { txs, numPages: history.numPages }
  }
})
