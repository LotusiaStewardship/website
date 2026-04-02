import type { Address, NetworkName } from 'xpi-ts/lib/bitcore'
import { Script } from 'xpi-ts/lib/bitcore'
import { Network } from './constants'

/**
 * Get the address from a script
 * @param script - The script to get the address from
 * @returns The address
 */
const getAddressFromScript = (script: Script | string): Address => {
  // get Bitcore script
  if (typeof script === 'string') {
    script = Script.fromHex(script)
  }
  // OP_RETURN outputs are not addresses
  if (script.isDataOut()) {
    return null
  }
  // P2PKH, P2TR, and P2SH outputs are addresses
  return script.toAddress(Network as NetworkName)
}

export { getAddressFromScript }
