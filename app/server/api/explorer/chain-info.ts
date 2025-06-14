import { useChronikApi } from '~/composables/useChronikApi'

const { getBlockchainInfo } = useChronikApi()

export default defineEventHandler(async () => {
  return await getBlockchainInfo()
})
