import type { Api, DownloadInfo, Tier } from './api.js'
import { MANIFEST_LABEL, OVERHEAD, chunkLabel, decrypt, encrypt, exportKey, generateKey, importKey } from './crypto.js'

// Werkt in de browser en in Node 20+: geen DOM-afhankelijkheden.

export interface Source {
  name: string
  size: number
  type: string
  read(start: number, end: number): Promise<ArrayBuffer>
}

export interface Sink {
  write(data: Uint8Array): Promise<void>
  close(): Promise<void>
}

export interface ManifestFile {
  name: string
  size: number
  type: string
  firstChunk: number
  chunkCount: number
}

export interface Manifest {
  v: 1
  chunkPlainSize: number
  files: ManifestFile[]
}

const CONCURRENCY = 4
const URL_BATCH = 100

export function planManifest(sources: Source[], chunkSize: number): Manifest {
  const chunkPlainSize = chunkSize - OVERHEAD
  let next = 0
  const files = sources.map((s) => {
    const chunkCount = Math.ceil(s.size / chunkPlainSize)
    const f = { name: s.name, size: s.size, type: s.type, firstChunk: next, chunkCount }
    next += chunkCount
    return f
  })
  return { v: 1, chunkPlainSize, files }
}

export interface UploadResult {
  transferId: string
  /** De sleutel (base64url). Staat alleen in de link, nooit op de server. */
  key: string
  /** Volledige downloadlink, als de server hem direct teruggaf (bevestigd e-mailadres). */
  link?: string
  /** Waar: de link is per mail naar de verzender gestuurd, zonder sleutel. Combineer met `revealLink`. */
  sentByEmail: boolean
  storedBytes: number
  objectCount: number
  uploadMs: number
}

/** Zet downloadtoken en sleutel samen tot de link die de ontvanger krijgt. */
export function buildLink(origin: string, downloadToken: string, key: string): string {
  return `${origin}/d/${downloadToken}#${key}`
}

/** Haalt na de bevestigingsmail het downloadtoken op en maakt er met de lokaal bewaarde sleutel een link van. */
export async function revealLink(api: Api, origin: string, transferId: string, revealToken: string, key: string): Promise<string> {
  const { downloadToken } = await api.reveal(transferId, revealToken)
  return buildLink(origin, downloadToken, key)
}

export async function upload(
  api: Api,
  sources: Source[],
  opts: { chunkSize: number; tier: Tier; expiryDays: number; origin: string; onProgress?: (done: number, total: number) => void },
): Promise<UploadResult> {
  const started = Date.now()
  const manifest = planManifest(sources, opts.chunkSize)
  const chunkCount = manifest.files.reduce((n, f) => n + f.chunkCount, 0)
  const total = sources.reduce((n, s) => n + s.size, 0)

  const created = await api.createTransfer({ tier: opts.tier, expiryDays: opts.expiryDays, chunkCount, plaintextBytes: total })
  const key = await generateKey()

  await put(created.manifestUploadUrl, await encrypt(key, new TextEncoder().encode(JSON.stringify(manifest)), MANIFEST_LABEL))

  // Welk bronbestand en welk bereik hoort bij een stuknummer.
  const locate = (index: number) => {
    const fi = manifest.files.findIndex((f) => index < f.firstChunk + f.chunkCount)
    const f = manifest.files[fi]
    const start = (index - f.firstChunk) * manifest.chunkPlainSize
    return { source: sources[fi], start, end: Math.min(start + manifest.chunkPlainSize, f.size) }
  }

  let done = 0
  for (let from = 0; from < chunkCount; from += URL_BATCH) {
    const urls = await api.uploadUrls(created.id, from, Math.min(URL_BATCH, chunkCount - from))
    await pool(urls, CONCURRENCY, async ({ index, url }) => {
      const { source, start, end } = locate(index)
      const plain = await source.read(start, end)
      await put(url, await encrypt(key, plain, chunkLabel(index)))
      done += end - start
      opts.onProgress?.(done, total)
    })
  }

  const uploadMs = Date.now() - started
  const result = await api.complete(created.id, uploadMs)
  const encodedKey = await exportKey(key)
  return {
    transferId: created.id,
    key: encodedKey,
    link: result.downloadToken ? buildLink(opts.origin, result.downloadToken, encodedKey) : undefined,
    sentByEmail: !result.downloadToken,
    storedBytes: result.storedBytes,
    objectCount: result.objectCount,
    uploadMs,
  }
}

export interface OpenedTransfer {
  info: DownloadInfo
  manifest: Manifest
  key: CryptoKey
}

export async function openTransfer(api: Api, token: string, encodedKey: string): Promise<OpenedTransfer> {
  const info = await api.downloadInfo(token)
  const key = await importKey(encodedKey)
  const res = await fetchRetry(info.manifestUrl)
  const plain = await decrypt(key, new Uint8Array(await res.arrayBuffer()), MANIFEST_LABEL)
  const manifest = JSON.parse(new TextDecoder().decode(plain)) as Manifest
  return { info, manifest, key }
}

/** Downloadt en ontsleutelt één bestand, stukken parallel opgehaald maar in volgorde geschreven. */
export async function downloadFile(
  api: Api,
  token: string,
  opened: OpenedTransfer,
  file: ManifestFile,
  sink: Sink,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const fetchChunk = async (index: number, url: string) => {
    const res = await fetchRetry(url)
    return decrypt(opened.key, new Uint8Array(await res.arrayBuffer()), chunkLabel(index))
  }

  let done = 0
  const end = file.firstChunk + file.chunkCount
  for (let from = file.firstChunk; from < end; from += URL_BATCH) {
    const urls = await api.downloadUrls(token, from, Math.min(URL_BATCH, end - from))
    const pending: Promise<Uint8Array>[] = []
    const flush = async () => {
      const data = await pending.shift()!
      await sink.write(data)
      done += data.byteLength
      onProgress?.(done, file.size)
    }
    for (const { index, url } of urls) {
      pending.push(fetchChunk(index, url))
      if (pending.length >= CONCURRENCY) await flush()
    }
    while (pending.length) await flush()
  }
  await sink.close()
}

async function put(url: string, body: Uint8Array<ArrayBuffer>): Promise<void> {
  await fetchRetry(url, { method: 'PUT', body })
}

async function fetchRetry(url: string, init?: RequestInit, attempts = 3): Promise<Response> {
  for (let i = 1; ; i++) {
    let res: Response | undefined
    try {
      res = await fetch(url, init)
    } catch (e) {
      if (i >= attempts) throw e // netwerkfout: opnieuw proberen
    }
    if (res?.ok) return res
    if (res && (i >= attempts || res.status < 500)) throw new Error(`Opslag gaf HTTP ${res.status}`)
    await new Promise((r) => setTimeout(r, 500 * i))
  }
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await work(items[next++])
  })
  await Promise.all(runners)
}
