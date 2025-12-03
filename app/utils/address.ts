import { Bitcore } from 'lotus-sdk'
import { Network } from './constants'

/**
 * Get the address from a script
 * @param script - The script to get the address from
 * @returns The address
 */
const getAddressFromScript = (
  script: Bitcore.Script | string
): Bitcore.Address => {
  // get Bitcore script
  if (typeof script === 'string') {
    script = Bitcore.Script.fromHex(script)
  }
  // OP_RETURN outputs are not addresses
  if (script.isDataOut()) {
    return null
  }
  // P2PKH, P2TR, and P2SH outputs are addresses
  return script.toAddress(Network)
}

export { getAddressFromScript }
