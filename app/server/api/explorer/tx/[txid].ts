import { Bitcore, ScriptProcessor, type TransactionOutputRANK } from 'lotus-sdk'
import type { Tx, TxInput, TxOutput } from 'chronik-client'
import { useChronikApi } from '@/composables/useChronikApi'

const { getBlockchainInfo, getTransaction } = useChronikApi()

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

export default defineEventHandler(async (event) => {
  const txid = getRouterParam(event, 'txid')
  if (!txid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing txid'
    })
  }
  const tx = await getTransaction(txid)
  if (!tx) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Transaction not found'
    })
  }

  const blockchainInfo = await getBlockchainInfo()
  const confirmations = tx.block
    ? blockchainInfo.tipHeight - tx.block.height + 1
    : -1

  const txInputs = tx.inputs.map((input: TxInput) => {
    if (!input.outputScript) {
      return input
    }
    const script = Bitcore.Script.fromHex(input.outputScript)
    const address = script.isPublicKeyHashOut() || script.isScriptHashOut()
      ? script.toAddress()?.toXAddress()
      : null
    if (!address) {
      return input
    }
    return {
      ...input,
      address
    } as ExplorerTxInput
  })

  let sumBurnedSats = 0
  const txOutputs = tx.outputs.map((output: TxOutput) => {
    const scriptBuf = Buffer.from(output.outputScript, 'hex')
    const script = Bitcore.Script.fromBuffer(scriptBuf)
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
          rankOutput
        } as ExplorerTxOutput
      }
    }
    // P2PKH/P2SH outputs
    if (script.isPublicKeyHashOut() || script.isScriptHashOut()) {
      const address = script.toAddress()?.toXAddress()
      if (!address) {
        return output
      }
      return {
        ...output,
        address
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
    sumBurnedSats: sumBurnedSats.toString()
  } as ExplorerTx
})
