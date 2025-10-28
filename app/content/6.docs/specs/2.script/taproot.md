---
title: 'Taproot'
linkTitle: 'Taproot'
category: Script
weight: 4.1
modified: 2025-10-28
---

## Overview

Taproot is an advanced script type that enables privacy-preserving smart contracts on Lotus. The Lotus implementation is compatible with BIP341 but uses a unique output format and supports additional features.

::alert{type="info"}
**Lotus Units**: All examples use Lotus-specific units where **1 XPI = 1,000,000 satoshis**. This differs from Bitcoin where 1 BTC = 100,000,000 satoshis.
::

### Key Features

- **Privacy**: Key path spending looks identical to regular single-signature transactions
- **Flexibility**: Support multiple spending conditions via Merkle script trees
- **Efficiency**: Schnorr signatures are ~10% smaller than ECDSA (64 bytes vs ~72)
- **Future-Proof**: Designed for Lightning Network, atomic swaps, vaults, and DeFi

---

## Output Format

Taproot outputs consist of a matched pattern:

```
OP_SCRIPTTYPE OP_1 <33-byte commitment [ || 32-byte state]>
```

**Components**:

- `OP_SCRIPTTYPE` (0x62): Marks the script as Taproot
- `OP_1`: Version byte
- **33-byte commitment**: Tweaked public key (compressed format)
- **32-byte state** (optional): Pushed onto stack before executing spend paths

### Differences from BIP341

1. **Commitment Format**: Lotus uses the full 33-byte compressed public key, while BIP341 uses only the 32-byte x-coordinate
2. **Optional State**: Lotus supports an optional 32-byte state parameter
3. **Script Identifier**: Uses `OP_SCRIPTTYPE` to mark Taproot outputs

---

## Address Format

Taproot addresses use XAddress encoding with type byte `2`:

**Format**: `lotus_X<base58_payload>`

**Example**:

```
lotus_XKrg3GedBgR9iMusKuMw5Dq4f3PHK2bL67PcDWh1MAG9vshR6y5zsUc
```

**Encoding**:

- Prefix: "lotus"
- Network character: `_` (mainnet), `T` (testnet), `R` (regtest)
- Type byte: `2`
- Payload: 33-byte commitment public key
- Checksum: 4-byte hash

---

## Spending Paths

### Key Path Spending (Recommended)

The most common and private way to spend Taproot outputs. The commitment is tweaked with the Merkle root of alternative scripts (or empty buffer for key-only).

**Requirements**:

- Single Schnorr signature
- SIGHASH_LOTUS signature hash algorithm
- Tweaked private key

**Process**:

1. Calculate tapTweak: `tagged_hash("TapTweak", internal_pubkey || merkle_root)`
2. Tweak private key: `tweaked_key = internal_key + tapTweak`
3. Sign with tweaked key using Schnorr + SIGHASH_LOTUS
4. Input script: `<65-byte schnorr signature>`

**Privacy**: Alternative spending paths remain completely hidden.

### Script Path Spending

Reveal and execute one of the committed scripts from the Merkle tree.

**Input Script Format**:

```
<signatures/data> <script> <control_block>
```

**Control Block**:

- Byte 0: Parity bit + version
- Bytes 1-33: Internal public key
- Bytes 34+: Merkle proof (32-byte hashes)

**Process**:

1. Verify control block proves script is in the commitment
2. Execute the revealed script
3. Script must evaluate to true

---

## Tagged Hashing

Taproot uses BIP340-style tagged hashing to prevent cross-protocol attacks:

```
tagged_hash(tag, msg) = SHA256(SHA256(tag) || SHA256(tag) || msg)
```

**Why Double Concatenation?**

The tag hash is concatenated twice for critical security reasons:

- **Domain Separation**: Creates unique hash domains for different contexts
- **Collision Resistance**: Makes cross-protocol attacks computationally infeasible
- **Prefix Ambiguity Prevention**: Prevents data from one context being misinterpreted in another

This is defined in BIP340 and implemented identically in lotusd.

**Tags Used**:

- `TapTweak`: Tweaking the internal public key
- `TapLeaf`: Hashing individual scripts in the tree
- `TapBranch`: Hashing pairs of nodes when building Merkle tree

**Implementation**:

```typescript
import { Hash } from 'lotus-lib'

function taggedHash(tag: string, data: Buffer): Buffer {
  const tagHash = Hash.sha256(Buffer.from(tag, 'utf8'))
  const combined = Buffer.concat([tagHash, tagHash, data]) // Double concat
  return Hash.sha256(combined)
}
```

---

## Key Tweaking

**Public Key Tweaking**:

```
tweaked_pubkey = internal_pubkey + (tapTweak * G)
```

**Private Key Tweaking**:

```
tweaked_privkey = (internal_privkey + tapTweak) mod n
```

Where:

- `tapTweak = tagged_hash("TapTweak", internal_pubkey || merkle_root)`
- `G` = secp256k1 generator point
- `n` = secp256k1 curve order

**Key-Only Spending**: Use `merkle_root = Buffer(32 zeros)` for outputs without scripts.

**Example**:

```typescript
import { PrivateKey, tweakPublicKey, tweakPrivateKey } from 'lotus-lib'

const privateKey = new PrivateKey()
const internalPubKey = privateKey.publicKey

// For key-only (no scripts)
const merkleRoot = Buffer.alloc(32) // 32 zero bytes

// Tweak the keys
const tweakedPubKey = tweakPublicKey(internalPubKey, merkleRoot)
const tweakedPrivKey = tweakPrivateKey(privateKey, merkleRoot)
```

---

## Script Trees

Scripts are organized in a Merkle tree for compact commitments.

### Leaf Node Hashing

```
leaf_hash = tagged_hash("TapLeaf", version || script_size || script)
```

Where:

- `version = 0xc0` (192)
- `script_size` = compact size encoding

### Branch Node Hashing

```
branch_hash = tagged_hash("TapBranch", left_hash || right_hash)
```

Note: Hashes are sorted lexicographically before hashing.

### Tree Structure

**Simple Script** (1 script):

```
Root = leaf_hash(script)
```

**Multiple Scripts** (2+ scripts):

```
       Root
      /    \
   Hash1  Hash2
   /  \    /  \
  L1  L2  L3  L4
```

**Building a Tree**:

```typescript
import { Script, Opcode, buildScriptPathTaproot, TapNode } from 'lotus-lib'

// Create scripts
const script1 = new Script().add(pubkey1).add(Opcode.OP_CHECKSIG)
const script2 = new Script().add(pubkey2).add(Opcode.OP_CHECKSIG)

// Build tree
const tree: TapNode = {
  left: { script: script1 },
  right: { script: script2 },
}

const { script, merkleRoot, leaves } = buildScriptPathTaproot(
  internalPubKey,
  tree,
)

console.log('Merkle root:', merkleRoot.toString('hex'))
console.log('Number of leaves:', leaves.length)
```

---

## Use Cases

Taproot enables various advanced use cases by combining privacy, efficiency, and flexibility. Each use case demonstrates different Taproot features with complete working code examples.

### Available Examples

1. **[Single-Key Spending](./examples/taproot-single-key)** - Simple payments with maximum privacy
2. **[Time-Locked Voting](./examples/taproot-timelock)** - Locked funds with refund mechanisms
3. **[Multi-Signature Governance](./examples/taproot-multisig)** - Organizations with multiple signing options
4. **[Moderated Comments](./examples/taproot-moderation)** - Stakeable comments with penalty mechanisms
5. **[Lightning Channels](./examples/taproot-lightning)** - Efficient payment channels
6. **[Atomic Swaps](./examples/taproot-atomic-swaps)** - Trustless cross-chain exchanges
7. **[Vaults](./examples/taproot-vaults)** - Secure cold storage with delayed withdrawals
8. **[NFTs with State](./examples/taproot-nfts)** - Digital collectibles using the 32-byte state parameter

Each example includes:

- Complete TypeScript/JavaScript code using lotus-lib
- Real transaction formats (hex and JSON)
- Script breakdowns and size comparisons
- Security considerations

---

## Security Considerations

### Signature Requirements

- **Key path spending**: MUST use Schnorr signatures with SIGHASH_LOTUS
- **Script path spending**: Schnorr recommended but ECDSA supported
- Never reuse nonces (critical for Schnorr signatures)

### Best Practices

1. **Key Generation**: Use cryptographically secure random number generation
2. **Merkle Root**: For key-only outputs, use 32 zero bytes (not random)
3. **Tree Balance**: Balance script trees for optimal proof sizes
4. **State Parameter**: Use only when necessary (increases output size)

### Common Pitfalls

- ❌ Using ECDSA for key path spending (must use Schnorr)
- ❌ Using SIGHASH_FORKID without SIGHASH_LOTUS
- ❌ Using only SIGHASH_LOTUS without base type (must combine with SIGHASH_ALL)
- ❌ Forgetting to tweak private key before signing
- ❌ Using x-coordinate only (Lotus requires full 33-byte compressed pubkey)
- ❌ Calculating time-locks for 10-minute blocks (Lotus uses 2-minute blocks)

---

## Signature Hash Algorithm

Taproot key path spending MUST use `SIGHASH_LOTUS` (0x60) combined with a base type like `SIGHASH_ALL` (0x01).

**Correct Usage**: SIGHASH_ALL | SIGHASH_LOTUS = 0x61

**Incorrect**: SIGHASH_LOTUS alone (0x60) - missing base type

**SIGHASH_LOTUS Features**:

- Uses Merkle trees for efficient batch validation
- Commits to all spent outputs via Merkle tree
- Implicitly includes SIGHASH_FORKID (0x40)
- Required for Taproot key path spending
- Optional for script path spending (ECDSA with SIGHASH_FORKID also works)

**Example**:

```typescript
import { Transaction, Signature, PrivateKey } from 'lotus-lib'

const tx = new Transaction()
// ... add inputs and outputs ...

// Correct: Combine SIGHASH_ALL with SIGHASH_LOTUS
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')
```

---

## State Parameter

The optional 32-byte state parameter enables stateful smart contracts by including additional data that gets pushed onto the script stack before execution.

**Size Impact**: Adds 32 bytes to output (36 bytes → 68 bytes total)

**Visibility**: State is visible on-chain

**Use Cases**:

- **Token Commitments**: Commit to token metadata or balances
- **Channel State**: Lightning Network channel state tracking
- **Covenant Data**: Spending restrictions and conditions
- **Oracle Signatures**: Include oracle data in output
- **NFT Metadata**: Compact metadata commitments

**Trade-off**: Increased size vs enhanced functionality

**Example**:

```typescript
import { buildPayToTaproot, PublicKey } from 'lotus-lib'

const commitment = tweakedPubKey
const state = Buffer.from('0'.repeat(64), 'hex') // 32-byte state

// Create Taproot with state
const script = buildPayToTaproot(commitment, state)

console.log('Script size:', script.toBuffer().length) // 69 bytes
```

---

## Compatibility

### Consensus Status

Taproot was initially activated but is currently **disabled** in Lotus consensus (as of Numbers upgrade, December 2022). Re-activation is planned for a future network upgrade.

### Wallet Support

Full Taproot support requires:

- Schnorr signature implementation
- SIGHASH_LOTUS support
- Taproot address parsing
- Key tweaking functionality

### Testing

When Taproot is re-enabled:

1. **Regtest**: Test all functionality in controlled environment
2. **Testnet**: Verify with real network conditions
3. **Key Path First**: Start with simple single-key spending
4. **Script Path**: Test alternative spending conditions
5. **Integration**: Verify with RANK protocol and other features

### Implementation Status

Full Taproot support is available in lotus-lib including:

- Complete address support (Legacy + XAddress)
- Transaction creation and signing
- Script tree building and verification
- SIGHASH_LOTUS integration
- Schnorr signature support

**Getting Started**:

```bash
npm install lotus-lib
```

```typescript
import {
  PrivateKey,
  buildKeyPathTaproot,
  Transaction,
  TaprootInput,
  Signature,
} from 'lotus-lib'

// Generate key
const privateKey = new PrivateKey()

// Create Taproot address
const taprootScript = buildKeyPathTaproot(privateKey.publicKey)
const address = taprootScript.toAddress()

console.log('Taproot address:', address.toString())
// Example: lotus_XKrg3EtwKTM1HLFvycnfUTnkQEBCfas85MZkVjNMbJYBEomjhkQu4rt
```

---

## Technical Reference

### Constants

- `TAPROOT_VERSION`: 0xc0 (192)
- `OP_SCRIPTTYPE`: 0x62 (98)
- `ADDRESS_TYPE_BYTE`: 2

### Maximum Sizes

- Script size: 10,000 bytes (consensus limit)
- Tree depth: Unlimited (but larger proofs = higher fees)
- Control block: 33 + (32 × proof_depth) bytes
- State: 32 bytes (optional)

### Lotus Network Parameters

- Block time: ~2 minutes (average)
- Blocks per day: 720
- Blocks per week: 5,040
- Blocks per month: 21,600
- Transaction sizes: Measured in bytes (no SegWit)

### Resources

- [BIP340: Schnorr Signatures](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki)
- [BIP341: Taproot](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki)
- [BIP342: Tapscript](https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki)
- [lotus-lib Documentation](https://github.com/LogosFoundation/lotus-lib)

---

**Last Modified**: October 28, 2025
