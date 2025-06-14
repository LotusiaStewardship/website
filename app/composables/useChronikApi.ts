import { ChronikClient } from 'chronik-client'
import type {
  Block,
  BlockInfo,
  Tx,
  BlockchainInfo,
  ScriptType,
  TxHistoryPage,
  Utxo
} from 'chronik-client'
import { CHRONIK_API_URL } from '~/utils/constants'

/**
 * Use the Chronik API
 * @returns ChronikApi
 */
export function useChronikApi() {
  /** Instance of the ChronikClient */
  const client = new ChronikClient(CHRONIK_API_URL)
  /**
   * Get the blockchain info
   * @returns BlockchainInfo
   */
  const getBlockchainInfo = async () => {
    try {
      return await client.blockchainInfo()
    } catch (e) {
      return {} as BlockchainInfo
    }
  }

  /**
   * Get a block by hash or height
   * @param hashOrHeight - The hash or height of the block
   * @returns Block
   */
  const getBlock = async (hashOrHeight: string | number) => {
    try {
      return await client.block(hashOrHeight)
    } catch (e) {
      return {} as Block
    }
  }

  /**
   * Get a range of blocks
   * @param startHeight - The start height
   * @param endHeight - The end height
   * @returns Block[]
   */
  const getBlockRange = async (startHeight: number, endHeight: number) => {
    try {
      return await client.blocks(startHeight, endHeight)
    } catch (e) {
      return [] as BlockInfo[]
    }
  }

  /**
   * Get a transaction by hash
   * @param hash - The hash of the transaction
   * @returns Tx
   */
  const getTransaction = async (hash: string) => {
    try {
      return await client.tx(hash)
    } catch (e) {
      return {} as Tx
    }
  }

  /**
   * Get a script endpoint
   * @param scriptType - The type of script
   * @param scriptPayload - The payload of the script
   * @returns ScriptEndpoint
   */
  const getScriptEndpoint = (scriptType: ScriptType, scriptPayload: string) => {
    try {
      return client.script(scriptType, scriptPayload)
    } catch (e) {
      return null
    }
  }

  const getUtxos = async (scriptType: ScriptType, scriptPayload: string) => {
    try {
      const scriptEndpoint = getScriptEndpoint(scriptType, scriptPayload)
      const [{ utxos }] = await scriptEndpoint.utxos()
      return utxos
    } catch (e) {
      return [] as Utxo[]
    }
  }

  /**
   * Get a page of address history
   * @param scriptEndpoint - The script endpoint
   * @returns AddressHistory
   */
  const getTxHistoryPage = async (
    scriptType: ScriptType,
    scriptPayload: string,
    page: number,
    pageSize: number
  ) => {
    try {
      const scriptEndpoint = getScriptEndpoint(scriptType, scriptPayload)
      const history = await scriptEndpoint.history(page, pageSize)
      return history
    } catch (e) {
      return {} as TxHistoryPage
    }
  }

  return {
    getBlockchainInfo,
    getBlock,
    getBlockRange,
    getTransaction,
    getScriptEndpoint,
    getUtxos,
    getTxHistoryPage
  }
}
