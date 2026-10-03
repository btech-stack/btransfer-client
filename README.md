# btransfer-client

De open client van [BTransfer](https://btransfer.nl): bestanden end-to-end versleuteld versturen. Dit is dezelfde code die de web-app gebruikt. Zo kun je zelf controleren dat versleutelen in je browser of op je eigen server gebeurt, en niet bij ons.

- **AES-256-GCM** via Web Crypto. De sleutel wordt per transfer in de client gemaakt.
- **Stukken van max 8 MiB**, elk met een eigen IV. Het volgnummer zit in de versleuteling, dus stukken kunnen niet verwisseld worden.
- **De sleutel staat alleen in de link**, achter de `#`. Browsers sturen dat deel nooit naar een server.
- Werkt in de browser en in **Node 20+**.

Documentatie: [docs.btransfer.nl](https://docs.btransfer.nl) · API proberen: [playground.btransfer.nl/api/docs](https://playground.btransfer.nl/api/docs)

## Installeren

```bash
npm install github:btech-stack/btransfer-client#v0.2.0
```

## Versturen vanaf een server

Maak een API-sleutel aan op je accountpagina en bevestig eerst je e-mailadres (je eerste transfer via de website doet dat).

```ts
import { readFile } from 'node:fs/promises'
import { createApi, upload } from 'btransfer-client'

const base = 'https://playground.btransfer.nl'
const api = createApi(base, process.env.BTRANSFER_API_KEY)
const config = await api.config()

const data = await readFile('rapport.pdf')
const result = await upload(
  api,
  [{ name: 'rapport.pdf', size: data.length, type: 'application/pdf', read: async (s, e) => new Uint8Array(data.subarray(s, e)).buffer }],
  { chunkSize: config.chunkSize, tier: 'PAID', expiryDays: 7, origin: base },
)

console.log(result.link) // https://playground.btransfer.nl/d/…#sleutel
```

## Ontvangen

```ts
import { createApi, downloadFile, openTransfer } from 'btransfer-client'

const [token, key] = link.split('/d/')[1].split('#')
const api = createApi('https://playground.btransfer.nl')
const opened = await openTransfer(api, token, key)
for (const file of opened.manifest.files) {
  const parts: Uint8Array[] = []
  await downloadFile(api, token, opened, file, { write: async (d) => void parts.push(d), close: async () => {} })
}
await api.confirm(token) // ontvangst bevestigen: alles wordt vernietigd
```

## Ontwikkelen

```bash
npm install
npm test          # vitest
npm run build     # dist/
npm run docs:dev  # documentatiesite (VitePress)
```

## Licentie

Apache-2.0. Zie [LICENSE](LICENSE).
