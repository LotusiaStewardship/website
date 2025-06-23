import bitcore from 'bitcore-lib-xpi'
import type { Tx, TxInput, TxOutput } from 'chronik-client'
import { type RankOutput, RankScriptProcessor } from '~/submodules/rank-lib'
import { useChronikApi } from '@/composables/useChronikApi'

const { getBlockchainInfo, getTransaction } = useChronikApi()

type ExplorerTxInput = TxInput & {
  address: string
}

type ExplorerTxOutput = TxOutput & {
  address?: string
  rankOutput?: RankOutput
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

  const txInputs = tx.inputs.map((input: TxInput) => {
    if (!input.outputScript) {
      return input
    }
    const script = bitcore.Script.fromHex(input.outputScript)
    const address = script.isPublicKeyHashOut() || script.isScriptHashOut()
      ? script.toAddress().toXAddress()
      : null
    return {
      ...input,
      address
    } as ExplorerTxInput
  })
  const txOutputs = tx.outputs.map((output: TxOutput) => {
    const scriptBuf = Buffer.from(output.outputScript, 'hex')
    const script = bitcore.Script.fromBuffer(scriptBuf)
    // OP_RETURN outputs
    if (script.isDataOut()) {
      // TODO: we can add more LOKAD checks here

      // process the rank output
      const rank = new RankScriptProcessor(scriptBuf)
      const rankOutput = rank.processRankOutput()
      if (rankOutput) {
        return {
          ...output,
          rankOutput
        } as ExplorerTxOutput
      }
    }
    // P2PKH/P2SH outputs
    if (script.isPublicKeyHashOut() || script.isScriptHashOut()) {
      const address = script.toAddress().toXAddress()
      return {
        ...output,
        address
      } as ExplorerTxOutput
    }
    // if we get here, the output is not a rank output or an address output
    // just return the output as is
    return output
  })

  const blockchainInfo = await getBlockchainInfo()
  const confirmations = tx.block
    ? blockchainInfo.tipHeight - tx.block.height + 1
    : -1

  return {
    ...tx,
    confirmations,
    inputs: txInputs,
    outputs: txOutputs,
    sumBurnedSats: tx.outputs
      .reduce((acc, output) => {
        const script = bitcore.Script.fromHex(output.outputScript)
        if (script.isDataOut()) {
          return acc + Number(output.value)
        }
        return acc
      }, 0)
      .toString()
  } as ExplorerTx
})
