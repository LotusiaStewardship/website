---
title: 'Taproot: Moderated Comments'
linkTitle: 'Moderation'
category: Script
weight: 4.5
modified: 2025-10-28
---

## Overview

Comments require staked funds that can be penalized for spam or refunded for legitimate content. This creates an economic incentive for quality content while maintaining privacy for legitimate users.

**Key Parameters**:

- RNKC Burn: 1,000,000 satoshis (1 XPI minimum, serves as initial "upvote")
- Taproot Stake: 50,000 satoshis (0.05 XPI, refundable/penalizable)
- Refund Delay: 5,040 blocks (~1 week at 2 min/block)
- Penalty: 50% of stake for spam (25,000 sats = 0.025 XPI to moderation fund)

**Key Benefits**:

- Economic spam deterrent (minimum 1 XPI cost)
- Privacy for legitimate commenters (key path refund)
- Initial ranking from burned XPI
- Flexible moderation options
- Emergency recovery path

::alert{type="info"}
**RNKC Protocol**: Output 0 burns ≥ 1 XPI which serves as the initial positive ranking for the comment (like Reddit's default upvote). This is separate from the refundable Taproot stake.
::

---

## Script Tree Structure

```
Commitment
├── Left: Full refund script (height + commenter key)
└── Right:
    ├── Left: Penalty script (moderator key)
    └── Right: Emergency recovery (2-of-2 multisig)
```

---

## Implementation

```typescript
import {
  PrivateKey,
  Script,
  Opcode,
  buildScriptPathTaproot,
  Output,
} from 'lotus-lib'

// Create keys
const commenterKey = new PrivateKey()
const moderatorKey = new PrivateKey()
const emergencyKey1 = new PrivateKey()
const emergencyKey2 = new PrivateKey()

const refundHeight = 105040 // current + 5,040 blocks (~1 week)

// Script 1: Full refund after 1 week
const refundScript = new Script()
  .add(refundHeight)
  .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
  .add(Opcode.OP_DROP)
  .add(commenterKey.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Script 2: Penalty (moderator can spend immediately, splits 50/50)
const penaltyScript = new Script()
  .add(moderatorKey.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Script 3: Emergency 2-of-2 recovery
const emergencyScript = new Script()
  .add(Opcode.OP_2)
  .add(emergencyKey1.publicKey.toBuffer())
  .add(emergencyKey2.publicKey.toBuffer())
  .add(Opcode.OP_2)
  .add(Opcode.OP_CHECKMULTISIG)

// Build script tree
const scriptTree = {
  left: { script: refundScript.toBuffer() },
  right: {
    left: { script: penaltyScript.toBuffer() },
    right: { script: emergencyScript.toBuffer() },
  },
}

const { script: stakeScript, leaves } = buildScriptPathTaproot(
  commenterKey.publicKey,
  scriptTree,
)

console.log('Comment stake address:', stakeScript.toAddress().toString())
console.log('Number of spending paths:', leaves.length) // 3
```

**Creating the Comment Transaction**:

```typescript
import { Transaction, Output, Script, toScriptRNKC } from 'lotus-lib'

// Create RNKC output (minimum 1 XPI burned)
const rnkcScripts = toScriptRNKC(
  'twitter', // platform
  'mycommentuser', // your profile ID
  'targetprofile123', // profile being replied to
  '1983154469287481398', // post being replied to
  'This is my legitimate comment text here...', // comment content
)

const commentTx = new Transaction()
commentTx.addInput(/* commenter's UTXO */)

// Output 0: RNKC metadata (MUST be >= 1 XPI, this is your initial upvote)
commentTx.addOutput(
  new Output({
    script: Script.fromBuffer(rnkcScripts[0]),
    satoshis: 1000000, // 1 XPI burned (initial ranking)
  }),
)

// Output 1: Comment text (OP_RETURN, 0 sats)
commentTx.addOutput(
  new Output({
    script: Script.fromBuffer(rnkcScripts[1]),
    satoshis: 0,
  }),
)

// Output 2: Taproot stake (refundable after 1 week)
commentTx.addOutput(
  new Output({
    script: stakeScript,
    satoshis: 50000, // 0.05 XPI stake
  }),
)

// Output 3: Change
commentTx.addOutput(
  new Output({
    script: Script.buildPublicKeyHashOut(commenterAddress),
    satoshis: 98949000, // Remainder
  }),
)

commentTx.sign(commenterKey)
```

---

## Transaction Formats

### Comment Transaction

**Hex Format**:

```
020000000134562ab1234567890abcdef1234567890abcdef1234567890abcdef12345678
0000000064473044022012345678...ffffffff04000000000000000000006a14524e4b4302
01ab12cd34ef567800000000000000006a4d0150546869732069732061206c656769746
96d61746520636f6d6d656e74...0050c30000000000002462512102a1b2c3d4e5f67890
abcdef1234567890abcdef1234567890abcdef1234567890ab88888888880000000000001
976a914commenter_address...88ac00000000
```

**JSON Format**:

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "34562ab1234567890abcdef1234567890abcdef1234567890abcdef12345678",
      "outputIndex": 0,
      "scriptSig": "473044022012345678...",
      "sequence": 4294967295
    }
  ],
  "outputs": [
    {
      "satoshis": 1000000,
      "script": "6a0452414e4b43010110006d79636f6d6d656e74757365720000081b858cf93dda30ab"
    },
    {
      "satoshis": 0,
      "script": "6a4d015054686973206973206d79206c65676974696d61746520636f6d6d656e74..."
    },
    {
      "satoshis": 50000,
      "script": "62512102a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef12345678"
    },
    {
      "satoshis": 98949000,
      "script": "76a914commenter_address...88ac"
    }
  ],
  "lockTime": 0
}
```

**Output Breakdown**:

- Output 0: RNKC metadata (1,000,000 sats = 1 XPI burned, this is the initial "upvote")
  - `6a` = OP_RETURN
  - `04 52414e4b43` = "RNKC" LOKAD prefix
  - `01` = Platform (Twitter/X)
  - `01 10 006d79636f6d6d...` = Profile ID being replied to (16 bytes padded)
  - `08 1b858cf9...` = Post ID being replied to (8 bytes)
- Output 1: Comment text (0 sats, OP_RETURN with UTF-8 content)
- Output 2: Taproot stake (50,000 sats = 0.05 XPI, refundable/penalizable)
- Output 3: Change (98,949,000 sats = 98.949 XPI)

### Legitimate Refund (Key Path)

After 1 week, legitimate commenter reclaims stake:

**JSON**:

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "stake_tx_id_1234567890abcdef...",
      "outputIndex": 2,
      "scriptSig": "41d0bd8e4dcfae25606cfc24ae1182773e6506e0e9c4d8dd651d6ec078352b04da4751ae6dd942381955df2e360aa8456381ad5628fe1c6558f9fdfbbe2ebb41a9",
      "sequence": 4294967295
    }
  ],
  "outputs": [
    {
      "satoshis": 49500,
      "script": "76a914commenter_address...88ac"
    }
  ],
  "lockTime": 105040
}
```

**Input Script**:

- 65-byte Schnorr signature (key path)
- No script revealed
- Privacy preserved

**Size**: ~110 bytes

### Spam Penalty (Script Path)

Moderator penalizes spam immediately:

**JSON**:

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "stake_tx_id_1234567890abcdef...",
      "outputIndex": 2,
      "scriptSig": "473044022012345678...0220abcdef...01210312345678...<penalty_script><control_block>",
      "sequence": 4294967295
    }
  ],
  "outputs": [
    {
      "satoshis": 25000,
      "script": "76a914moderation_fund_address...88ac"
    },
    {
      "satoshis": 24500,
      "script": "76a914commenter_address...88ac"
    }
  ],
  "lockTime": 0
}
```

**Input Script Breakdown**:

- ECDSA signature from moderator (~72 bytes)
- Penalty script (~35 bytes)
- Control block (33 + merkle proof bytes)

**Output Breakdown**:

- 25,000 sats (0.025 XPI) → Moderation fund (penalty)
- 24,500 sats (0.0245 XPI) → Commenter (partial refund minus fee)

**Size**: ~250 bytes

---

## Economic Model

| Outcome            | Cost to Commenter           | Result                                             |
| ------------------ | --------------------------- | -------------------------------------------------- |
| Legitimate comment | 1,000,500 sats (1.0005 XPI) | 1 XPI burned (upvote), stake refunded, 500 sat fee |
| Spam comment       | 1,025,500 sats (1.0255 XPI) | 1 XPI burned, 25K penalty, 500 sat fee             |
| Emergency recovery | 1,000,000+ sats (1+ XPI)    | 1 XPI burned, stake via 2-of-2 multisig            |

**Cost Breakdown**:

- RNKC burn: 1 XPI (NOT refundable, becomes initial ranking/upvote)
- Taproot stake: 0.05 XPI (refundable if legitimate, 50% penalty if spam)
- Transaction fee: ~0.0005 XPI

**Incentives**:

- Legitimate users: Pay 1 XPI burn + fees, get stake back (net cost ~1.0005 XPI)
- Spammers: Pay 1 XPI burn + 0.025 XPI penalty + fees (net cost ~1.0255 XPI)
- Moderators: Receive penalty funds for work

---

## Use Case: RNKC Comments

**Scenario**: User wants to comment on a RANK proposal

**Process**:

1. **Setup** (one-time per comment):

```typescript
// Create comment stake address
const { script: stakeScript } = buildScriptPathTaproot(
  commenterKey.publicKey,
  scriptTree,
)
const stakeAddress = stakeScript.toAddress()
```

2. **Post Comment**:

```typescript
// Create transaction with comment and stake
const tx = new Transaction()
tx.addInput(/* commenter's UTXO */)
tx.addOutput(new Output({ script: buildRNKCMetadata(), satoshis: 0 }))
tx.addOutput(new Output({ script: buildCommentData(text), satoshis: 0 }))
tx.addOutput(new Output({ script: stakeScript, satoshis: 50000 }))
tx.sign(commenterKey)
```

3. **Legitimate Comment** (after 1 week):

```typescript
// Reclaim stake via key path (private)
const refundTx = new Transaction()
refundTx.addInput(
  new TaprootInput({
    /* stake UTXO */
  }),
)
refundTx.addOutput(new Output({ script: commenterAddress, satoshis: 49500 }))
refundTx.nLockTime = refundHeight
refundTx.sign(commenterKey, SIGHASH_ALL | SIGHASH_LOTUS, 'schnorr')
```

4. **Spam** (immediate):

```typescript
// Moderator penalizes via script path
const penaltyTx = new Transaction()
penaltyTx.addInput(/* build script path input with penalty script */)
penaltyTx.addOutput(new Output({ script: moderationFund, satoshis: 25000 }))
penaltyTx.addOutput(new Output({ script: commenterAddress, satoshis: 24500 }))
penaltyTx.sign(moderatorKey)
```

---

## Security Considerations

### Moderation Authority

**Critical Decision**: Who controls the moderator key?

**Options**:

1. **Single Moderator**: Fast but centralized
2. **Multisig Moderators**: 3-of-5 moderator multisig for decisions
3. **DAO Governance**: Vote on penalties (slower but decentralized)
4. **Hybrid**: Single mod for obvious spam, DAO for appeals

**Recommendation**: Use moderator multisig (3-of-5) for balanced approach

### Time-Lock Duration

```typescript
// Too short: Commenters can't reclaim before expiry
const tooShort = 144 // ~4.8 hours (risky)

// Too long: Funds locked unnecessarily
const tooLong = 52560 // ~73 days (inconvenient)

// Recommended: 1 week
const recommended = 5040 // ~1 week (balanced)
```

### Emergency Recovery

The 2-of-2 multisig emergency path allows recovery if:

- Commenter loses key
- Moderator key compromised
- Dispute resolution needed

**Setup**:

```typescript
// Trusted parties hold emergency keys
const emergencyKey1 = trustedParty1.publicKey // e.g., platform admin
const emergencyKey2 = trustedParty2.publicKey // e.g., community lead

// Both must sign to recover funds
```

---

## Advanced: Graduated Penalties

Different penalty amounts for different violations:

```typescript
// Minor spam: 25% penalty
const minorPenaltyScript = buildPenaltyScript(moderatorKey, 0.25)

// Major spam: 50% penalty
const majorPenaltyScript = buildPenaltyScript(moderatorKey, 0.5)

// Severe spam: 100% penalty
const severePenaltyScript = buildPenaltyScript(moderatorKey, 1.0)

const tree = {
  left: { script: refundScript },
  right: {
    left: { script: minorPenaltyScript },
    right: {
      left: { script: majorPenaltyScript },
      right: { script: severePenaltyScript },
    },
  },
}

// Moderator chooses appropriate path based on violation severity
```

---

## Privacy Analysis

### What's Hidden (Key Path)

When legitimate commenter reclaims via key path:

- ✅ Penalty mechanism hidden
- ✅ Moderator key unknown
- ✅ Emergency recovery hidden
- ✅ Indistinguishable from regular payment

### What's Revealed (Script Path)

When moderator penalizes:

- Penalty script revealed
- Moderator key exposed
- Tree structure partially visible
- Still hides other unused scripts

**Implication**: Legitimate users enjoy full privacy, only spammers reveal their penalty structure.

---

## Testing

### Regtest Example

```typescript
import { Networks } from 'lotus-lib'

// Setup test environment
const testCommenter = new PrivateKey(undefined, Networks.regtest)
const testModerator = new PrivateKey(undefined, Networks.regtest)

// Create test stake
const tree = buildModerationTree(testCommenter, testModerator)
const { script } = buildScriptPathTaproot(testCommenter.publicKey, tree)

console.log('Test stake address:', script.toAddress().toString())
// Test all three spending paths on regtest
```

---

## Summary

**Benefits**:

- ✅ Economic spam deterrent (25,500 sat cost)
- ✅ Privacy for legitimate users (key path)
- ✅ Flexible moderation options
- ✅ Emergency recovery mechanism
- ✅ Nearly free for legitimate commenters

**Trade-offs**:

- Requires 50,000 sat stake (temporary)
- 1-week lock period
- Need trusted moderators
- More complex than simple comments

**When to Use**:

- Comment systems with spam problems
- Need economic disincentive for abuse
- Can manage moderation keys
- Privacy important for legitimate users

**When NOT to Use**:

- Low spam risk (unnecessary complexity)
- Can't manage stake amounts
- Need immediate comment refunds
- Moderation authority unclear

---

## Related Documentation

- [Taproot Overview](./taproot) - Technical fundamentals
- [Taproot Timelock](./taproot-timelock) - Time-locked outputs
- [Taproot Multisig](./taproot-multisig) - Multiple signatures

---

**Last Modified**: October 28, 2025
