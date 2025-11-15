import { Bitcore } from 'lotus-sdk'

type ParsedScript = {
  type: 'rank'
}

export const useLokadParser = () => {
  /** key is the script hex, value is the address */
  const scripts: Map<string, ParsedScript> = new Map()

  const getLokadPrefix = (outputScript: string) => {
    const script = Bitcore.Script.fromHex(outputScript)
    if (!script.isDataOut()) {
      return null
    }
    // get script buffer
    const lokadChunk = script.getData().toString('hex')
  }

  const parseScript = (outputScript: string) => {
    // TODO: fill this out
  }

  return {
    // constants
    scripts,
    // functions
    getLokadPrefix,
    parseScript
  }
}
