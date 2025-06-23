import type { ScriptType } from 'chronik-client'
import bitcore from 'bitcore-lib-xpi'

/**
 * Get the Bitcore `Script` for the provided `Address`
 * @param address - The `Address` to get the script for, in string or `Address` format
 * @returns The Bitcore `Script`
 */
const getScriptFromAddress = (address: string | bitcore.Address): bitcore.Script => {
  try {
    return bitcore.Script.fromAddress(address)
  } catch (e: any) {
    throw new Error(`getScriptFromAddress: ${e.message}`)
  }
}

/**
 * Get the Chronik script type for the provided `Address`
 * @param address - The `Address` to get the script type for
 * @returns The Chronik script type
 */
const getChronikScriptType = (address: string | bitcore.Address): ScriptType => {
  // Convert string to Address if needed
  address = typeof address === 'string' ? bitcore.Address.fromString(address) : address
  switch (true) {
    case address.isPayToPublicKeyHash():
      return 'p2pkh'
    case address.isPayToScriptHash():
      return 'p2sh'
    default:
      return 'other'
  }
}

/**
 * Get the script payload (20-byte P2PKH) for the provided `Script` or `Address`
 * @param data - The `Script` or `Address` to get the script payload for
 * @returns The script payload
 */
const getScriptPayload = (address: bitcore.Address | string): string => {
  const script = getScriptFromAddress(address)
  return script.getData().toString('hex')
}

export {
  getScriptFromAddress,
  getChronikScriptType,
  getScriptPayload
}
