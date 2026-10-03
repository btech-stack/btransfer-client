# Hoe de versleuteling werkt

**Kort:** de client maakt per transfer een sleutel, versleutelt alles zelf, en zet de sleutel alleen in het `#`-deel van de link. BTransfer slaat versleutelde stukken en metadata op, maar nooit de sleutel.

## Stappen

1. **Sleutel maken.** Per transfer een willekeurige AES-256-sleutel via Web Crypto (`crypto.subtle.generateKey`).
2. **Opknippen en versleutelen.** Elk bestand gaat in stukken van maximaal 8 MiB. Elk stuk krijgt een eigen IV van 12 bytes en wordt versleuteld met AES-256-GCM. Het volgnummer van het stuk zit in de *additional data*: een stuk op de verkeerde plek faalt bij ontsleutelen.
3. **Manifest.** Bestandsnamen, groottes en de indeling in stukken staan in een manifest dat óók versleuteld wordt. De server kent dus geen bestandsnamen.
4. **Uploaden.** De client krijgt pre-signed URL's en uploadt de versleutelde stukken direct naar de opslag. Objectnamen zijn willekeurig.
5. **Link.** `https://btransfer.nl/d/<downloadtoken>#<sleutel>`. Browsers sturen alles na de `#` nooit naar een server.
6. **Ontvangen.** De ontvanger haalt de stukken op, ontsleutelt ze in de eigen browser en bevestigt de ontvangst. Daarna verwijdert BTransfer alle stukken.

## Wat de server wel ziet

Grootte, aantal stukken, tijdstippen, het e-mailadres van de verzender en of er gedownload en bevestigd is. Genoeg voor afrekening en bewijs, niet voor de inhoud.

## Formaat van een stuk

```
[ 12 bytes IV ][ ciphertext ][ 16 bytes GCM-tag ]
additional data = "btransfer/v1/chunk:<index>"   (manifest: "btransfer/v1/manifest")
```

De code staat in [`src/crypto.ts`](https://github.com/btech-stack/btransfer-client/blob/main/src/crypto.ts).

## De downloadlink per mail

Heeft je account nog geen bevestigd e-mailadres, dan stuurt BTransfer de downloadlink **zonder sleutel** naar de verzender. Open je die mail in de browser waarmee je verstuurde, dan voegt die browser de sleutel toe. Zo bevestig je je adres zonder dat de sleutel ooit langs onze server of mailserver gaat.
