import type { Tx } from 'chronik-client'

function getSumBurnedSats(tx: Tx): bigint {
  return tx.outputs.reduce((acc, output) => {
    const value = BigInt(output.value)
    // 0x6a = OP_RETURN
    if (output.outputScript.startsWith('6a') && value > BigInt(0)) {
      return acc + value
    }
    return acc
  }, BigInt(0))
}

export {
  getSumBurnedSats
}
