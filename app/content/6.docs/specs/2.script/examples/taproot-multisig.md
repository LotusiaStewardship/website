---
title: 'Taproot: Multi-Signature Governance'
linkTitle: 'Multisig'
category: Script
weight: 4.4
modified: 2025-10-28
---

## Overview

Organizations can vote with a single on-chain transaction while requiring multiple signatures internally. Taproot multisig offers 63% size savings compared to traditional P2SH when using key path spending.

**Key Benefits**:

- 63% smaller transactions via key path (MuSig2)
- Privacy: Multisig structure hidden
- Flexibility: Multiple spending paths (aggregated, explicit multisig, recovery)
- Fallback options if coordination fails

::alert{type="warning"}
**RANK Protocol Requirement**: RANK transactions MUST have output 0 with value ≥ 1,000,000 satoshis (1 XPI). The burned amount determines vote weight. See the [real transaction example](https://lotusia.org/api/explorer/tx/aae24fa85b927393fd23db45c0bb5a5b245ea626c64ee64bb05aa76f3162dad7).
::

---

## Script Tree Structure

```
Commitment (internal_pubkey = aggregated key)
├── Left: 3-of-5 multisig script
└── Right: Time-locked recovery script
```

---

## Implementation

```typescript
import {
  PrivateKey,
  PublicKey,
  Script,
  Opcode,
  buildScriptPathTaproot,
} from 'lotus-lib'

// Generate 5 board member keys
const boardKeys = Array.from({ length: 5 }, () => new PrivateKey().publicKey)

// For demonstration, use first key as aggregated (in production, use MuSig2)
const internalKey = boardKeys[0]

// Build 3-of-5 multisig script
const multisigScript = new Script()
  .add(Opcode.OP_3)
  .add(boardKeys[0].toBuffer())
  .add(boardKeys[1].toBuffer())
  .add(boardKeys[2].toBuffer())
  .add(boardKeys[3].toBuffer())
  .add(boardKeys[4].toBuffer())
  .add(Opcode.OP_5)
  .add(Opcode.OP_CHECKMULTISIG)

// Build recovery script (30 days timelock)
const recoveryKey = new PrivateKey().publicKey
const recoveryHeight = 21600 // ~30 days
const recoveryScript = new Script()
  .add(recoveryHeight)
  .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
  .add(Opcode.OP_DROP)
  .add(recoveryKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Create script tree
const scriptTree = {
  left: { script: multisigScript },
  right: { script: recoveryScript },
}

const { script: taprootScript, merkleRoot } = buildScriptPathTaproot(
  internalKey,
  scriptTree,
)

console.log('Organization address:', taprootScript.toAddress().toString())
console.log('Merkle root:', merkleRoot.toString('hex'))
```

---

## Transaction Formats

### Organizational Vote Transaction

**JSON**:

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "org1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
      "outputIndex": 0,
      "scriptSig": "483045022100...",
      "sequence": 4294967295
    }
  ],
  "outputs": [
    {
      "satoshis": 100000000,
      "script": "6a0452414e4b510101100064616f6f7267616e697a6174696f6e081b85947b8c9bd036"
    },
    {
      "satoshis": 1000000,
      "script": "625121033052897837370787f788294d4e26563a64c226753387293f67d3c8d49ff90567"
    },
    {
      "satoshis": 150000000,
      "script": "76a914org_treasury...88ac"
    }
  ],
  "lockTime": 0
}
```

**Output Breakdown**:

- Output 0: OP_RETURN with RANK vote (100,000,000 sats = 100 XPI burned)
  - `6a` = OP_RETURN
  - `04 52414e4b` = "RANK" LOKAD prefix
  - `51` = Sentiment (positive, 0x51 = OP_TRUE)
  - `01` = Platform (0x01 = Twitter/X)
  - `01 10 0064616f6f7267...` = Profile ID "daoorganization" (16 bytes padded)
  - `08 1b85947b...` = Post ID (8 bytes)
- Output 1: Taproot multisig commitment (1,000,000 sats = 1 XPI, optional record)
- Output 2: Change to treasury (150,000,000 sats = 150 XPI)

### Key Path Spending (Optimal)

**Hex** (MuSig2 cooperative signature):

```
02000000016789abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456
000000004141d0bd8e4dcfae25606cfc24ae1182773e6506e0e9c4d8dd651d6ec078352b
04da4751ae6dd942381955df2e360aa8456381ad5628fe1c6558f9fdfbbe2ebb41a961ff
ffffff0140420f00000000001976a914destination_address...88ac00000000
```

**Size**: ~110 bytes (multisig structure completely hidden)

### Script Path Spending (Fallback)

When MuSig2 coordination fails, reveal and execute the 3-of-5 multisig script:

**JSON**:

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "taproot_multisig_tx...",
      "outputIndex": 1,
      "scriptSig": "00473044...473044...473044...<multisig_script><control_block>",
      "sequence": 4294967295
    }
  ],
  "outputs": [
    {
      "satoshis": 999000,
      "script": "76a914destination...88ac"
    }
  ],
  "lockTime": 0
}
```

**Input Script Breakdown**:

- `00` - OP_0 (required for CHECKMULTISIG bug)
- `47...` - Signature 1 (ECDSA, ~72 bytes)
- `47...` - Signature 2 (ECDSA, ~72 bytes)
- `47...` - Signature 3 (ECDSA, ~72 bytes)
- `4c...` - Multisig script (push + script)
- `...` - Control block (33 + merkle proof)

**Size**: ~280 bytes (reveals 3-of-5 structure)

---

## Size Comparison

| Method                    | Size       | Privacy | Savings vs P2SH |
| ------------------------- | ---------- | ------- | --------------- |
| P2SH Multisig             | ~300 bytes | Low     | Baseline        |
| Taproot Script Path       | ~280 bytes | Medium  | 7%              |
| Taproot Key Path (MuSig2) | ~110 bytes | High    | 63%             |

**Key Insights**:

- Key path: 63% smaller, multisig hidden
- Script path: Still 7% smaller, multisig revealed
- Always attempt key path first

---

## MuSig2 Overview

MuSig2 is a multi-signature scheme that creates a single aggregated signature from multiple signers.

**Benefits**:

- Single 64-byte Schnorr signature (vs 3×72 = 216 bytes for ECDSA)
- Indistinguishable from single-sig on-chain
- Maximum privacy

**Process**:

1. All signers generate nonces
2. Nonces are shared and aggregated
3. Each signer creates partial signature
4. Partial signatures are aggregated into final signature

**Note**: Full MuSig2 implementation is complex. For production use, consider specialized libraries or coordinate offline.

---

## Use Cases

### DAO Governance

**Scenario**: 5-member DAO board voting on treasury spending

```typescript
// Setup (one-time)
const daoKeys = [
  ceo.publicKey,
  cfo.publicKey,
  cto.publicKey,
  boardMember1.publicKey,
  boardMember2.publicKey,
]

// Create 3-of-5 multisig with recovery
const multisigScript = Script.buildMultisigOut(daoKeys, 3, {})
const recoveryScript = buildTimelockScript(recoveryKey, 21600)

const tree = {
  left: { script: multisigScript },
  right: { script: recoveryScript },
}

const { script } = buildScriptPathTaproot(aggregatedKey, tree)
const daoAddress = script.toAddress()

// Normal operations: MuSig2 (key path)
// Emergency: 3-of-5 explicit multisig (script path)
// Lost keys: Recovery after 30 days
```

### Corporate Treasury

**Scenario**: Company requires 2-of-3 signatures for large payments

```typescript
// 2-of-3 multisig
const corpKeys = [ceo.publicKey, cfo.publicKey, auditor.publicKey]

const multisigScript = new Script()
  .add(Opcode.OP_2)
  .add(corpKeys[0].toBuffer())
  .add(corpKeys[1].toBuffer())
  .add(corpKeys[2].toBuffer())
  .add(Opcode.OP_3)
  .add(Opcode.OP_CHECKMULTISIG)

// Aggregated key for normal operations
const aggregatedKey = createMuSig2AggregatedKey(corpKeys)

const { script } = buildScriptPathTaproot(aggregatedKey, {
  script: multisigScript,
})
```

### Family Inheritance

**Scenario**: Family vault requiring multiple family members

```typescript
// 3-of-4 family multisig
const familyKeys = [
  parent1.publicKey,
  parent2.publicKey,
  child1.publicKey,
  child2.publicKey,
]

const familyMultisig = Script.buildMultisigOut(familyKeys, 3, {})

// Lawyer recovery after 1 year
const lawyerRecovery = new Script()
  .add(52560) // ~1 year
  .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
  .add(Opcode.OP_DROP)
  .add(lawyerKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

const tree = {
  left: { script: familyMultisig },
  right: { script: lawyerRecovery },
}
```

---

## Security Considerations

### Key Management

**DO**:

- ✅ Store each signer's key separately (hardware wallets recommended)
- ✅ Document which keys belong to which signers
- ✅ Test recovery path before depositing large amounts
- ✅ Use time-locks appropriate for your use case

**DON'T**:

- ❌ Store multiple signing keys together
- ❌ Reuse nonces in MuSig2 (critical!)
- ❌ Skip testing recovery mechanisms
- ❌ Use inadequate time-locks (too short = risky, too long = inconvenient)

### Signing Coordination

For MuSig2 (key path):

1. **Round 1**: All signers generate and share nonces
2. **Round 2**: All signers create partial signatures
3. **Aggregation**: Coordinator combines into final signature

**Critical**: Never reuse nonces between signing sessions!

### Recovery Planning

Always include a recovery path:

```typescript
// Bad: No recovery if keys lost
const tree = { script: multisigScript } // Only one path!

// Good: Recovery after reasonable delay
const tree = {
  left: { script: multisigScript },
  right: { script: recoveryScript }, // Backup option
}
```

---

## Advanced: Threshold Signatures

Different thresholds for different spending amounts:

```typescript
// Small amounts: 2-of-5
const smallThreshold = new Script()
  .add(Opcode.OP_2)
  .add(...boardKeys)
  .add(Opcode.OP_5)
  .add(Opcode.OP_CHECKMULTISIG)

// Large amounts: 4-of-5
const largeThreshold = new Script()
  .add(Opcode.OP_4)
  .add(...boardKeys)
  .add(Opcode.OP_5)
  .add(Opcode.OP_CHECKMULTISIG)

// Build tree with both options
const tree = {
  left: { script: smallThreshold },
  right: { script: largeThreshold },
}

// Note: Enforcement of "small vs large" requires additional logic
// or covenant opcodes (OP_CHECKTEMPLATEVERIFY)
```

---

## Testing

### Regtest Example

```typescript
import { Networks } from 'lotus-lib'

// Generate test keys
const testKeys = Array.from(
  { length: 5 },
  () => new PrivateKey(undefined, Networks.regtest).publicKey,
)

// Build test multisig
const testMultisig = Script.buildMultisigOut(testKeys, 3, {})
const { script } = buildScriptPathTaproot(testKeys[0], {
  script: testMultisig,
})

console.log('Test address:', script.toAddress().toString())
// Example: lotus_RKrg3...
```

---

## Summary

**Benefits**:

- ✅ 63% size savings via MuSig2 key path
- ✅ Privacy: Multisig hidden from chain
- ✅ Flexibility: Multiple spending options
- ✅ Fallback: Script path if coordination fails

**Trade-offs**:

- Requires MuSig2 implementation
- More complex coordination
- Need secure nonce handling

**When to Use**:

- DAO governance
- Corporate treasuries
- Family vaults
- Any multi-party control scenario

**When NOT to Use**:

- Single signer sufficient ([use single-key](./taproot-single-key))
- Need more than 20 signers (consider m-of-n with smaller m)
- Can't coordinate for MuSig2 (use script path, but less private)

---

## Related Documentation

- [Taproot Overview](./taproot) - Technical fundamentals
- [Taproot Single-Key](./taproot-single-key) - Simple payments
- [Taproot Timelock](./taproot-timelock) - Time-locked outputs

---

**Last Modified**: October 28, 2025
