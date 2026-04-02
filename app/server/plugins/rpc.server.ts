import { LotusRPC } from '~/utils/constants'

type NetworkInfo = {
  subversion: string
  localrelay: boolean
  connections: number
  connections_in: number
  warnings: string
}

type MiningInfo = {
  blocks: number
  difficulty: number
  networkhashps: number
  pooledtx: number
  chain: string
  warnings: string
}

type MempoolInfo = {
  loaded: boolean
  size: number
  bytes: number
  usage: number
  maxmempool: number
  mempoolminfee: number
  minrelaytxfee: number
  unbroadcastcount: number
}

type PeerInfo = {
  addr: string
  services: string
  servicesnames: Array<string>
  relaytxes: boolean
  lastsend: number
  lastrecv: number
  last_transaction: number
  last_proof: number
  last_block: number
  bytessent: number
  bytesrecv: number
  conntime: number
  timeoffset: number
  pingtime: number
  minping: number
  version: number
  subver: string
  inbound: boolean
  startingheight: number
  synced_headers: number
  synced_blocks: number
  geoip?: {
    country: string
    city: string
  }
}

type BlockStats = {
  avgfee: number
  avgfeerate: number
  avgtxsize: number
  blockhash: string
  feerate_percentiles: Array<number>
  height: number
  ins: number
  maxfee: number
  maxfeerate: number
  maxtxsize: number
  medianfee: number
  medianfeerate: number
  mediantxsize: number
  minfeerate: number
  mintxsize: number
  notx: number
  outs: number
  subsidy: number
  time: number
  total_out: number
  total_size: number
  totalfee: number
  txs: number
  utxo_increase: number
  utxo_size_inc: number
}

type BlockInfo = {
  hash: string
  confirmations: number
  size: number
  height: number
  tx: Array<string>
  time: number
  difficulty: number
  nTx: number
  previousblockhash: string
  nextblockhash: string
}

type TransactionInput = {
  txid: string
  vout: number
  coinbase?: string
}

type TransactionOutput = {
  value: number
  scriptPubKey: {
    addresses: Array<string>
    type: string
    asm: string
  }
}

type RawTransaction = {
  txid: string
  size: number
  vin: TransactionInput[]
  vout: TransactionOutput[]
  time?: number
  blocktime?: number
  blockhash?: string
  confirmations?: number
}

const { user, password, address, port } = LotusRPC
const rpcUrl = `http://${address}:${port}`

const sendRPCRequest = async (method: string, params: unknown[]) => {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    body: JSON.stringify({ method, params }),
    credentials: 'include',
    headers: new Headers({
      Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
    })
  })
  const json = await response.json()
  if (json.error) {
    throw new Error(json.error)
  }
  return json.result
}

export default defineNitroPlugin((nitroApp) => {
  const getMiningInfo = async (): Promise<MiningInfo> =>
    sendRPCRequest('getmininginfo', [])

  const getPeerInfo = async (): Promise<PeerInfo[]> =>
    sendRPCRequest('getpeerinfo', [])

  const getBlockCount = async (): Promise<number> =>
    sendRPCRequest('getblockcount', [])

  const getBlockHash = async (height: number): Promise<string> =>
    sendRPCRequest('getblockhash', [height])

  const getBlockStats = async (hash: string): Promise<BlockStats> =>
    sendRPCRequest('getblockstats', [hash])

  const getBlock = async (hash: string): Promise<BlockInfo> =>
    sendRPCRequest('getblock', [hash])

  const getRawTransaction = async (txid: string): Promise<RawTransaction> =>
    sendRPCRequest('getrawtransaction', [txid, true])

  const getRawMemPool = async (): Promise<string[]> =>
    sendRPCRequest('getrawmempool', [])

  const getMempoolInfo = async (): Promise<MempoolInfo> =>
    sendRPCRequest('getmempoolinfo', [])

  nitroApp.$rpc = {
    getMiningInfo,
    getPeerInfo,
    getBlockCount,
    getBlockHash,
    getBlockStats,
    getBlock,
    getRawTransaction,
    getRawMemPool,
    getMempoolInfo
  }
})

declare module 'nitropack' {
  interface NitroApp {
    $rpc: {
      getMiningInfo: () => Promise<MiningInfo>
      getPeerInfo: () => Promise<PeerInfo[]>
      getBlockCount: () => Promise<number>
      getBlockHash: (height: number) => Promise<string>
      getBlockStats: (hash: string) => Promise<BlockStats>
      getBlock: (hash: string) => Promise<BlockInfo>
      getRawTransaction: (txid: string) => Promise<RawTransaction>
      getRawMemPool: () => Promise<string[]>
      getMempoolInfo: () => Promise<MempoolInfo>
    }
  }
}

export type {
  NetworkInfo,
  MiningInfo,
  MempoolInfo,
  PeerInfo,
  BlockStats,
  BlockInfo,
  TransactionInput,
  TransactionOutput,
  RawTransaction
}
