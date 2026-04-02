import { BufferUtil, Script } from 'xpi-ts/lib/bitcore'
import { ScriptProcessor, type TransactionOutputRANK } from 'xpi-ts/lib/rank'
import type { Tx, TxInput, TxOutput } from 'chronik-client'
import { getAddressFromScript } from '@/utils/address'

type ExplorerTxInput = TxInput & {
  address: string
}

type ExplorerTxOutput = TxOutput & {
  address?: string
  rankOutput?: TransactionOutputRANK
}

type ExplorerTx = Tx & {
  inputs: Array<ExplorerTxInput>
  outputs: Array<ExplorerTxOutput>
  confirmations: number
  sumBurnedSats: string
}

export default defineEventHandler(async event => {
  const txid = getRouterParam(event, 'txid')
  if (!txid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing txid',
    })
  }
  const { $chronik } = useNitroApp()
  const tx = await $chronik.getTransaction(txid)
  if (!tx) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Transaction not found',
    })
  }

  const blockchainInfo = await $chronik.getBlockchainInfo()
  const confirmations = tx.block
    ? blockchainInfo.tipHeight - tx.block.height + 1
    : -1

  const txInputs = tx.inputs.map((input: TxInput) => {
    if (!input.outputScript) {
      return input
    }
    const script = Script.fromHex(input.outputScript)

    // P2PKH/P2TR/P2SH outputs
    if (
      script.isPublicKeyHashOut() ||
      script.isScriptHashOut() ||
      script.isTaprootOut()
    ) {
      const address = getAddressFromScript(script).toXAddress()
      if (!address) {
        return input
      }
      return {
        ...input,
        address,
      } as ExplorerTxInput
    }
    // return the input as is
    return input
  })

  let sumBurnedSats = 0
  const txOutputs = tx.outputs.map((output: TxOutput) => {
    const scriptBuf = BufferUtil.from(output.outputScript, 'hex')
    const script = Script.fromBuffer(scriptBuf)
    // OP_RETURN outputs
    if (script.isDataOut()) {
      // TODO: we can add more LOKAD checks here
      sumBurnedSats += Number(output.value)
      // process the rank output
      const rank = new ScriptProcessor(scriptBuf)
      const rankOutput = rank.processScriptRANK()
      if (rankOutput) {
        return {
          ...output,
          rankOutput,
        } as ExplorerTxOutput
      }
    }
    // P2PKH/P2TR/P2SH outputs
    if (
      script.isPublicKeyHashOut() ||
      script.isScriptHashOut() ||
      script.isTaprootOut()
    ) {
      const address = getAddressFromScript(script).toXAddress()
      if (!address) {
        return output
      }
      return {
        ...output,
        address,
      } as ExplorerTxOutput
    }
    // if we get here, the output is not a rank output or an address output
    // just return the output as is
    return output
  })

  return {
    ...tx,
    confirmations,
    inputs: txInputs,
    outputs: txOutputs,
    sumBurnedSats: sumBurnedSats.toString(),
  } as ExplorerTx
})
