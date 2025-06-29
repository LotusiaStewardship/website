import { useChronikApi } from '@/composables/useChronikApi'
import { getChronikScriptType, getScriptPayload } from '~/utils/chronik'

const { getUtxos } = useChronikApi()

export default defineEventHandler(async (event) => {
  const address = getRouterParam(event, 'address')

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

  // fetch utxos and calculate balance
  const utxos = await getUtxos(scriptType, scriptPayload)
  const balance = utxos
    .reduce((acc, utxo) => acc + Number(utxo.value), 0)
    .toString()
  return balance
})
