import type { Bitcore } from 'lotus-sdk'

enum BIP44CoinType {
  default = 10605,
  stamp = 899,
  abcpay = 1899
}

// BIP44 Wallet parameters
const BIP44 = {
  purpose: 44,
  cointype: BIP44CoinType
}

/**
 * Get the Bitcore `PrivateKey` from the provided `HDPrivateKey`
 * @param hdPrivKey - The `HDPrivateKey` from which to derive the `PrivateKey`
 * @returns The Bitcore `PrivateKey`
 */
const getDerivedSigningKey = (
  cointype: keyof typeof BIP44CoinType,
  hdPrivKey: Bitcore.HDPrivateKey
): Bitcore.PrivateKey => {
  try {
    return hdPrivKey
      .deriveChild(BIP44.purpose, true)
      .deriveChild(BIP44CoinType[cointype], true)
      .deriveChild(0, true)
      .deriveChild(0)
      .deriveChild(0).privateKey
  } catch (e: any) {
    throw new Error(`getDerivedPrivKey: ${e.message}`)
  }
}

/**
 * Get the Bitcore `Address` for the provided `PrivateKey`
 * @param signingKey - The `PrivateKey` to get the address for
 * @returns The Bitcore `Address`
 */
const getAddressFromSigningKey = (signingKey: Bitcore.PrivateKey): Bitcore.Address => {
  try {
    return signingKey.toAddress()
  } catch (e: any) {
    throw new Error(`getAddressFromSigningKey: ${e.message}`)
  }
}

export {
  // enums
  BIP44CoinType,
  // constants
  BIP44,
  // functions
  getDerivedSigningKey,
  getAddressFromSigningKey
}
