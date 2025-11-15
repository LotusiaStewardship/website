import { Bitcore } from 'lotus-sdk'

/**
 * Get the Bitcore `Script` for the provided `Address`
 * @param address - The `Address` to get the script for, in string or `Address` format
 * @returns The Bitcore `Script`
 */
const getScriptFromAddress = (
  address: string | Bitcore.Address
): Bitcore.Script => {
  try {
    return Bitcore.Script.fromAddress(address)
  } catch (e: any) {
    throw new Error(`getScriptFromAddress: ${e.message}`)
  }
}

/**
 * Get the script payload (20-byte P2PKH) for the provided `Script` or `Address`
 * @param data - The `Script` or `Address` to get the script payload for
 * @returns The script payload
 */
const getScriptPayload = (address: Bitcore.Address | string): string => {
  const script = getScriptFromAddress(address)
  return script.getData().toString('hex')
}

export { getScriptFromAddress, getChronikScriptType, getScriptPayload }
