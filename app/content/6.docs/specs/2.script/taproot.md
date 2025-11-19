---
title: 'Taproot'
linkTitle: 'Taproot'
category: Script
weight: 4.1
modified: 2025-11-10
---

## Overview

Taproot is an advanced script type that enables privacy-preserving smart contracts on Lotus. This is Lotus's native implementation of Taproot, defined in the lotusd consensus code. While conceptually similar to Bitcoin's BIP341, the Lotus implementation includes significant modifications to the commitment format, control block encoding, and signature requirements that make it incompatible with Bitcoin's version. This specification documents the authoritative Lotus implementation.

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

### Lotus-Specific Features

Lotus Taproot differs from Bitcoin's implementation in critical ways:

1. **Commitment Format**:
   - Lotus: 33-byte compressed public key (0x02/0x03 prefix + 32-byte x-coordinate)
   - Bitcoin: 32-byte x-only public key (x-coordinate only)
2. **Control Block Parity Encoding**:
   - Lotus: Parity bit indicates **internal pubkey's** Y-coordinate (used to reconstruct 33-byte key)
   - Bitcoin: Parity bit indicates **commitment pubkey's** Y-coordinate
3. **Optional State Parameter**:

   - Lotus: Supports optional 32-byte state parameter for smart contracts
   - Bitcoin: No state parameter support

4. **Script Identifier**:

   - Lotus: Uses `OP_SCRIPTTYPE` (0x62) marker before version byte
   - Bitcoin: No marker opcode

5. **Signature Requirements**:
   - Lotus: SIGHASH_LOTUS (0x60) required for key path spending
   - Bitcoin: Default sighash types
6. **Address Format**:
   - Lotus: XAddress format with type byte 2 (e.g., `lotus_J...`)
   - Bitcoin: Bech32m format (e.g., `bc1p...`)

**Compatibility**: Lotus and Bitcoin Taproot implementations are **completely incompatible**. Do not attempt to use Bitcoin Taproot tools or addresses with Lotus.

---

## Address Format

Taproot addresses use XAddress encoding with type byte `2`:

**Format**: `lotus_J<base58_payload>`

**Example**:

```
lotus_JHMEcuQ6SyDcJKsSJVd6cZRSVZ8NqWZNMwAX8RDirNEazCfEgFp
```

**Encoding**:

- Prefix: "lotus"
- Network character: `_` (mainnet), `T` (testnet), `R` (regtest)
- Type byte: `2`
- Payload: 33-byte commitment public key
- Checksum: 4-byte hash

---

## Spending Paths

Taproot outputs can be spent via two distinct paths: **key path** (cooperative spending) or **script path** (revealing a specific script). Understanding when to use each is crucial for building efficient and private applications.

### Choosing Between Key Path and Script Path

**Use Key Path When**:

- ✅ All parties agree on the transaction (cooperative case)
- ✅ Privacy is paramount (hides all alternative conditions)
- ✅ Minimizing transaction size and fees
- ✅ Simple single-signature or MuSig2 multi-signature spending
- ✅ No special conditions need to be proven on-chain

**Use Script Path When**:

- ✅ Parties cannot coordinate (non-cooperative case)
- ✅ Need to prove specific conditions were met (e.g., time-lock expired)
- ✅ Fallback mechanism when key path fails
- ✅ Complex smart contract logic that must be revealed
- ✅ Multiple independent spending conditions where only one needs execution

**Decision Tree**:

```
Can all parties cooperate?
├─ YES → Use Key Path (always preferred)
│   ├─ Single signer? → buildKeyPathTaproot()
│   └─ Multiple signers? → buildMuSigTaprootKey() + MuSig2 protocol
│
└─ NO → Must use Script Path
    ├─ Single condition? → Single leaf tree
    ├─ Multiple OR conditions? → Multi-leaf tree (one will be revealed)
    └─ Complex conditions? → Nested tree with multiple branches
```

**Size Comparison**:

| Scenario        | Key Path  | Script Path | Savings |
| --------------- | --------- | ----------- | ------- |
| Single-sig      | ~67 bytes | ~180 bytes  | 63%     |
| 2-of-2 MuSig2   | ~67 bytes | ~220 bytes  | 70%     |
| 3-of-5 multisig | ~67 bytes | ~350 bytes  | 81%     |

**Key Insight**: Always structure your Taproot output to enable key path spending as the "happy path" (when all parties cooperate), with script path as the fallback for exceptional cases.

---

## Key Path Spending (Cooperative)

The most common and private way to spend Taproot outputs. When all parties can cooperate, they collectively create a single Schnorr signature that spends the output.

### How It Works

**Conceptual Model**:

```
Taproot Output (33-byte commitment)
         ↓
    Key Path Spend
         ↓
Single Schnorr Signature (65 bytes)
         ↓
    Verified & Accepted
```

The commitment is a tweaked version of an internal public key:

```
commitment = internal_pubkey + tagged_hash("TapTweak", internal_pubkey || merkle_root) × G
```

For key-only outputs (no scripts), the `merkle_root` is 32 zero bytes.

### Technical Requirements

**Signature Type**:

- **MUST** be 64-byte Schnorr signature (not ECDSA)
- **MUST** append sighash byte (typically 0x61 = SIGHASH_ALL | SIGHASH_LOTUS)
- Total: 65 bytes on stack

**Sighash Type**:

- **MUST** include `SIGHASH_LOTUS` flag (0x60)
- Typically combined: `SIGHASH_ALL | SIGHASH_LOTUS = 0x61`
- Cannot use SIGHASH_LOTUS alone (needs base type)

**lotusd Verification Process**:

1. **Stack Check**: Verify stack has exactly 1 element (the signature)
2. **Signature Length**: Verify signature is exactly 65 bytes total
3. **Signature Type**: First 64 bytes = Schnorr signature body
4. **Sighash Byte**: Last byte must include SIGHASH_LOTUS flag
5. **Extract Commitment**: Get 33-byte commitment from scriptPubKey
6. **Compute Sighash**: Calculate transaction hash based on sighash type
7. **Verify Signature**: Use `CPubKey::VerifySchnorr()` against commitment
8. **Accept**: If signature valid, transaction is accepted

**Error Conditions**:

- Stack empty or >1 element → `INVALID_STACK_OPERATION`
- Signature not 64 bytes → `TAPROOT_KEY_SPEND_MUST_USE_SCHNORR_SIG`
- Missing SIGHASH_LOTUS → `TAPROOT_KEY_SPEND_MUST_USE_LOTUS_SIGHASH`
- Invalid signature → `TAPROOT_VERIFY_SIGNATURE_FAILED`

### Signing Process

**For Single Signer**:

```typescript
import { PrivateKey, tweakPrivateKey, Transaction } from 'lotus-sdk'

// 1. Start with internal private key
const internalPrivKey = new PrivateKey()

// 2. Tweak private key with merkle root (all zeros for key-only)
const merkleRoot = Buffer.alloc(32)
const tweakedPrivKey = tweakPrivateKey(internalPrivKey, merkleRoot)

// 3. Sign transaction with tweaked key
const tx = new Transaction()
// ... add inputs and outputs ...
tx.sign(
  tweakedPrivKey,
  Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS,
  'schnorr',
)
```

**For Multiple Signers (MuSig2)**:

```typescript
import {
  buildMuSigTaprootKey,
  musigNonceGen,
  musigNonceAgg,
  signTaprootKeyPathWithMuSig2,
  musigSigAgg,
} from 'lotus-sdk'

// 1. Aggregate public keys
const result = buildMuSigTaprootKey([alice.publicKey, bob.publicKey])

// 2. Round 1: Generate and exchange nonces
const aliceNonce = musigNonceGen(alice, result.aggregatedPubKey, sighash)
const bobNonce = musigNonceGen(bob, result.aggregatedPubKey, sighash)
const aggNonce = musigNonceAgg([aliceNonce.publicNonces, bobNonce.publicNonces])

// 3. Round 2: Create and exchange partial signatures
const alicePartial = signTaprootKeyPathWithMuSig2(
  aliceNonce,
  alice,
  result.keyAggContext,
  0,
  aggNonce,
  sighash,
  result.tweak,
)
const bobPartial = signTaprootKeyPathWithMuSig2(
  bobNonce,
  bob,
  result.keyAggContext,
  1,
  aggNonce,
  sighash,
  result.tweak,
)

// 4. Aggregate into final signature
const finalSig = musigSigAgg(
  [alicePartial, bobPartial],
  aggNonce,
  sighash,
  result.commitment,
)
```

### Privacy Guarantees

**What Observers See**:

- A 33-byte compressed public key in scriptPubKey
- A 65-byte signature in scriptSig
- Standard transaction structure

**What Observers CANNOT Determine**:

- ❌ Number of signers (could be 1, 2, 100, or more)
- ❌ Identity of signers
- ❌ Whether alternative scripts exist
- ❌ What those alternative scripts contain
- ❌ Spending conditions (time-locks, multisig, etc.)

This is the **strongest privacy** available in Taproot: a 5-of-7 multisig with 10 alternative spending paths looks identical to a simple single-signature payment.

---

## Script Path Spending (Non-Cooperative)

When parties cannot cooperate or when specific conditions must be proven on-chain, script path spending reveals and executes one of the committed scripts.

### How It Works

**Conceptual Model**:

```
Taproot Output (commitment to script tree)
         ↓
    Script Path Spend
         ↓
Reveal: [script] + [control block with merkle proof]
         ↓
Verify: Prove script is in committed tree
         ↓
Execute: Run revealed script with stack elements
         ↓
    Script returns TRUE → Accepted
```

### The Script Tree Structure

Scripts are organized in a binary Merkle tree. Each leaf contains a script, and branches combine hashes:

**Example Tree**:

```
                Root Hash
               /          \
         Branch A      Branch B
         /     \        /     \
     Script1 Script2 Script3 Script4
```

To spend via Script2, you reveal:

- **Script2** itself
- **Merkle proof**: [Hash(Script1), Hash(Branch B)]
- **Control block**: Internal pubkey + parity + merkle proof

The verifier reconstructs the root and confirms it matches the commitment.

### How lotusd Knows Which Script to Execute

**The Control Block is the Key**: The control block contains a Merkle proof that identifies which specific script in the tree is being spent. The interpreter doesn't need to know the entire tree—it only needs to verify that the revealed script is a valid leaf.

**Step-by-Step Process**:

1. **Parse Input**: Extract `[stack_elements...] [script] [control_block]` from stack

   - Everything before the last 2 elements = arguments/data for the script
   - Second-to-last element = the script being executed
   - Last element = control block with proof

2. **Extract Control Block Components**:

   ```
   control_byte = control_block[0]
   leaf_version = control_byte & 0xfe    // Must be 0xc0
   parity = control_byte & 0x01          // Internal pubkey parity
   internal_pubkey_x = control_block[1:33]  // 32-byte x-coordinate
   merkle_proof = control_block[33:]     // 32-byte nodes
   ```

3. **Reconstruct Internal Pubkey**:

   ```
   prefix = (parity == 1) ? 0x03 : 0x02
   internal_pubkey = [prefix] || internal_pubkey_x  // 33 bytes
   ```

4. **Calculate Leaf Hash**:

   ```
   leaf_hash = tagged_hash("TapLeaf", leaf_version || compact_size(script) || script)
   ```

5. **Walk Merkle Tree**:

   ```
   current_hash = leaf_hash
   for each 32-byte node in merkle_proof:
       // Lexicographically order before hashing (smaller hash first)
       if current_hash < node:
           current_hash = tagged_hash("TapBranch", current_hash || node)
       else:
           current_hash = tagged_hash("TapBranch", node || current_hash)
   ```

6. **Verify Commitment**:

   ```
   tweak = tagged_hash("TapTweak", internal_pubkey || current_hash)
   expected_commitment = internal_pubkey + tweak × G
   actual_commitment = 33-byte pubkey from scriptPubKey

   if expected_commitment != actual_commitment:
       return ERROR_TAPROOT_VERIFY_COMMITMENT_FAILED
   ```

7. **Push State (if present)**:

   ```
   if scriptPubKey.length == 69:  // Has state
       state = scriptPubKey[37:69]  // Extract 32-byte state
       stack.push(state)            // Push onto execution stack
   ```

8. **Execute Script**:
   ```
   Execute the revealed script with the execution stack
   Script must complete and leave TRUE on stack top
   ```

### Input Script Format

The scriptSig for script path spending has this structure:

```
<stack_element_1> <stack_element_2> ... <stack_element_n> <script> <control_block>
```

Where stack elements are the arguments/data needed by the revealed script (e.g., signatures).

**Example - Time-Lock Script**:

```
<signature>                    // Stack element: Signature for pubkey check
<timelock_script>              // Script: <height> OP_CSV OP_DROP <pubkey> OP_CHECKSIG
<control_block>                // Proof: version|parity + internal_x + merkle_proof
```

**Example - 2-of-3 Multisig Script**:

```
<0>                           // Stack element: OP_CHECKMULTISIG bug workaround
<signature_1>                 // Stack element: First signature
<signature_2>                 // Stack element: Second signature
<multisig_script>            // Script: OP_2 <pk1> <pk2> <pk3> OP_3 OP_CHECKMULTISIG
<control_block>              // Proof: version|parity + internal_x + merkle_proof
```

### Control Block Encoding

The control block is carefully constructed to be compact and verifiable:

**Structure**:

```
Byte 0:    [(leaf_version & 0xfe) | parity_bit]
Bytes 1-32: internal_pubkey_x (32 bytes, no prefix)
Bytes 33+:  merkle_proof_nodes (32 bytes each)
```

**Why X-Coordinate Only?**

The control block stores only the 32-byte x-coordinate of the internal pubkey (not the full 33-byte compressed key). The parity bit (bit 0 of the first byte) tells us whether to use prefix 0x02 (even Y) or 0x03 (odd Y). This saves 1 byte per control block.

**Example Control Block** (no merkle proof):

```
c0                    // 0xc0 = leaf version 0xc0, parity 0 (even Y)
a1b2c3d4e5f6...       // 32-byte internal pubkey x-coordinate
                      // (no merkle proof nodes - single leaf tree)
Total: 33 bytes
```

**Example Control Block** (with merkle proof):

```
c1                    // 0xc0 = leaf version 0xc0, parity 1 (odd Y)
a1b2c3d4e5f6...       // 32-byte internal pubkey x-coordinate
1234567890ab...       // First merkle proof node (32 bytes)
fedcba098765...       // Second merkle proof node (32 bytes)
Total: 97 bytes (33 + 64)
```

### Proof Size vs Tree Depth

The control block grows with tree depth:

| Tree Structure       | Leaves | Proof Nodes | Control Block Size |
| -------------------- | ------ | ----------- | ------------------ |
| Single leaf          | 1      | 0           | 33 bytes           |
| 2 leaves             | 2      | 1           | 65 bytes           |
| 4 leaves (balanced)  | 4      | 2           | 97 bytes           |
| 8 leaves (balanced)  | 8      | 3           | 129 bytes          |
| 16 leaves (balanced) | 16     | 4           | 161 bytes          |

**Optimal Tree Design**: Balance the tree to minimize proof sizes. A balanced binary tree with N leaves requires only log₂(N) proof nodes.

---

## Smart Contracts with Script Path Fallbacks

Script path spending enables sophisticated smart contracts with multiple spending conditions. The key insight: structure your tree so the most likely path (key path) is cooperative, with script paths as fallbacks.

### Pattern 1: Primary + Recovery

**Use Case**: Normal cooperative spending with a time-locked recovery

```
Structure:
  Key Path: All parties cooperate (MuSig2)
  Script Path (fallback): Single party recovers after time-lock

Example: Lightning channel
  Key Path: Both parties sign cooperative close
  Script Path: Either party can force-close after dispute period
```

**Code Structure**:

```typescript
// Create aggregated key for cooperative case
const musig2Result = buildMuSigTaprootKey([alice.publicKey, bob.publicKey])

// Create time-locked recovery script
const recoveryScript = new Script()
  .add(Buffer.from(disputePeriod.toString(16).padStart(6, '0'), 'hex'))
  .add(Opcode.OP_CHECKSEQUENCEVERIFY)
  .add(Opcode.OP_DROP)
  .add(alice.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Build Taproot with script fallback
const result = buildMuSigTaprootKeyWithScripts(
  [alice.publicKey, bob.publicKey],
  { type: 'leaf', script: recoveryScript },
)
```

**Spending**:

- **Happy path** (99% of cases): Alice and Bob cooperate → key path (67 bytes)
- **Dispute** (1% of cases): Alice waits and uses recovery → script path (180 bytes)

### Pattern 2: Multiple OR Conditions

**Use Case**: Different parties can spend under different conditions

```
Structure:
  Key Path: All parties cooperate
  Script Paths:
    ├─ Alice after 1 day
    ├─ Bob after 1 week
    └─ 2-of-3 multisig anytime

Example: Escrow with tiered recovery
```

**Code Structure**:

```typescript
// Multiple independent conditions
const aliceRecovery = new Script()
  .add(Buffer.from(oneDayLater.toString(16).padStart(6, '0'), 'hex'))
  .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
  .add(Opcode.OP_DROP)
  .add(alice.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

const bobRecovery = new Script()
  .add(Buffer.from(oneWeekLater.toString(16).padStart(6, '0'), 'hex'))
  .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
  .add(Opcode.OP_DROP)
  .add(bob.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

const emergencyMultisig = new Script()
  .add(Opcode.OP_2)
  .add(alice.publicKey.toBuffer())
  .add(bob.publicKey.toBuffer())
  .add(charlie.publicKey.toBuffer())
  .add(Opcode.OP_3)
  .add(Opcode.OP_CHECKMULTISIG)

// Build balanced tree (minimizes proof sizes)
const scriptTree: TapNode = {
  left: { script: aliceRecovery },
  right: {
    left: { script: bobRecovery },
    right: { script: emergencyMultisig },
  },
}
```

**Merkle Tree**:

```
           Root
          /    \
    Alice      Branch
   Recovery   /     \
            Bob    Emergency
          Recovery  Multisig
```

**Spending Scenarios**:

1. **Cooperative**: Key path (all parties agree)
2. **Alice timeout**: Reveal `aliceRecovery` + proof with 1 node (65 bytes)
3. **Bob timeout**: Reveal `bobRecovery` + proof with 2 nodes (97 bytes)
4. **Emergency**: Reveal `emergencyMultisig` + proof with 2 nodes (97 bytes)

### Pattern 3: State-Based Contracts

**Use Case**: Contract behavior depends on on-chain state

```
Structure:
  Key Path: Cooperative state transition
  Script Path: Enforce state transition rules using state parameter

Example: NFT with royalty enforcement
  State: Hash of (creator_address, royalty_percentage)
  Script: Verify outputs pay correct royalty
```

**Code Structure**:

```typescript
// State: Commit to contract parameters
const contractState = {
  creatorAddress: 'lotus_...',
  royaltyPercent: 5,
}
const stateHash = Hash.sha256(Buffer.from(JSON.stringify(contractState)))

// Script: Verify royalty payment in outputs
const royaltyScript = new Script()
  // State is automatically pushed to stack: [32-byte state_hash]
  // Script verifies outputs conform to royalty rules
  .add(/* custom validation logic */)
  .add(Opcode.OP_CHECKSIG)

// Build with state parameter
const result = buildScriptPathTaproot(
  internalKey,
  { script: royaltyScript },
  stateHash, // This gets pushed to stack during script path execution
)
```

**How State Works**:

1. Output stores state in scriptPubKey (adds 33 bytes)
2. When spending via script path, lotusd automatically pushes state onto stack
3. Script can read and verify state matches expected values
4. Enables stateful smart contracts without external data sources

### Pattern 4: Hierarchical Permissions

**Use Case**: Different authorization levels for different actions

```
Structure:
  Key Path: Admin override (all admins agree)
  Script Paths:
    ├─ High value: 3-of-5 multisig
    ├─ Medium value: 2-of-5 multisig
    └─ Low value: 1-of-5 multisig

Example: DAO treasury with tiered spending limits
```

The tree structure creates spending efficiency: more common actions (low value) get shorter proofs.

### Design Principles

**1. Optimize for the Happy Path**

Always structure so cooperative case (key path) is the most likely:

- Key path: Smallest size, maximum privacy
- Script paths: Exceptional cases, fallbacks

**2. Balance the Tree**

Put frequently-used scripts near the top:

- Shorter merkle proofs
- Lower transaction fees
- Faster verification

**3. Minimize Revealed Information**

Only the executed script path is revealed:

- Unexecuted branches remain hidden
- Observers don't know how many total branches exist
- Privacy degrades gracefully (only reveal what's necessary)

**4. Consider Proof Sizes**

Tree depth affects transaction size:

```
Depth 1: 33 + 32×1 = 65 bytes
Depth 2: 33 + 32×2 = 97 bytes
Depth 3: 33 + 32×3 = 129 bytes
Depth 7: 33 + 32×7 = 257 bytes
```

Balance tree complexity vs transaction cost.

---

## Tagged Hashing

Lotus Taproot uses tagged hashing to prevent cross-protocol attacks and ensure domain separation:

```
tagged_hash(tag, msg) = SHA256(SHA256(tag) || SHA256(tag) || msg)
```

**Why Double Concatenation?**

The tag hash is concatenated twice for critical security reasons:

- **Domain Separation**: Creates unique hash domains for different contexts
- **Collision Resistance**: Makes cross-protocol attacks computationally infeasible
- **Prefix Ambiguity Prevention**: Prevents data from one context being misinterpreted in another

This algorithm is implemented in lotusd's `TaggedHash()` function (src/hash.h) and follows the same pattern as BIP340 for cryptographic consistency.

**Tags Used**:

- `TapTweak`: Tweaking the internal public key
- `TapLeaf`: Hashing individual scripts in the tree
- `TapBranch`: Hashing pairs of nodes when building Merkle tree

**Implementation**:

```typescript
import { Hash } from 'lotus-sdk'

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
import { PrivateKey, tweakPublicKey, tweakPrivateKey } from 'lotus-sdk'

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
import { Script, Opcode, buildScriptPathTaproot, TapNode } from 'lotus-sdk'

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

- Complete TypeScript/JavaScript code using lotus-sdk
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
import { Transaction, Signature, PrivateKey } from 'lotus-sdk'

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
import { buildPayToTaproot, PublicKey } from 'lotus-sdk'

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

Full Taproot support is available in lotus-sdk including:

- Complete address support (Legacy + XAddress)
- Transaction creation and signing
- Script tree building and verification
- SIGHASH_LOTUS integration
- Schnorr signature support

**Getting Started**:

```bash
npm install lotus-sdk
```

```typescript
import {
  PrivateKey,
  buildKeyPathTaproot,
  Transaction,
  TaprootInput,
  Signature,
} from 'lotus-sdk'

// Generate key
const privateKey = new PrivateKey()

// Create Taproot address
const taprootScript = buildKeyPathTaproot(privateKey.publicKey)
const address = taprootScript.toAddress()

console.log('Taproot address:', address.toString())
// Example: lotus_JHMEcuQ6SyDcJKsSJVd6cZRSVZ8NqWZNMwAX8RDirNEazCfEgFp
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

- [lotus-sdk](https://github.com/LotusiaStewardship/lotus-sdk) - TypeScript/JavaScript Taproot support
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
