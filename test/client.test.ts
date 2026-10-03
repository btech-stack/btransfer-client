import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OVERHEAD, VERSION, buildLink, chunkLabel, decrypt, encrypt, exportKey, generateKey, importKey, planManifest } from '../src/index.js'

describe('crypto', () => {
  it('versleutelt en ontsleutelt een stuk, met IV en tag als overhead', async () => {
    const key = await generateKey()
    const plain = new TextEncoder().encode('geheim')
    const cipher = await encrypt(key, plain, chunkLabel(3))
    expect(cipher.byteLength).toBe(plain.byteLength + OVERHEAD)
    const back = await decrypt(await importKey(await exportKey(key)), cipher, chunkLabel(3))
    expect(new TextDecoder().decode(back)).toBe('geheim')
  })

  it('weigert een stuk op de verkeerde plek (volgorde zit in de versleuteling)', async () => {
    const key = await generateKey()
    const cipher = await encrypt(key, new Uint8Array([1, 2, 3]), chunkLabel(1))
    await expect(decrypt(key, cipher, chunkLabel(2))).rejects.toThrow()
  })

  it('weigert een verkeerde sleutel', async () => {
    const cipher = await encrypt(await generateKey(), new Uint8Array([1]), chunkLabel(0))
    await expect(decrypt(await generateKey(), cipher, chunkLabel(0))).rejects.toThrow()
  })
})

describe('transfer', () => {
  it('verdeelt bestanden over opeenvolgende stukken', () => {
    const chunkSize = 1000
    const plain = chunkSize - OVERHEAD
    const m = planManifest(
      [
        { name: 'a', size: plain * 2 + 1, type: '', read: async () => new ArrayBuffer(0) },
        { name: 'b', size: 10, type: '', read: async () => new ArrayBuffer(0) },
      ],
      chunkSize,
    )
    expect(m.files.map((f) => [f.firstChunk, f.chunkCount])).toEqual([[0, 3], [3, 1]])
  })

  it('zet de sleutel alleen achter de #', () => {
    expect(buildLink('https://btransfer.nl', 'tok', 'KEY')).toBe('https://btransfer.nl/d/tok#KEY')
  })

  it('VERSION volgt package.json', () => {
    expect(VERSION).toBe(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version)
  })
})
