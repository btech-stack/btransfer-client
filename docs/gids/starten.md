# Snel starten

Met de open client-bibliotheek verstuur je bestanden vanuit je eigen code. Versleutelen gebeurt bij jou; de API ziet alleen versleutelde stukken.

## 1. Account en API-sleutel

1. Maak een account aan op [playground.btransfer.nl](https://playground.btransfer.nl) (sandbox) of [btransfer.nl](https://btransfer.nl).
2. Verstuur één transfer via de website. De downloadlink komt per mail; daarmee bevestig je je e-mailadres.
3. Maak op je accountpagina een **API-sleutel** aan. Je ziet hem één keer; bewaar hem veilig.

## 2. Installeren

```bash
npm install github:btech-stack/btransfer-client#v0.1.1
```

## 3. Versturen

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

console.log(result.link)
```

Stuur `result.link` naar de ontvanger. Die heeft geen account nodig.

## 4. Eerst de prijs weten

```ts
const quote = await api.quote({ tier: 'PAID', expiryDays: 7, plaintextBytes: data.length })
// { cells: 1, priceCents: 1, allowed: true, ... }
```

Zie [Cellen en prijzen](./cellen).
