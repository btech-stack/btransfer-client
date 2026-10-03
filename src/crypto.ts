// End-to-end versleuteling: alles gebeurt hier, de sleutel verlaat de browser alleen in het #-deel van de link.
// Elk stuk = 12 bytes IV || AES-256-GCM ciphertext (incl. 16 bytes tag).
// Het volgnummer gaat mee als additional data, zodat stukken niet verwisseld kunnen worden.

export const IV_BYTES = 12
export const OVERHEAD = IV_BYTES + 16

const subtle = globalThis.crypto.subtle

export function generateKey(): Promise<CryptoKey> {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return toBase64Url(new Uint8Array(await subtle.exportKey('raw', key)))
}

export function importKey(encoded: string): Promise<CryptoKey> {
  return subtle.importKey('raw', fromBase64Url(encoded), { name: 'AES-GCM' }, false, ['decrypt'])
}

export async function encrypt(key: CryptoKey, plain: BufferSource, label: string): Promise<Uint8Array<ArrayBuffer>> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const cipher = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(label) }, key, plain)
  const out = new Uint8Array(IV_BYTES + cipher.byteLength)
  out.set(iv)
  out.set(new Uint8Array(cipher), IV_BYTES)
  return out
}

export async function decrypt(key: CryptoKey, data: Uint8Array<ArrayBuffer>, label: string): Promise<Uint8Array<ArrayBuffer>> {
  const iv = data.subarray(0, IV_BYTES)
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad(label) }, key, data.subarray(IV_BYTES))
  return new Uint8Array(plain)
}

export const chunkLabel = (index: number) => `chunk:${index}`
export const MANIFEST_LABEL = 'manifest'

function aad(label: string) {
  return new TextEncoder().encode(`btransfer/v1/${label}`)
}

function toBase64Url(bytes: Uint8Array): string {
  let s = ''
  bytes.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
