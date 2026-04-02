import { ChronikClient } from 'chronik-client'
import type {
  Block,
  BlockInfo,
  Tx,
  BlockchainInfo,
  ScriptType,
  TxHistoryPage,
  Utxo,
} from 'chronik-client'
import { CHRONIK_API_URL } from '~/utils/constants'

export default defineNitroPlugin(nitroApp => {
  const client = new ChronikClient(CHRONIK_API_URL as string)

  const getBlockchainInfo = async (): Promise<BlockchainInfo> => {
    try {
      return await client.blockchainInfo()
    } catch {
      return {} as BlockchainInfo
    }
  }

  const getBlock = async (hashOrHeight: string | number): Promise<Block> => {
    try {
      return await client.block(hashOrHeight)
    } catch {
      return {} as Block
    }
  }

  const getBlockRange = async (
    startHeight: number,
    endHeight: number,
  ): Promise<BlockInfo[]> => {
    try {
      return await client.blocks(startHeight, endHeight)
    } catch {
      return [] as BlockInfo[]
    }
  }

  const getTransaction = async (hash: string): Promise<Tx> => {
    try {
      return await client.tx(hash)
    } catch {
      return {} as Tx
    }
  }

  const getUtxos = async (
    scriptType: ScriptType,
    scriptPayload: string,
  ): Promise<Utxo[]> => {
    try {
      const scriptEndpoint = client.script(scriptType, scriptPayload)
      const [{ utxos }] = await scriptEndpoint.utxos()
      return utxos
    } catch {
      return [] as Utxo[]
    }
  }

  const getTxHistoryPage = async (
    scriptType: ScriptType,
    scriptPayload: string,
    page: number,
    pageSize: number,
  ): Promise<TxHistoryPage> => {
    try {
      const scriptEndpoint = client.script(scriptType, scriptPayload)
      const history = await scriptEndpoint.history(page, pageSize)
      return history
    } catch {
      return {} as TxHistoryPage
    }
  }

  nitroApp.$chronik = {
    client,
    getBlockchainInfo,
    getBlock,
    getBlockRange,
    getTransaction,
    getUtxos,
    getTxHistoryPage,
  }
})

declare module 'nitropack' {
  interface NitroApp {
    $chronik: {
      client: ChronikClient
      getBlockchainInfo: () => Promise<BlockchainInfo>
      getBlock: (hashOrHeight: string | number) => Promise<Block>
      getBlockRange: (
        startHeight: number,
        endHeight: number,
      ) => Promise<BlockInfo[]>
      getTransaction: (hash: string) => Promise<Tx>
      getUtxos: (
        scriptType: ScriptType,
        scriptPayload: string,
      ) => Promise<Utxo[]>
      getTxHistoryPage: (
        scriptType: ScriptType,
        scriptPayload: string,
        page: number,
        pageSize: number,
      ) => Promise<TxHistoryPage>
    }
  }
}
