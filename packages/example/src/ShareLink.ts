import type { Model } from './Editor'
import { fromBase64Url, toBase64Url } from './utils/base64Url'
import { pipeBytes } from './utils/pipeBytes'

const HASH_PREFIX = '#bpmn='

export class ShareLink {
  async read(): Promise<Model | null> {
    if (!location.hash.startsWith(HASH_PREFIX)) return null
    try {
      return await this.decode(location.hash.slice(HASH_PREFIX.length))
    } catch {
      return null
    }
  }

  async build(model: Model): Promise<string> {
    return `${location.origin}${location.pathname}${HASH_PREFIX}${await this.encode(model)}`
  }

  async syncHash(model: Model): Promise<void> {
    try {
      const url = await this.build(model)
      history.replaceState(null, '', url.slice(url.indexOf('#')))
    } catch (error) {
      console.error(error)
    }
  }

  private async encode(model: Model): Promise<string> {
    const json = JSON.stringify(model)
    return toBase64Url(await pipeBytes(new TextEncoder().encode(json), new CompressionStream('deflate-raw')))
  }

  private async decode(encoded: string): Promise<Model> {
    const inflated = await pipeBytes(fromBase64Url(encoded), new DecompressionStream('deflate-raw'))
    return JSON.parse(new TextDecoder().decode(inflated)) as Model
  }
}
