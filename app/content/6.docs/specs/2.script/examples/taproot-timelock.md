---
title: 'Taproot: Time-Locked Voting'
linkTitle: 'Time-Lock'
category: Script
weight: 4.3
modified: 2025-10-28
---

## Overview

Lock funds for a specific period to prevent vote manipulation. The commitment includes a time-lock script that can be revealed if needed, while key path spending hides the time-lock condition completely.

**Key Benefits**:

- Proves funds locked for voting period
- Privacy via key path spending
- Refund mechanism after time-lock expires
- Prevents double-voting manipulation

**Lock Period**: 720 blocks (~24 hours at 2 min/block)

::alert{type="warning"}
**RANK Protocol Requirement**: RANK transactions MUST have output 0 with value ≥ 1,000,000 satoshis (1 XPI). The burned amount in output 0 determines the vote weight. See the [real transaction example](https://lotusia.org/api/explorer/tx/aae24fa85b927393fd23db45c0bb5a5b245ea626c64ee64bb05aa76f3162dad7).
::

---

## Script Tree Structure

```
Commitment
└── Time-lock script: <height> OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG
```

---

## Implementation

```typescript
import {
  PrivateKey,
  Script,
  Opcode,
  buildScriptPathTaproot,
  Transaction,
  Output,
} from 'lotus-lib'

// Generate voter's key
const voterKey = new PrivateKey()
const currentHeight = 100000
const unlockHeight = currentHeight + 720 // ~24 hours

// Create time-lock script
const timelockScript = new Script()
  .add(unlockHeight)
  .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
  .add(Opcode.OP_DROP)
  .add(voterKey.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Build Taproot with script tree
const scriptTree = { script: timelockScript }
const {
  script: taprootScript,
  merkleRoot,
  leaves,
} = buildScriptPathTaproot(voterKey.publicKey, scriptTree)

const taprootAddress = taprootScript.toAddress()
console.log('Vote escrow address:', taprootAddress.toString())
console.log('Unlock height:', unlockHeight)
console.log('Merkle root:', merkleRoot.toString('hex'))
```

**Creating the Vote Transaction**:

```typescript
import { Transaction, Output, toScriptRANK } from 'lotus-lib'

// Create RANK output (minimum 1 XPI, recommended 10+ XPI for meaningful vote)
const rankScript = toScriptRANK(
  'positive', // sentiment
  'twitter', // platform
  'voterusername1', // profileId
  '1983154469287481398', // postId (optional)
)

const voteTx = new Transaction()
voteTx.addInput(/* voter's UTXO */)

// Output 0: RANK vote (MUST be >= 1 XPI, this is the vote weight)
voteTx.addOutput(
  new Output({
    script: Script.fromBuffer(rankScript),
    satoshis: 10000000, // 10 XPI burned = 10 XPI vote weight
  }),
)

// Output 1: Taproot time-lock (refundable)
voteTx.addOutput(
  new Output({
    script: taprootScript,
    satoshis: 100000, // 0.1 XPI locked in Taproot
  }),
)

// Output 2: Change
voteTx.addOutput(
  new Output({
    script: Script.buildPublicKeyHashOut(voterAddress),
    satoshis: 79890000, // Remainder as change
  }),
)

voteTx.sign(voterKey)
```

---

## Vote Transaction Format

**JSON**:

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
      "outputIndex": 0,
      "scriptSig": "47304402...",
      "sequence": 4294967295
    }
  ],
  "outputs": [
    {
      "satoshis": 10000000,
      "script": "6a0452414e4b5101011000766f746572757365726e616d6531081b858cf93dda30ab"
    },
    {
      "satoshis": 100000,
      "script": "62512103f847d47cbfe409c2594e121521e0b2838e6d9cf9bac1af030b4dde277bd788f6"
    },
    {
      "satoshis": 79890000,
      "script": "76a914voter_address...88ac"
    }
  ],
  "lockTime": 0
}
```

**Output Breakdown**:

- Output 0: OP_RETURN with RANK vote (10,000,000 sats = 10 XPI burned)
  - `6a` = OP_RETURN
  - `04 52414e4b` = "RANK" LOKAD prefix
  - `51` = Sentiment (positive, 0x51 = OP_TRUE)
  - `01` = Platform (0x01 = Twitter/X)
  - `01 10 00766f746572...` = Profile ID "voterusername1" (16 bytes padded)
  - `08 1b858cf9...` = Post ID (8 bytes)
- Output 1: Taproot P2TR with time-lock commitment (100,000 sats = 0.1 XPI)
- Output 2: Change back to voter (79,890,000 sats = 79.89 XPI)

---

## Spending Options

### Option 1: Key Path (Anytime, Private)

Recommended for normal spending after voting:

```typescript
// Create transaction spending the vote escrow
const spendTx = new Transaction()

spendTx.addInput(
  new TaprootInput({
    prevTxId: Buffer.from(voteTxId, 'hex'),
    outputIndex: 1, // The Taproot output
    output: new Output({
      script: taprootScript,
      satoshis: 10000,
    }),
    script: new Script(),
  }),
)

spendTx.addOutput(
  new Output({
    script: Script.buildPublicKeyHashOut(voterAddress),
    satoshis: 95000, // 5,000 sat fee (0.005 XPI)
  }),
)

// Sign with key path (hides time-lock completely)
spendTx.sign(
  voterKey,
  Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS,
  'schnorr',
)

console.log('Key path spend size:', spendTx.serialize().length / 2, 'bytes')
// Result: ~110 bytes, no script revealed
```

### Option 2: Script Path (After Lock Expires, Reveals Time-Lock)

Only needed if key path fails or for demonstration:

```typescript
import { createControlBlock } from 'lotus-lib'

// Wait until block height >= unlockHeight
const currentHeight = await getBlockHeight()
if (currentHeight < unlockHeight) {
  throw new Error(`Must wait until block ${unlockHeight}`)
}

// Create control block
const controlBlock = createControlBlock(voterKey.publicKey, 0, scriptTree)

// Transaction must have nLockTime >= unlockHeight
spendTx.nLockTime = unlockHeight

// Input script: <signature> <script> <control_block>
// This is more complex - see full example in lotus-lib/examples/
```

---

## Transaction Sizes

| Spending Method | Size       | Privacy | Notes              |
| --------------- | ---------- | ------- | ------------------ |
| Key Path        | ~110 bytes | High    | Time-lock hidden   |
| Script Path     | ~220 bytes | Medium  | Time-lock revealed |

**Recommendation**: Always use key path when possible for privacy and efficiency.

---

## Use Case: RANK Voting

**Scenario**: Voter wants to vote on a RANK proposal and prove funds were locked during voting period.

**Process**:

1. Create time-locked Taproot address (720 blocks)
2. Send vote TX with 10 XPI burned in RANK output (output 0)
3. Lock additional 0.1 XPI in Taproot time-lock (output 1)
4. Vote weight = 10 XPI (from burned amount in output 0)
5. After 720 blocks, reclaim 0.1 XPI from Taproot via key path
6. Time-lock never revealed on-chain (if using key path)

**Why Time-Lock?**:

- Prevents vote manipulation (can't double-spend vote weight)
- Proves commitment to vote
- Funds returned after voting period
- Privacy maintained via key path

---

## Security Considerations

### Time-Lock Calculation

```typescript
// Lotus blocks: ~2 minutes each
const BLOCKS_PER_HOUR = 30
const BLOCKS_PER_DAY = 720
const BLOCKS_PER_WEEK = 5040

// Common lock periods
const oneDayLock = currentHeight + BLOCKS_PER_DAY
const oneWeekLock = currentHeight + BLOCKS_PER_WEEK
```

**Always verify**:

- Current block height is accurate
- Lock duration matches intended time
- Transaction nLockTime field set correctly (for script path)

### Key Management

- ✅ Keep private key secure (controls both spending paths)
- ✅ Record unlock height for script path fallback
- ✅ Monitor block height if time-sensitive
- ❌ Don't lose key (funds locked until height reached)

### Common Mistakes

```typescript
// ❌ WRONG: Using Bitcoin block times (10 min)
const wrongLock = currentHeight + 144 // Only ~4.8 hours on Lotus!

// ✅ CORRECT: Using Lotus block times (2 min)
const correctLock = currentHeight + 720 // ~24 hours on Lotus

// ❌ WRONG: Forgetting nLockTime for script path
tx.nLockTime = 0 // Script path will fail!

// ✅ CORRECT: Setting nLockTime for script path
tx.nLockTime = unlockHeight // Required for CHECKLOCKTIMEVERIFY
```

---

## Advanced: Multiple Time-Locks

Different unlock periods for different conditions:

```typescript
// Early unlock (1 day) with penalty
const earlyUnlockScript = new Script()
  .add(currentHeight + 720)
  .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
  .add(Opcode.OP_DROP)
  .add(earlyKey.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Full refund (1 week)
const fullRefundScript = new Script()
  .add(currentHeight + 5040)
  .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
  .add(Opcode.OP_DROP)
  .add(voterKey.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Build tree with both options
const tree = {
  left: { script: earlyUnlockScript },
  right: { script: fullRefundScript },
}

const { script } = buildScriptPathTaproot(voterKey.publicKey, tree)
```

---

## Related Documentation

- [Taproot Overview](../taproot) - Technical fundamentals
- [Taproot Single-Key](./taproot-single-key) - Simple payments
- [Taproot Moderation](./taproot-moderation) - Stakeable comments

---

**Last Modified**: October 28, 2025
