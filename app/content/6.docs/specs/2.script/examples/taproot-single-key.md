---
title: 'Taproot: Single-Key Spending'
linkTitle: 'Single-Key'
category: Script
weight: 4.2
modified: 2025-10-28
---

## Overview

The most common Taproot use case: a single key controls the output with no alternative spending paths. The commitment is tweaked with an empty Merkle root (32 zero bytes), providing maximum privacy and efficiency.

**Key Benefits**:

- Simplest Taproot implementation
- Maximum privacy (indistinguishable from regular payments)
- Smallest transaction size (~110 bytes)
- No revealed scripts or tree structure

---

## Creating a Single-Key Taproot Address

```typescript
import { PrivateKey, buildKeyPathTaproot } from 'lotus-lib'

// Generate internal private key
const privateKey = new PrivateKey()
const internalPubKey = privateKey.publicKey

// Build Taproot script (automatically tweaks with empty merkle root)
const taprootScript = buildKeyPathTaproot(internalPubKey)

// Create address
const address = taprootScript.toAddress()
console.log('Taproot address:', address.toString())
// Output: lotus_XKrg3EtwKTM1HLFvycnfUTnkQEBCfas85MZkVjNMbJYBEomjhkQu4rt

console.log('Script hex:', taprootScript.toBuffer().toString('hex'))
// Output: 62512102ec64c2bab67dd21f864bdc68bcc2339f0b86c380534ea8066a1e0b958b873966

console.log('Script size:', taprootScript.toBuffer().length, 'bytes')
// Output: 36 bytes
```

**Script Breakdown**:

- `62` - OP_SCRIPTTYPE
- `51` - OP_1 (version)
- `21` - Push 33 bytes
- `02ec64...` - 33-byte tweaked public key (commitment)

---

## Spending from Single-Key Taproot

```typescript
import {
  Transaction,
  TaprootInput,
  Output,
  Script,
  Signature,
  Address,
} from 'lotus-lib'

// Create transaction
const tx = new Transaction()

// Add Taproot input (from previous funding transaction)
tx.addInput(
  new TaprootInput({
    prevTxId: Buffer.from(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'hex',
    ),
    outputIndex: 0,
    output: new Output({
      script: taprootScript,
      satoshis: 100000,
    }),
    script: new Script(),
  }),
)

// Add output
const destinationAddress = Address.fromString('lotus_...')
tx.addOutput(
  new Output({
    script: Script.buildPublicKeyHashOut(destinationAddress),
    satoshis: 95000, // 5,000 sat fee
  }),
)

// Sign with Schnorr + SIGHASH_LOTUS (automatically tweaks the key)
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')

console.log('Transaction ID:', tx.id)
console.log('Transaction hex:', tx.serialize())
console.log('Is fully signed:', tx.isFullySigned())
console.log('Verification:', tx.verify())
```

---

## Transaction Formats

### Funding Transaction

**JSON Format**:

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "outputIndex": 0,
      "scriptSig": "483045022100ab12cd34ef5678901234567890abcdef1234567890abcdef1234567890abcdef022056789012abcdef3456789012abcdef3456789012abcdef3456789012abcdef34501",
      "sequence": 4294967295
    }
  ],
  "outputs": [
    {
      "satoshis": 1000000,
      "script": "62512102ec64c2bab67dd21f864bdc68bcc2339f0b86c380534ea8066a1e0b958b873966"
    },
    {
      "satoshis": 500000,
      "script": "76a914abc1234567890abcdef1234567890abcdef1288ac"
    }
  ],
  "lockTime": 0
}
```

**Output 0 Breakdown** (Taproot):

- 1,000,000 satoshis (1 XPI)
- Script: `62512102ec64c2...` (36 bytes)
  - `62` = OP_SCRIPTTYPE
  - `51` = OP_1
  - `21` = 33 (push 33 bytes)
  - `02ec64...873966` = Tweaked public key

### Spending Transaction

**Hex Format**:

```
0200000001aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
000000004241125420061d0c94049460d84f95429801f0325b11ed5e526f4c9d6a380f68
1accde5608194dd2a988e5328c735b7c380ba59da10ac913817c105487dd2863248e61ff
ffffff0118730100000000001976a91497ad481b22dcd0101c302ae278d857aa3310e1cc
88ac00000000
```

**JSON Format**:

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "outputIndex": 0,
      "scriptSig": "41125420061d0c94049460d84f95429801f0325b11ed5e526f4c9d6a380f681accde5608194dd2a988e5328c735b7c380ba59da10ac913817c105487dd2863248e61",
      "sequence": 4294967295
    }
  ],
  "outputs": [
    {
      "satoshis": 995000,
      "script": "76a91497ad481b22dcd0101c302ae278d857aa3310e1cc88ac"
    }
  ],
  "lockTime": 0
}
```

**Input Script Breakdown**:

- `41` - Push 65 bytes (Schnorr signature)
- `125420...8e61` - 65-byte Schnorr signature with SIGHASH_LOTUS flag (0x61)
  - First 64 bytes: Schnorr signature (r || s)
  - Last byte: SIGHASH_ALL | SIGHASH_LOTUS (0x01 | 0x60 = 0x61)

**Amounts**:

- Input: 1,000,000 sats (1 XPI)
- Output: 995,000 sats (0.995 XPI)
- Fee: 5,000 sats (0.005 XPI)

---

## Size Comparison

| Transaction Type   | Input Size | Total TX Size | Savings  |
| ------------------ | ---------- | ------------- | -------- |
| P2PKH (ECDSA)      | ~148 bytes | ~220 bytes    | Baseline |
| Taproot Single-Key | ~67 bytes  | ~110 bytes    | 50%      |

**Why Smaller?**:

- Schnorr signature: 64 bytes (vs ~72 for ECDSA)
- No script execution overhead
- Compact witness format

---

## Security Considerations

### Key Management

**DO**:

- ✅ Store private keys securely (hardware wallet, encrypted storage)
- ✅ Use cryptographically secure random number generation
- ✅ Back up the seed phrase/private key
- ✅ Test on regtest/testnet first

**DON'T**:

- ❌ Reuse nonces (critical for Schnorr)
- ❌ Share private keys
- ❌ Use weak randomness
- ❌ Forget to back up keys

### Signature Requirements

- MUST use Schnorr signatures (not ECDSA)
- MUST include SIGHASH_LOTUS flag (0x60)
- MUST combine with base sighash type (usually SIGHASH_ALL = 0x01)
- Final sighash byte: 0x61 (SIGHASH_ALL | SIGHASH_LOTUS)

### Common Mistakes

```typescript
// ❌ WRONG: Using ECDSA for Taproot key path
tx.sign(privateKey, Signature.SIGHASH_ALL, 'ecdsa') // Error!

// ❌ WRONG: Missing SIGHASH_LOTUS
tx.sign(privateKey, Signature.SIGHASH_ALL, 'schnorr') // Error!

// ✅ CORRECT: Schnorr + SIGHASH_LOTUS
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')
```

---

## Privacy Analysis

### What's Hidden

When spending via key path:

- ✅ No alternative spending conditions revealed
- ✅ No script tree structure exposed
- ✅ Indistinguishable from regular single-sig payments
- ✅ Could have had 100 alternative scripts (nobody knows)

### What's Visible

On-chain observers can see:

- Transaction amount
- Input and output addresses
- Transaction timing
- Fee paid

But **cannot determine**:

- Whether alternative scripts existed
- What those scripts might have been
- Identity of the parties (unless addresses are reused)

---

## Use Cases

### Personal Wallet

Most common use case - simple daily spending:

```typescript
// One-time setup
const wallet = new PrivateKey()
const address = buildKeyPathTaproot(wallet.publicKey).toAddress()

console.log('Your Taproot address:', address.toString())
// Share this address to receive funds
```

### Savings Account

Long-term storage with maximum privacy:

```typescript
// Generate and securely store
const savings = new PrivateKey()
const savingsAddress = buildKeyPathTaproot(savings.publicKey).toAddress()

// Store private key in cold storage (hardware wallet, paper wallet)
console.log('Savings address:', savingsAddress.toString())
```

### Merchant Payments

Accept customer payments with privacy:

```typescript
// Generate unique address per customer/order
function generatePaymentAddress(orderId: string): string {
  // Derive deterministic key from order ID
  const orderKey = deriveKeyFromSeed(masterSeed, orderId)
  const address = buildKeyPathTaproot(orderKey.publicKey).toAddress()
  return address.toString()
}
```

---

## Testing

### Regtest Example

```typescript
import { PrivateKey, buildKeyPathTaproot, Networks } from 'lotus-lib'

// Use regtest network
const privateKey = new PrivateKey(undefined, Networks.regtest)
const taprootScript = buildKeyPathTaproot(privateKey.publicKey)
const address = taprootScript.toAddress()

console.log('Regtest address:', address.toString())
// Example: lotus_RKrg3...
```

### Testnet Example

```typescript
const privateKey = new PrivateKey(undefined, Networks.testnet)
const address = buildKeyPathTaproot(privateKey.publicKey).toAddress()

console.log('Testnet address:', address.toString())
// Example: lotus_TKrg3...
```

---

## Summary

Single-key Taproot spending offers:

**Benefits**:

- ✅ Maximum privacy (indistinguishable from regular payments)
- ✅ Smallest transaction size (50% savings vs P2PKH)
- ✅ Schnorr signature efficiency
- ✅ Simple implementation
- ✅ Future-proof (can add scripts later if needed)

**Trade-offs**:

- Requires Schnorr signature support
- Requires SIGHASH_LOTUS implementation
- Currently disabled in Lotus consensus (re-activation planned)

**When to Use**:

- Personal wallets
- Daily spending
- Merchant payments
- Any single-key scenario

**When NOT to Use**:

- Need multisig (use [Taproot Multisig](./taproot-multisig))
- Need time-locks (use [Taproot Timelock](./taproot-timelock))
- Need alternative spending conditions (use script path Taproot)

---

## Related Documentation

- [Taproot Overview](../taproot) - Technical fundamentals
- [Taproot Multisig](./taproot-multisig) - Multiple signature options
- [Taproot Timelock](./taproot-timelock) - Time-locked outputs

---

**Last Modified**: October 28, 2025
