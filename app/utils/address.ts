import bitcore from 'bitcore-lib-xpi'

/**
 * Get the address from a script
 * @param script - The script to get the address from
 * @returns The address
 */
const getAddressFromScript = (script: bitcore.Script | string): bitcore.Address => {
  // get Bitcore script
  if (typeof script === 'string') {
    script = bitcore.Script.fromHex(script)
  }
  // OP_RETURN outputs are not addresses
  if (script.isDataOut()) {
    return null
  }
  // P2PKH and P2SH outputs are addresses
  return bitcore.Address.fromScript(script, bitcore.Networks.mainnet)
}

export {
  getAddressFromScript
}
