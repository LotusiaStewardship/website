import { Bitcore } from 'lotus-sdk'
import type { Tx } from 'chronik-client'

/**
 * Calculate the sum of the burned sats in a transaction
 * @param tx - The transaction to calculate the sum of burned sats for
 * @returns The sum of the burned sats, in bigint format
 */
export function calcSumBurnedSats(tx: Tx): bigint {
  return tx.outputs.reduce((acc, output) => {
    const value = BigInt(output.value)
    // 0x6a = OP_RETURN
    if (output.outputScript.startsWith('6a') && value > BigInt(0)) {
      return acc + value
    }
    return acc
  }, BigInt(0))
}

/**
 * Get the Bitcore `Script` for the provided `Address`
 * @param address - The `Address` to get the script for, in string or `Address` format
 * @returns The Bitcore `Script`
 */
export function getScriptFromAddress(
  address: string | Bitcore.Address
): Bitcore.Script {
  try {
    return Bitcore.Script.fromAddress(address)
  } catch (e) {
    throw new Error(`getScriptFromAddress: ${e.message}`)
  }
}

/**
 * Get the script payload (20-byte P2PKH) for the provided `Script` or `Address`
 * @param data - The `Script` or `Address` to get the script payload for
 * @returns The script payload
 */
export function getScriptPayload(address: Bitcore.Address | string): string {
  const script = getScriptFromAddress(address)
  return script.getData().toString('hex')
}
