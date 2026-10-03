# API-sleutels

Een API-sleutel (`btk_…`) hoort bij je account en gebruikt je eigen cellen.

- Aanmaken en intrekken op je **accountpagina**. Je ziet de sleutel één keer; wij bewaren alleen een hash.
- Gebruik: `Authorization: Bearer btk_…`, of `createApi(baseUrl, apiKey)` in de bibliotheek.
- Je e-mailadres moet bevestigd zijn voordat je een sleutel kunt maken.
- Maximaal 10 actieve sleutels per account.

Uitproberen kan in de [Swagger-omgeving van de sandbox](https://playground.btransfer.nl/api/docs): klik op *Authorize* en plak je sleutel.
