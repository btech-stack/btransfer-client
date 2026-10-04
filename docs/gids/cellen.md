# Cellen

Je verbruik wordt geteld in **cellen**. **1 cel = 100 MB, 7 dagen beschikbaar.**

| Transfer | Cellen |
| --- | --- |
| Bericht of klein bestand, 7 dagen | 1 |
| 250 MB, 7 dagen | 3 |
| 1 GB, 7 dagen | 10 |
| 1 GB, 30 dagen | 20 |
| 10 GB, 30 dagen | 200 |

- **30 dagen** kost 2 cellen per 100 MB.
- **Gratis:** iedereen heeft 10 gratis cellen tegelijk in gebruik, max 5 per transfer (500 MB), 3 dagen beschikbaar. Een cel komt vrij zodra de transfer vernietigd is.
- **Tegoed kopen** voor grotere of langere transfers volgt bij de lancering.

Vraag vooraf op hoeveel cellen een transfer kost met `POST /api/quote`, of reken het zelf uit met `countCells()` uit de bibliotheek.
