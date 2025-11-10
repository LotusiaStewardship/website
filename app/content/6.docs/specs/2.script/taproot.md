---
title: 'Taproot'
linkTitle: 'Taproot'
category: Script
weight: 4.1
modified: 2025-11-10
---

## Overview

Taproot is an advanced script type that enables privacy-preserving smart contracts on Lotus. The Lotus implementation is inspired by BIP341 (Bitcoin Taproot) but includes significant modifications to the commitment format, control block encoding, and signature requirements. This specification documents the Lotus-specific implementation as defined in the lotusd consensus code.

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
OP_SCRIPTTYPE OP_1 <33-byte commitment> [<32-byte state>]
```

**Components**:

- `OP_SCRIPTTYPE` (0x62): Marks the script as Taproot
- `OP_1` (0x51): Version byte
- **33-byte commitment**: Tweaked public key (compressed format with 0x02/0x03 prefix)
- **32-byte state** (optional): When present, pushed onto stack before executing script path spend

**Size**:

- Without state: 36 bytes total (3-byte intro + 33-byte commitment)
- With state: 69 bytes total (3-byte intro + 33-byte commitment + 1-byte push + 32-byte state)

### Differences from BIP341

1. **Commitment Format**:
   - Lotus: 33-byte compressed public key (0x02/0x03 prefix + 32-byte x-coordinate)
   - BIP341: 32-byte x-only public key (x-coordinate only, parity in control block)
2. **Control Block Parity Encoding**:
   - Lotus: Parity bit indicates internal pubkey's Y-coordinate (used to reconstruct 33-byte key)
   - BIP341: Parity bit indicates commitment pubkey's Y-coordinate
3. **Optional State**: Lotus supports an optional 32-byte state parameter (not in BIP341)

4. **Script Identifier**: Uses `OP_SCRIPTTYPE` (0x62) to mark Taproot outputs

5. **Signature Requirements**:
   - Lotus: SIGHASH_LOTUS required for key path spending
   - BIP341: Default sighash used

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

The most common and private way to spend Taproot outputs. The commitment is tweaked with the Merkle root of alternative scripts (or 32 zero bytes for key-only).

**Requirements**:

- **Single 64-byte Schnorr signature** (without sighash byte)
- **65 bytes total** on stack (64-byte signature + 1-byte sighash type)
- **SIGHASH_LOTUS required** (typically combined with SIGHASH_ALL: 0x61)
- ECDSA signatures are **explicitly forbidden** for key path spending

**Process**:

1. Calculate tapTweak: `tagged_hash("TapTweak", internal_pubkey || merkle_root)`
2. Tweak private key: `tweaked_privkey = (internal_privkey + tapTweak) mod n`
3. Sign transaction with tweaked key using Schnorr algorithm
4. Append SIGHASH_LOTUS byte (e.g., 0x61 for SIGHASH_ALL | SIGHASH_LOTUS)
5. Input script: `<65-byte schnorr signature with sighash>`

**Privacy**: Alternative spending paths remain completely hidden.

**Key-Only Taproot**: For simple single-key outputs without scripts, use `merkle_root = Buffer.alloc(32)` (32 zero bytes).

### Script Path Spending

Reveal and execute one of the committed scripts from the Merkle tree.

**Input Script Format**:

```
<signatures/data> <script> <control_block>
```

**Control Block Structure**:

- **Byte 0**: `(leaf_version & 0xfe) | parity_bit`
  - Upper 7 bits: Leaf version (must be 0xc0 for tapscript)
  - Bit 0: Parity of internal pubkey (0 = even Y-coordinate, 1 = odd Y-coordinate)
- **Bytes 1-32**: Internal public key X-coordinate only (32 bytes, without 0x02/0x03 prefix)
- **Bytes 33+**: Merkle proof nodes (32 bytes each, up to 128 nodes maximum)

**Control Block Size**:

- Minimum: 33 bytes (1 control + 32 x-coordinate, for leaf with no siblings)
- Maximum: 4,129 bytes (33 + 128 × 32, for deeply nested leaf)
- Must be exactly: 33 + (32 × n) bytes where n is the number of proof nodes

**Process**:

1. Pop control block and script from stack
2. Verify control block size is valid (33 + 32n bytes, max 4,129 bytes)
3. Verify leaf version is 0xc0 (TAPROOT_LEAF_TAPSCRIPT)
4. Reconstruct internal pubkey from x-coordinate and parity bit
5. Calculate leaf hash: `tagged_hash("TapLeaf", leaf_version || script)`
6. Walk merkle tree: lexicographically sort and combine hashes using `tagged_hash("TapBranch", ...)`
7. Verify commitment: `expected_commitment = internal_pubkey + tagged_hash("TapTweak", internal_pubkey || merkle_root) × G`
8. If output has state parameter, push it onto the stack
9. Execute the revealed script
10. Script must evaluate to true (top stack element must be truthy)

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
leaf_hash = tagged_hash("TapLeaf", version || script)
```

Where:

- `version = 0xc0` (192) - TAPROOT_LEAF_TAPSCRIPT
- `script` - The complete script as a serialized CScript (includes its own length encoding)

**Note**: The lotusd implementation directly serializes the `CScript` object, which includes the script's length as part of its serialization. In TypeScript implementations, you need to manually add compact size encoding of the script length before the script bytes.

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

- ❌ Using ECDSA for key path spending (explicitly forbidden - must use 64-byte Schnorr)
- ❌ Not using SIGHASH_LOTUS for key path spending (required by consensus)
- ❌ Using only SIGHASH_LOTUS without base type (must combine: SIGHASH_ALL | SIGHASH_LOTUS = 0x61)
- ❌ Forgetting to tweak private key before signing key path
- ❌ Using x-coordinate only for commitment (Lotus requires full 33-byte compressed pubkey in scriptPubKey)
- ❌ Including 33-byte compressed pubkey in control block (control block uses 32-byte x-coordinate only)
- ❌ Wrong parity bit interpretation (Lotus encodes **internal** pubkey parity, not commitment parity)
- ❌ Calculating time-locks for 10-minute blocks (Lotus uses ~2-minute blocks)
- ❌ Control block size not being 33 + (32 × n) bytes
- ❌ Using leaf version other than 0xc0 (only TAPROOT_LEAF_TAPSCRIPT supported)

---

## Signature Requirements

### Key Path Spending

Taproot key path spending has strict signature requirements enforced at the consensus level:

**Signature Type**:

- **MUST** be 64-byte Schnorr signature (without sighash byte)
- **MUST NOT** be ECDSA (explicitly forbidden)
- Total 65 bytes when sighash byte appended

**Sighash Type**:

- **MUST** include `SIGHASH_LOTUS` (0x60) flag
- Typically combined with base type: `SIGHASH_ALL | SIGHASH_LOTUS = 0x61`
- Cannot use `SIGHASH_LOTUS` alone (must have base type like `SIGHASH_ALL`)

**Verification**:

- Signature checked via `CPubKey::VerifySchnorr()` (64-byte signature)
- Automatically selected based on signature length (64 bytes = Schnorr, else ECDSA)
- Enforcement: `CheckTransactionSignatureEncoding()` validates signature type
- Error if ECDSA used: `TAPROOT_KEY_SPEND_MUST_USE_SCHNORR_SIG`
- Error if no SIGHASH_LOTUS: `TAPROOT_KEY_SPEND_MUST_USE_LOTUS_SIGHASH`

### Script Path Spending

Script path spending has more flexible signature requirements:

**Signature Type**:

- Can use Schnorr (64 bytes) or ECDSA (DER-encoded, typically 70-72 bytes)
- Script determines which type(s) to accept
- No consensus-level restriction on signature type

**Sighash Type**:

- SIGHASH_LOTUS recommended but not required
- Can use SIGHASH_FORKID without SIGHASH_LOTUS
- Must comply with SCRIPT_ENABLE_SIGHASH_FORKID flag

### SIGHASH_LOTUS Features

- **Value**: 0x60 (96 decimal)
- **Implicitly includes SIGHASH_FORKID**: 0x40 always set
- **Efficient validation**: Uses Merkle trees for batch validation
- **Output commitment**: Commits to all spent outputs via Merkle tree
- **Required for key path**: Consensus rule for Taproot key path spending

### Example

```typescript
import { Transaction, Signature, PrivateKey } from 'lotus-lib'

const tx = new Transaction()
// ... add inputs and outputs ...

// Correct: Schnorr with SIGHASH_ALL | SIGHASH_LOTUS for key path
const sighashType = Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS // 0x61
tx.sign(privateKey, sighashType, 'schnorr')

// Incorrect examples:
// ❌ tx.sign(privateKey, Signature.SIGHASH_LOTUS, 'schnorr') // Missing base type
// ❌ tx.sign(privateKey, Signature.SIGHASH_ALL, 'schnorr') // Missing SIGHASH_LOTUS
// ❌ tx.sign(privateKey, sighashType, 'ecdsa') // Wrong signature type for key path
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

## Verification Process

### Overview

The lotusd implementation uses `VerifyTaprootSpend()` to handle both key path and script path spending. The verification logic automatically determines the spending type based on stack contents.

### Common Checks (Both Paths)

1. **Taproot Enabled**: Verify the `SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS` flag is not set
2. **Valid P2TR Script**: Confirm scriptPubKey matches Pay-To-Taproot format
3. **Non-Empty Stack**: Stack must have at least one element
4. **No Annex**: If stack has 2+ elements, last element must not start with 0x50 (annex not supported)

### Key Path Verification (Stack Size = 1)

When stack contains exactly one element:

1. **Extract**: Signature from stack, commitment pubkey from scriptPubKey
2. **Validate Signature Encoding**:
   - Must be exactly 64 bytes (Schnorr signature body)
   - Plus 1 byte sighash type = 65 bytes total
   - ECDSA forbidden (error: `TAPROOT_KEY_SPEND_MUST_USE_SCHNORR_SIG`)
3. **Validate Sighash**:
   - Must include SIGHASH_LOTUS flag
   - Error if missing: `TAPROOT_KEY_SPEND_MUST_USE_LOTUS_SIGHASH`
4. **Verify Pubkey Encoding**: Commitment must be valid 33-byte compressed pubkey
5. **Verify Signature**: Use Schnorr verification algorithm against transaction sighash
6. **Success**: Return true if signature valid

### Script Path Verification (Stack Size ≥ 2)

When stack contains two or more elements:

1. **Extract Components**:

   - Control block: Last stack element (`stacktop(-1)`)
   - Script: Second-to-last element (`stacktop(-2)`)
   - Arguments: Remaining stack elements (for script execution)

2. **Validate Control Block Size**:

   - Minimum: 33 bytes (TAPROOT_CONTROL_BASE_SIZE)
   - Maximum: 4,129 bytes (TAPROOT_CONTROL_MAX_SIZE)
   - Must be: 33 + (32 × n) where n ≤ 128
   - Error if invalid: `TAPROOT_WRONG_CONTROL_SIZE`

3. **Validate Leaf Version**:

   - Extract: `leaf_version = control_block[0] & TAPROOT_LEAF_MASK` (0xfe)
   - Must equal: 0xc0 (TAPROOT_LEAF_TAPSCRIPT)
   - Error if not: `TAPROOT_LEAF_VERSION_NOT_SUPPORTED`

4. **Verify Commitment** (VerifyTaprootCommitment):

   - Extract parity: `parity = control_block[0] & 0x01`
   - Extract x-coordinate: `x_coord = control_block[1:33]`
   - Reconstruct internal pubkey: `prefix = (parity == 1) ? 0x03 : 0x02`
   - Calculate leaf hash: `tagged_hash("TapLeaf", leaf_version || script)`
   - Walk merkle proof:
     ```
     merkle_hash = leaf_hash
     for each node in merkle_proof:
         if merkle_hash < node (lexicographic):
             merkle_hash = tagged_hash("TapBranch", merkle_hash || node)
         else:
             merkle_hash = tagged_hash("TapBranch", node || merkle_hash)
     ```
   - Calculate tweak: `tweak = tagged_hash("TapTweak", internal_pubkey || merkle_hash)`
   - Compute expected: `expected_commitment = internal_pubkey + tweak × G`
   - Compare: `expected_commitment == commitment_from_scriptPubKey`
   - Error if mismatch: `TAPROOT_VERIFY_COMMITMENT_FAILED`

5. **Prepare Stack**:

   - Pop control block and script from stack
   - If scriptPubKey has state (size == 69 bytes):
     - Extract state: bytes [37:69]
     - Push state onto stack

6. **Execute Script**:

   - Run revealed script with prepared stack
   - Script must complete successfully
   - Top stack element must be truthy (cast to bool == true)
   - Error if false: `EVAL_FALSE`

7. **Post-Conditions**: Verify script postconditions are met

### Error Codes

- `TAPROOT_PHASEOUT`: Taproot disabled by SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS flag
- `SCRIPTTYPE_MALFORMED_SCRIPT`: Invalid scriptPubKey format
- `INVALID_STACK_OPERATION`: Empty stack
- `TAPROOT_ANNEX_NOT_SUPPORTED`: Annex element present (starts with 0x50)
- `TAPROOT_KEY_SPEND_MUST_USE_SCHNORR_SIG`: ECDSA used for key path (must be Schnorr)
- `TAPROOT_KEY_SPEND_MUST_USE_LOTUS_SIGHASH`: Missing SIGHASH_LOTUS flag
- `TAPROOT_VERIFY_SIGNATURE_FAILED`: Invalid Schnorr signature
- `TAPROOT_WRONG_CONTROL_SIZE`: Control block size invalid
- `TAPROOT_LEAF_VERSION_NOT_SUPPORTED`: Leaf version not 0xc0
- `TAPROOT_VERIFY_COMMITMENT_FAILED`: Merkle proof verification failed
- `EVAL_FALSE`: Script executed but returned false

---

## Technical Reference

### Constants

- `TAPROOT_LEAF_TAPSCRIPT`: 0xc0 (192) - Only supported leaf version
- `TAPROOT_LEAF_MASK`: 0xfe (254) - Mask to extract leaf version from control byte
- `TAPROOT_SCRIPTTYPE`: OP_1 = 0x51 (81) - Version byte in scriptPubKey
- `OP_SCRIPTTYPE`: 0x62 (98) - Taproot marker in scriptPubKey
- `ADDRESS_TYPE_BYTE`: 2 - XAddress type for Taproot addresses
- `TAPROOT_INTRO_SIZE`: 3 bytes - Size of OP_SCRIPTTYPE + OP_1 + push opcode
- `TAPROOT_SIZE_WITHOUT_STATE`: 36 bytes - scriptPubKey size without state
- `TAPROOT_SIZE_WITH_STATE`: 69 bytes - scriptPubKey size with state
- `TAPROOT_CONTROL_BASE_SIZE`: 33 bytes - Control block base (1 byte + 32 byte x-coord)
- `TAPROOT_CONTROL_NODE_SIZE`: 32 bytes - Size per merkle proof node
- `TAPROOT_CONTROL_MAX_NODE_COUNT`: 128 - Maximum merkle proof nodes
- `TAPROOT_CONTROL_MAX_SIZE`: 4,129 bytes - Maximum control block size (33 + 128×32)
- `TAPROOT_ANNEX_TAG`: 0x50 (80) - Annex marker (not supported in Lotus)
- `TAPROOT_SIGHASH_TYPE`: 0x61 - SIGHASH_ALL | SIGHASH_LOTUS (typical combination)

### Maximum Sizes

- **Script size**: 10,000 bytes (consensus limit per script)
- **Tree depth**: Maximum 128 proof nodes (TAPROOT_CONTROL_MAX_NODE_COUNT)
- **Control block**:
  - Minimum: 33 bytes (leaf with no siblings)
  - Maximum: 4,129 bytes (33 + 128 × 32)
  - Formula: 33 + (32 × n) where n ≤ 128
- **State**: Exactly 32 bytes (optional, when present adds 33 bytes to output)
- **Schnorr signature**: 64 bytes (without sighash byte)
- **Full signature**: 65 bytes (64-byte Schnorr + 1-byte sighash type)

### Lotus Network Parameters

- Block time: ~2 minutes (average)
- Blocks per day: 720
- Blocks per week: 5,040
- Blocks per month: 21,600
- Transaction sizes: Measured in bytes (no SegWit)

### Implementation References

**Consensus Implementation (lotusd)**:

- `src/script/taproot.h` - Constants and function declarations
- `src/script/taproot.cpp` - Core Taproot verification logic
- `src/script/interpreter.cpp` - `VerifyTaprootSpend()` (lines 2074-2156)
- `src/script/sigencoding.cpp` - Signature encoding validation

**Library Implementation**:

- [lotus-lib](https://github.com/LotusiaStewardship/lotus-lib) - TypeScript/JavaScript Taproot support
- `lib/bitcore/taproot.ts` - Complete Taproot implementation

**Bitcoin BIPs (Reference Only)**:

- [BIP340: Schnorr Signatures](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki)
- [BIP341: Taproot](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki) - Note: Lotus differs in key areas
- [BIP342: Tapscript](https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki)

::alert{type="warning"}
**Important**: While Lotus Taproot is inspired by Bitcoin's BIP341, there are significant differences (33-byte vs 32-byte commitments, parity encoding, SIGHASH_LOTUS requirement). Always refer to the lotusd implementation as the authoritative source for Lotus consensus rules.
::

---

**Last Modified**: November 10, 2025  
**Revision**: Updated to match lotusd consensus implementation exactly
