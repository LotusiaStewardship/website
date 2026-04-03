import { Bitcore } from 'xpi-ts'

export default defineEventHandler(async (event) => {
  const address = getRouterParam(event, 'address')

  if (!address) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing address'
    })
  }

  const script = Bitcore.Script.fromAddress(address)
  const scriptType = script.getType()
  const scriptPayload = script.getData().toString('hex')
  if (!scriptType || !scriptPayload) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid address'
    })
  }

  const { $chronik } = useNitroApp()
  // fetch utxos and calculate balance
  const utxos = await $chronik.getUtxos(scriptType, scriptPayload)
  const balance = utxos
    .reduce((acc, utxo) => acc + Number(utxo.value), 0)
    .toString()
  return balance
})
