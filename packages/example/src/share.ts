import type { Model } from './editor'

const HASH_PREFIX = '#bpmn='

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(base64: string): Uint8Array {
  let normalized = base64.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  if (padding) normalized += '='.repeat(4 - padding)
  return Uint8Array.from(atob(normalized), char => char.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(piped).arrayBuffer())
}

async function encodeModel(model: Model): Promise<string> {
  const json = JSON.stringify(model)
  return toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')))
}

async function decodeModel(encoded: string): Promise<Model> {
  const inflated = await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw'))
  return JSON.parse(new TextDecoder().decode(inflated)) as Model
}

export async function readHashModel(): Promise<Model | null> {
  if (!location.hash.startsWith(HASH_PREFIX)) return null
  try {
    return await decodeModel(location.hash.slice(HASH_PREFIX.length))
  } catch {
    return null
  }
}

export async function buildShareUrl(model: Model): Promise<string> {
  return `${location.origin}${location.pathname}${HASH_PREFIX}${await encodeModel(model)}`
}
