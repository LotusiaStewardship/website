---
title: 'Taproot: NFTs with State'
linkTitle: 'NFTs'
category: Script
weight: 4.9
modified: 2025-10-28
---

## Overview

Taproot's optional 32-byte state parameter enables on-chain NFT creation with metadata commitments. The state is pushed onto the script stack before execution, allowing for provable ownership and efficient transfers.

**Key Benefits**:

- Compact metadata commitments (32 bytes on-chain)
- Privacy via key path transfers (NFT details hidden)
- Flexible spending conditions (trading, escrow, royalties)
- Compatible with existing Taproot infrastructure

**State Size**: 32 bytes (required for NFT metadata hash)

::alert{type="info"}
**Lotus Units**: All examples use **1 XPI = 1,000,000 satoshis**. NFT values range from 0.001 XPI (1,000 sats) to custom amounts.
::

---

## NFT Structure

### Taproot Output Format

```
OP_SCRIPTTYPE OP_1 <33-byte commitment> <32-byte state>
```

**Components**:

- Script size: 69 bytes total (36 + 33 for state)
- State: Hash of NFT metadata (IPFS CID, JSON metadata, etc.)
- Ownership: Controlled by commitment public key

### Metadata Schema

The 32-byte state typically contains a hash of off-chain metadata:

```typescript
interface NFTMetadata {
  name: string
  description: string
  image: string // IPFS CID or URL
  attributes?: { trait_type: string; value: string }[]
  collection?: string
  creator?: string
}

// Commit to metadata
const metadata = {
  name: 'Lotus Genesis NFT #1',
  description: 'First NFT on Lotus Taproot',
  image: 'ipfs://Qm...',
  attributes: [
    { trait_type: 'Rarity', value: 'Legendary' },
    { trait_type: 'Series', value: 'Genesis' },
  ],
}

const metadataJSON = JSON.stringify(metadata)
const metadataHash = Hash.sha256(Buffer.from(metadataJSON))

// metadataHash goes into the 32-byte state parameter
```

---

## Creating NFTs

### Minting a Single NFT

```typescript
import {
  PrivateKey,
  buildPayToTaproot,
  tweakPublicKey,
  Hash,
  Transaction,
  Output,
  Script,
} from 'lotus-lib'

// Generate creator's key
const creatorKey = new PrivateKey()

// NFT metadata
const nftMetadata = {
  name: 'Lotus Taproot NFT #001',
  description: 'A unique digital collectible',
  image: 'ipfs://QmXyz123...',
  attributes: [
    { trait_type: 'Color', value: 'Gold' },
    { trait_type: 'Edition', value: '1/100' },
  ],
  collection: 'Lotus Genesis Collection',
  creator: creatorKey.toAddress().toString(),
}

// Hash the metadata
const metadataJSON = JSON.stringify(nftMetadata)
const metadataHash = Hash.sha256(Buffer.from(metadataJSON))

console.log('Metadata hash:', metadataHash.toString('hex'))
console.log('Metadata size:', metadataJSON.length, 'bytes (off-chain)')

// Create Taproot commitment with state
const merkleRoot = Buffer.alloc(32) // Key-only, no scripts
const commitment = tweakPublicKey(creatorKey.publicKey, merkleRoot)
const nftScript = buildPayToTaproot(commitment, metadataHash)

console.log('NFT script size:', nftScript.toBuffer().length) // 69 bytes
console.log('NFT address:', nftScript.toAddress().toString())

// Mint NFT transaction
const mintTx = new Transaction()
mintTx.addInput(/* creator's UTXO */)

// Create NFT output with metadata state
mintTx.addOutput(
  new Output({
    script: nftScript,
    satoshis: 1000, // Minimal value (0.001 XPI)
  }),
)

// Change
mintTx.addOutput(
  new Output({
    script: Script.buildPublicKeyHashOut(creatorKey.toAddress()),
    satoshis: 999000, // Change
  }),
)

mintTx.sign(creatorKey)

console.log('NFT minted!')
console.log('Transaction ID:', mintTx.id)
```

---

## Minting Transaction

**JSON Format**:

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "creator_utxo_1234567890abcdef1234567890abcdef1234567890abcdef12345678",
      "outputIndex": 0,
      "scriptSig": "483045022100...",
      "sequence": 4294967295
    }
  ],
  "outputs": [
    {
      "satoshis": 1000,
      "script": "62512102abc123...20def456..." // 69-byte NFT script
    },
    {
      "satoshis": 999000,
      "script": "76a914creator...88ac"
    }
  ],
  "lockTime": 0
}
```

**Output 0 Breakdown** (NFT):

- Value: 1,000 sats (0.001 XPI)
- Script (69 bytes):
  - `62` = OP_SCRIPTTYPE
  - `51` = OP_1
  - `21` = 33 (push commitment)
  - `02abc123...` = 33-byte commitment pubkey
  - `20` = 32 (push state)
  - `def456...` = 32-byte metadata hash

---

## Transferring NFTs

### Simple Transfer (Key Path)

```typescript
import { Transaction, TaprootInput, Output, Signature } from 'lotus-lib'

// Transfer NFT to new owner
const transferTx = new Transaction()

// Input: Current NFT UTXO
transferTx.addInput(
  new TaprootInput({
    prevTxId: Buffer.from(mintTxId, 'hex'),
    outputIndex: 0,
    output: new Output({
      script: nftScript,
      satoshis: 1000,
    }),
    script: new Script(),
  }),
)

// Create new NFT output for recipient (same metadata state)
const recipientKey = new PrivateKey()
const newCommitment = tweakPublicKey(recipientKey.publicKey, merkleRoot)
const newNFTScript = buildPayToTaproot(newCommitment, metadataHash) // Same state!

// Output: NFT to new owner
transferTx.addOutput(
  new Output({
    script: newNFTScript,
    satoshis: 1000, // Same value
  }),
)

// Sign with current owner's key
transferTx.sign(
  creatorKey,
  Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS,
  'schnorr',
)

console.log('NFT transferred!')
console.log('New owner address:', newNFTScript.toAddress().toString())
```

**Transfer Transaction** (JSON):

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "nft_mint_tx_id_1234567890abcdef...",
      "outputIndex": 0,
      "scriptSig": "41abc123def456...", // 65-byte Schnorr signature
      "sequence": 4294967295
    }
  ],
  "outputs": [
    {
      "satoshis": 1000,
      "script": "62512102xyz789...20def456..." // New owner, same metadata
    }
  ],
  "lockTime": 0
}
```

**Privacy**: Transfer via key path hides any alternative trading mechanisms in the script tree.

---

## Trading NFTs

### NFT Sale with Escrow

Use script tree to enable secure trading:

```typescript
import { Script, Opcode, buildScriptPathTaproot } from 'lotus-lib'

const sellerKey = new PrivateKey()
const buyerKey = new PrivateKey()
const escrowKey = new PrivateKey()
const salePrice = 10000000 // 10 XPI

// Script 1: Buyer pays seller directly (cooperative)
const saleScript = new Script()
  .add(Opcode.OP_2)
  .add(sellerKey.publicKey.toBuffer())
  .add(buyerKey.publicKey.toBuffer())
  .add(Opcode.OP_2)
  .add(Opcode.OP_CHECKMULTISIG)

// Script 2: Escrow resolution
const escrowScript = new Script()
  .add(escrowKey.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Script 3: Refund after timeout
const refundHeight = currentHeight + 1440 // ~48 hours
const refundScript = new Script()
  .add(refundHeight)
  .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
  .add(Opcode.OP_DROP)
  .add(sellerKey.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Build trading NFT with escrow protection
const tradingTree = {
  left: { script: saleScript },
  right: {
    left: { script: escrowScript },
    right: { script: refundScript },
  },
}

const { script: tradingNFT } = buildScriptPathTaproot(
  sellerKey.publicKey,
  tradingTree,
  metadataHash, // NFT metadata in state
)

console.log('Trading NFT address:', tradingNFT.toAddress().toString())
```

### Sale Transaction (Buyer Pays)

**Step 1**: Seller creates NFT with sale terms:

```json
{
  "version": 2,
  "inputs": [{ "prevTxId": "seller_nft_utxo...", "outputIndex": 0 }],
  "outputs": [
    {
      "satoshis": 1000,
      "script": "62512102trading_commitment...20metadata_hash..."
    }
  ]
}
```

**Step 2**: Buyer pays seller (key path - cooperative):

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "trading_nft_tx...",
      "outputIndex": 0,
      "scriptSig": "41musig2_signature..." // Seller + Buyer cooperate
    }
  ],
  "outputs": [
    {
      "satoshis": 10000000,
      "script": "76a914seller_address...88ac"
    }
  ]
}
```

**Result**:

- Seller receives 10 XPI payment
- Buyer receives NFT ownership
- Transaction ~110 bytes (escrow mechanism hidden)

---

## NFT Collections

### Minting a Collection

```typescript
import { Hash } from 'lotus-lib'

// Collection metadata
const collectionInfo = {
  name: 'Lotus Legends',
  description: '100 unique legendary items',
  totalSupply: 100,
  creator: creatorAddress,
  royalty: 5, // 5% royalty
}

const collectionHash = Hash.sha256(Buffer.from(JSON.stringify(collectionInfo)))

// Mint NFTs in batch
const nfts = []
for (let i = 1; i <= 100; i++) {
  const nftMetadata = {
    ...collectionInfo,
    tokenId: i,
    name: `Lotus Legend #${i}`,
    image: `ipfs://Qm.../${i}.png`,
    attributes: generateAttributes(i), // Unique per NFT
  }

  // Hash includes both collection and individual NFT data
  const combinedData = {
    collection: collectionHash.toString('hex'),
    nft: nftMetadata,
  }
  const nftHash = Hash.sha256(Buffer.from(JSON.stringify(combinedData)))

  // Create NFT with state
  const commitment = tweakPublicKey(creatorKey.publicKey, merkleRoot)
  const nftScript = buildPayToTaproot(commitment, nftHash)

  nfts.push({
    tokenId: i,
    script: nftScript,
    address: nftScript.toAddress().toString(),
    metadata: nftMetadata,
  })
}

console.log(`Minted ${nfts.length} NFTs`)
```

**Batch Minting Transaction**:

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "creator_utxo...",
      "outputIndex": 0,
      "scriptSig": "483045...",
      "sequence": 4294967295
    }
  ],
  "outputs": [
    { "satoshis": 1000, "script": "62512102nft1...20hash1..." },
    { "satoshis": 1000, "script": "62512102nft2...20hash2..." },
    { "satoshis": 1000, "script": "62512102nft3...20hash3..." },
    // ... up to 100 NFTs
    { "satoshis": 900000, "script": "76a914creator...88ac" }
  ],
  "lockTime": 0
}
```

**Cost**: ~100,000 sats for 100 NFTs (~1,000 sats per NFT)

---

## NFT Marketplace

### Listing NFT for Sale

```typescript
import { buildScriptPathTaproot, Script, Opcode } from 'lotus-lib'

const ownerKey = new PrivateKey()
const salePrice = 5000000 // 5 XPI

// Script 1: Sale (anyone can buy by paying sale price)
// Note: Requires OP_CHECKTEMPLATEVERIFY for proper covenant
// This is simplified - full implementation needs additional opcodes
const saleScript = new Script()
  .add(ownerKey.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Script 2: Owner can cancel listing
const cancelScript = new Script()
  .add(ownerKey.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

const listingTree = {
  left: { script: saleScript },
  right: { script: cancelScript },
}

const { script: listedNFT } = buildScriptPathTaproot(
  ownerKey.publicKey,
  listingTree,
  metadataHash, // NFT state
)

console.log('Listed NFT address:', listedNFT.toAddress().toString())
console.log('Sale price: 5 XPI')
```

### Purchase Transaction

**Buyer purchases via key path** (cooperative with seller):

```json
{
  "version": 2,
  "inputs": [
    {
      "prevTxId": "listed_nft_tx...",
      "outputIndex": 0,
      "scriptSig": "41musig_signature..." // Buyer + Seller cooperate
    },
    {
      "prevTxId": "buyer_payment_utxo...",
      "outputIndex": 0,
      "scriptSig": "483045..."
    }
  ],
  "outputs": [
    {
      "satoshis": 1000,
      "script": "62512102buyer_nft...20same_metadata_hash..."
    },
    {
      "satoshis": 4750000,
      "script": "76a914seller_address...88ac"
    },
    {
      "satoshis": 250000,
      "script": "76a914creator_address...88ac"
    }
  ],
  "lockTime": 0
}
```

**Breakdown**:

- Input 0: NFT from seller (1,000 sats)
- Input 1: Payment from buyer (5,000,000 sats)
- Output 0: NFT to buyer (1,000 sats, same metadata)
- Output 1: Payment to seller (4,750,000 sats = 4.75 XPI, 95% of sale)
- Output 2: Royalty to creator (250,000 sats = 0.25 XPI, 5% royalty)

**Privacy**: Sale mechanism hidden via key path

---

## Advanced: NFT Rentals

### Time-Limited NFT Access

```typescript
import { buildScriptPathTaproot, Script, Opcode } from 'lotus-lib'

const ownerKey = new PrivateKey()
const renterKey = new PrivateKey()
const rentalEnd = currentHeight + 2160 // ~3 days
const rentalPrice = 100000 // 0.1 XPI

// Script 1: Renter can use until rental expires
const rentalScript = new Script()
  .add(rentalEnd)
  .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
  .add(Opcode.OP_DROP)
  .add(renterKey.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Script 2: Owner reclaims after expiry
const reclaimScript = new Script()
  .add(rentalEnd)
  .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
  .add(Opcode.OP_DROP)
  .add(ownerKey.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

const rentalTree = {
  left: { script: rentalScript },
  right: { script: reclaimScript },
}

const { script: rentalNFT } = buildScriptPathTaproot(
  ownerKey.publicKey,
  rentalTree,
  metadataHash, // Same NFT metadata
)

console.log('Rental NFT address:', rentalNFT.toAddress().toString())
console.log('Rental expires at block:', rentalEnd)
```

**Rental Flow**:

1. Owner creates rental NFT (locked for 3 days)
2. Renter pays rental fee
3. Renter can use NFT features for 3 days
4. After expiry, NFT returns to owner

---

## NFT Provenance

### Tracking NFT History

Each transfer updates the commitment while preserving the state:

```typescript
// Original mint
const mint: NFTTransfer = {
  txid: 'abc123...',
  from: null, // Minted
  to: creatorKey.toAddress().toString(),
  metadataHash: metadataHash.toString('hex'),
  timestamp: Date.now(),
}

// First transfer
const transfer1: NFTTransfer = {
  txid: 'def456...',
  from: creatorKey.toAddress().toString(),
  to: buyer1Address.toString(),
  metadataHash: metadataHash.toString('hex'), // Same!
  timestamp: Date.now(),
}

// Second transfer
const transfer2: NFTTransfer = {
  txid: 'ghi789...',
  from: buyer1Address.toString(),
  to: buyer2Address.toString(),
  metadataHash: metadataHash.toString('hex'), // Same!
  timestamp: Date.now(),
}

// Verify provenance: All transfers have same metadataHash
const isLegitimate =
  mint.metadataHash === transfer1.metadataHash &&
  transfer1.metadataHash === transfer2.metadataHash

console.log('NFT provenance verified:', isLegitimate)
```

**Key Insight**: The 32-byte state (metadata hash) remains constant across all transfers, proving authenticity.

---

## Metadata Verification

### Verifying NFT Authenticity

```typescript
import { extractTaprootState, Script, Hash } from 'lotus-lib'

// Given an NFT transaction
const nftTxScript = Script.fromBuffer(nftScriptHex)

// Extract the 32-byte state
const stateHash = extractTaprootState(nftTxScript)

if (!stateHash) {
  console.error('No state found - not a valid NFT')
  process.exit(1)
}

console.log('NFT metadata hash:', stateHash.toString('hex'))

// Fetch metadata from off-chain storage (IPFS, Arweave, etc.)
const metadata = await fetchMetadata('ipfs://Qm...')

// Verify hash matches
const computedHash = Hash.sha256(Buffer.from(JSON.stringify(metadata)))
const isValid = computedHash.equals(stateHash)

console.log('Metadata valid:', isValid)

if (isValid) {
  console.log('NFT Name:', metadata.name)
  console.log('NFT Description:', metadata.description)
  console.log('NFT Image:', metadata.image)
  console.log('NFT Attributes:', metadata.attributes)
}
```

---

## Use Cases

### Digital Art

```typescript
// Art NFT with high-res image on IPFS
const artNFT = {
  name: 'Lotus Sunset #42',
  description: 'A beautiful sunset over Lotus mountains',
  image: 'ipfs://QmArtwork123...',
  creator: artistAddress,
  created: '2025-10-28',
  attributes: [
    { trait_type: 'Style', value: 'Digital Painting' },
    { trait_type: 'Resolution', value: '4K' },
    { trait_type: 'Signed', value: 'Yes' },
  ],
}

const artHash = Hash.sha256(Buffer.from(JSON.stringify(artNFT)))
const artScript = buildPayToTaproot(commitment, artHash)
```

### Gaming Items

```typescript
// In-game item NFT
const gameItem = {
  name: 'Legendary Sword of Lotus',
  description: 'Rare weapon with +100 attack',
  image: 'ipfs://QmGameItem456...',
  attributes: [
    { trait_type: 'Type', value: 'Weapon' },
    { trait_type: 'Rarity', value: 'Legendary' },
    { trait_type: 'Attack', value: '100' },
    { trait_type: 'Durability', value: '1000' },
  ],
  game: 'Lotus Quest',
}

const itemHash = Hash.sha256(Buffer.from(JSON.stringify(gameItem)))
const itemScript = buildPayToTaproot(commitment, itemHash)
```

### Membership Cards

```typescript
// VIP membership NFT
const membership = {
  name: 'Lotus DAO Founder',
  description: 'Founding member of Lotus DAO',
  image: 'ipfs://QmMemberCard789...',
  attributes: [
    { trait_type: 'Tier', value: 'Founder' },
    { trait_type: 'Member ID', value: '0042' },
    { trait_type: 'Joined', value: '2025-01-01' },
    { trait_type: 'Benefits', value: 'Governance + Early Access' },
  ],
  issuer: 'Lotus DAO',
  expires: '2026-01-01',
}

const memberHash = Hash.sha256(Buffer.from(JSON.stringify(membership)))
const memberScript = buildPayToTaproot(commitment, memberHash)
```

### Event Tickets

```typescript
// Event ticket NFT
const ticket = {
  name: 'Lotus Conference 2025 - VIP Pass',
  description: 'Access to all sessions + VIP lounge',
  image: 'ipfs://QmTicket123...',
  attributes: [
    { trait_type: 'Event', value: 'Lotus Conference 2025' },
    { trait_type: 'Date', value: '2025-12-15' },
    { trait_type: 'Seat', value: 'VIP-042' },
    { trait_type: 'Access', value: 'All Sessions + VIP' },
  ],
  venue: 'Convention Center',
  validUntil: '2025-12-16',
}

const ticketHash = Hash.sha256(Buffer.from(JSON.stringify(ticket)))
const ticketScript = buildPayToTaproot(commitment, ticketHash)
```

---

## Security Considerations

### Metadata Storage

**DO**:

- ✅ Store metadata on decentralized storage (IPFS, Arweave)
- ✅ Include metadata hash in state parameter
- ✅ Verify hash before trusting metadata
- ✅ Keep backup of metadata JSON

**DON'T**:

- ❌ Store metadata only on centralized servers
- ❌ Change metadata after minting (breaks hash)
- ❌ Use mutable URLs (use IPFS CID)
- ❌ Forget to validate metadata hash

### State Parameter Validation

```typescript
// ✅ CORRECT: Verify state matches expected metadata
const extractedState = extractTaprootState(nftScript)
const expectedHash = Hash.sha256(Buffer.from(JSON.stringify(metadata)))

if (!extractedState.equals(expectedHash)) {
  throw new Error('Metadata hash mismatch - NFT may be counterfeit!')
}

// ❌ WRONG: Trust metadata without verification
const metadata = await fetchMetadata(url) // Could be fake!
```

### Transfer Validation

**Critical**: When transferring NFT, the state MUST remain identical:

```typescript
// ✅ CORRECT: Same state in new output
const newNFT = buildPayToTaproot(newCommitment, originalStateHash)

// ❌ WRONG: Different state (creates different NFT!)
const wrongNFT = buildPayToTaproot(newCommitment, differentHash)
```

### Counterfeit Prevention

```typescript
// Verify NFT authenticity
function verifyNFT(txid: string, outputIndex: number): boolean {
  // 1. Fetch transaction
  const tx = await getTransaction(txid)
  const output = tx.outputs[outputIndex]

  // 2. Extract state
  const state = extractTaprootState(Script.fromBuffer(output.script))
  if (!state) return false

  // 3. Fetch claimed metadata
  const metadata = await fetchMetadata(metadataURL)

  // 4. Verify hash
  const computedHash = Hash.sha256(Buffer.from(JSON.stringify(metadata)))
  if (!state.equals(computedHash)) return false

  // 5. Trace provenance back to original mint
  const provenance = await traceNFTHistory(txid, outputIndex)
  const originalMint = provenance[0]

  // 6. Verify creator signature on original mint
  return verifyCreatorSignature(originalMint, metadata.creator)
}
```

---

## Advanced: Dynamic NFTs

### NFTs with Updatable Attributes

Use script tree to enable controlled updates:

```typescript
// NFT with update capability
const updateScript = new Script()
  .add(creatorKey.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)
// Creator can spend and create new NFT with updated state

const burnScript = new Script().add(Opcode.OP_RETURN)
// Anyone can burn NFT (for redemption, etc.)

const dynamicTree = {
  left: { script: updateScript },
  right: { script: burnScript },
}

// Initial NFT state
let currentMetadata = { level: 1, experience: 0, items: [] }
let currentHash = Hash.sha256(Buffer.from(JSON.stringify(currentMetadata)))

const { script: dynamicNFT } = buildScriptPathTaproot(
  creatorKey.publicKey,
  dynamicTree,
  currentHash,
)

// Update NFT (level up, gain items, etc.)
function updateNFT(newAttributes: any) {
  const updatedMetadata = { ...currentMetadata, ...newAttributes }
  const newHash = Hash.sha256(Buffer.from(JSON.stringify(updatedMetadata)))

  // Create new NFT output with updated state
  const updated = buildScriptPathTaproot(
    creatorKey.publicKey,
    dynamicTree,
    newHash, // New state!
  )

  return updated
}
```

---

## Size and Cost Analysis

| NFT Type                  | Script Size | Cost            | Privacy            |
| ------------------------- | ----------- | --------------- | ------------------ |
| Simple NFT (key-only)     | 69 bytes    | 1,000 sats      | High               |
| Trading NFT (with escrow) | 69 bytes    | 1,000 sats      | High (if key path) |
| Collection NFT            | 69 bytes    | 1,000 sats each | High               |

**Comparison with Other Methods**:

| Method           | Metadata      | On-Chain Size | Cost         |
| ---------------- | ------------- | ------------- | ------------ |
| Taproot State    | Hash only     | 69 bytes      | ~1,000 sats  |
| OP_RETURN        | Full metadata | 223+ bytes    | ~2,000+ sats |
| Multiple outputs | Chunked data  | 500+ bytes    | ~5,000+ sats |

**Advantage**: Taproot NFTs are 3-5x smaller and cheaper than alternatives

---

## Testing

### Regtest Example

```typescript
import { Networks, Hash } from 'lotus-lib'

// Create test NFT on regtest
const testKey = new PrivateKey(undefined, Networks.regtest)
const testMetadata = {
  name: 'Test NFT',
  description: 'Testing Taproot NFTs',
  image: 'ipfs://QmTest...',
}

const testHash = Hash.sha256(Buffer.from(JSON.stringify(testMetadata)))
const testCommitment = tweakPublicKey(testKey.publicKey, Buffer.alloc(32))
const testNFT = buildPayToTaproot(testCommitment, testHash)

console.log('Test NFT address:', testNFT.toAddress().toString())
// Example: lotus_RKrg3...

// Verify state extraction
const extractedState = extractTaprootState(testNFT)
console.log('State matches:', extractedState.equals(testHash))
```

---

## Best Practices

### Metadata Design

**DO**:

- ✅ Use standard metadata schemas (OpenSea-compatible)
- ✅ Store images on IPFS/Arweave
- ✅ Include creator attribution
- ✅ Version your metadata schema

**DON'T**:

- ❌ Use centralized image hosting
- ❌ Exceed reasonable JSON sizes (keep < 10KB)
- ❌ Include sensitive/private data
- ❌ Use non-deterministic fields (timestamps in hash)

### Collection Management

```typescript
// Good: Deterministic collection ID
const collectionId = Hash.sha256(Buffer.from('LotusLegends'))

// Good: Consistent metadata structure
const nftMetadata = {
  name: `Item #${tokenId}`,
  collection: collectionId.toString('hex'),
  tokenId,
  ...standardFields,
}

// Bad: Non-deterministic
const badMetadata = {
  name: 'NFT',
  timestamp: Date.now(), // Changes every time!
}
```

### Transfer Validation

```typescript
// Validate transfer preserves NFT identity
function validateTransfer(inputScript: Script, outputScript: Script): boolean {
  const inputState = extractTaprootState(inputScript)
  const outputState = extractTaprootState(outputScript)

  if (!inputState || !outputState) {
    return false // Missing state
  }

  // State MUST be identical
  return inputState.equals(outputState)
}
```

---

## Summary

**Benefits**:

- ✅ Compact on-chain storage (69 bytes)
- ✅ Provable metadata commitments
- ✅ Privacy via key path transfers
- ✅ Flexible trading mechanisms
- ✅ Low minting cost (~1,000 sats per NFT)
- ✅ Collection support
- ✅ Rental and escrow capabilities

**Trade-offs**:

- Requires off-chain metadata storage
- State parameter is visible (not fully private)
- Need to maintain metadata availability
- More complex than simple token transfers

**When to Use**:

- Digital art and collectibles
- Gaming items and achievements
- Membership cards and tickets
- Proof of ownership for anything
- Collections with shared attributes

**When NOT to Use**:

- Fully on-chain metadata needed (use OP_RETURN)
- Fungible tokens (use different protocol)
- Frequently changing metadata (state is immutable per output)
- Privacy is critical (state is visible on-chain)

---

## Related Documentation

- [Taproot Overview](../taproot) - Technical fundamentals
- [Taproot Single-Key](./taproot-single-key) - Simple transfers
- [Taproot Multisig](./taproot-multisig) - Multi-party NFT ownership

---

**Last Modified**: October 28, 2025
