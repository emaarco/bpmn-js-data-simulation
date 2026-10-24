export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(base64: string): Uint8Array {
  let normalized = base64.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  if (padding) normalized += '='.repeat(4 - padding)
  return Uint8Array.from(atob(normalized), char => char.charCodeAt(0))
}
