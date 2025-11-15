import { Bitcore } from 'lotus-sdk'

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
  // P2PKH and P2SH outputs are addresses
  return Bitcore.Address.fromScript(script, Bitcore.Networks.mainnet)
}

export { getAddressFromScript }
