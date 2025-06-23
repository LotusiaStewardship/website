import { Script } from 'bitcore-lib-xpi'

type ParsedScript = {
  type: 'rank'
}

export const useLokadParser = () => {
  /** key is the script hex, value is the address */
  const scripts: Map<string, ParsedScript> = new Map()

  const getLokadPrefix = (outputScript: string) => {
    const script = Script.fromHex(outputScript)
    if (!script.isDataOut()) {
      return null
    }
    // get script buffer
    const lokadChunk = script.chunks[1]
  }

  const parseScript = (outputScript: string) => {
    // TODO: fill this out
  }

  return {
    // constants
    scripts,
    // functions
    getLokadPrefix,
    parseScript,
  }
}
