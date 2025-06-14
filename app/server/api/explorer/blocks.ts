import { useChronikApi } from '~/composables/useChronikApi'
import { EXPLORER_TABLE_MAX_ROWS } from '~/utils/constants'

const { getBlockchainInfo, getBlockRange } = useChronikApi()

export default defineEventHandler(async (event) => {
  const { page, pageSize } = getQuery(event)
  const pageNum = Number(page) || 1
  const pageSizeNum = Number(pageSize) || 10
  // need to get the blockchain info to get the tip height
  const blockchainInfo = await getBlockchainInfo()
  const startHeight = blockchainInfo.tipHeight - pageSizeNum * pageNum
  const endHeight = startHeight
    + (pageSizeNum > EXPLORER_TABLE_MAX_ROWS ? EXPLORER_TABLE_MAX_ROWS : pageSizeNum)
  // get the block range
  // startHeight must be lowest height, endHeight must be highest height
  const blockRange = await getBlockRange(
    startHeight + 1 > 0 ? startHeight + 1 : 1,
    endHeight
  )

  // Reverse the block range to show the latest blocks first
  return {
    blocks: blockRange.reverse(),
    tipHeight: blockchainInfo.tipHeight
  }
})
