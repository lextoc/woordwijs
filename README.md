# Woordwijs

Leer Nederlandse woorden die je nog niet kent. De site is statisch: er is geen account en geen server. Je voortgang blijft in deze browser.

## Starten

```bash
npm ci
npm run dev
```

`npm run build` maakt de site in `dist/`. `npm run preview` toont die build. De gebouwde site haalt geen gegevens en geen lettertypen op van internet. Het woordenboek zit in de JavaScript-bundel. Inter (OFL) wordt meegeleverd. Georgia komt van het toestel, met Times New Roman als reserve.

## Schermen

| Pad | Pagina |
|---|---|
| `/` | Vandaag, met het woord van de dag |
| `/oefenen` | Oefening |
| `/oefenen/klaar` | Samenvatting van de oefening |
| `/zoeken` | Woord toevoegen |
| `/woorden` | Mijn woorden |
| `/woord/:id` | Woord |
| `/voortgang` | Je voortgang |
| `/bronnen` | Waar de woorden vandaan komen |

## Gegevens opnieuw maken

```bash
npm run data
```

Het script `scripts/build-words.mjs` leest twee bestanden. Ontbreken ze, dan downloadt het ze naar `data/cache/` (die map staat niet in git).

- Het nlwiktionary-extract van Kaikki.org, gemaakt met Wiktextract: <https://kaikki.org/nlwiktionary/raw-wiktextract-data.jsonl.gz> (dump van 2026-10-01).
- De lemmatized frequency list `nl.txt` (CC BY-SA 4.0): <https://github.com/bnpd/freqListsLemmatized>. Het eerste woord op een regel is het lemma. De regels staan op volgorde van de meest voorkomende vorm.

Een bestand in de cache wordt hergebruikt als het extract minstens 50 MB is en de frequentielijst minstens 10 KB. Dezelfde invoer geeft hetzelfde `src/data/words.json`: geen tijdstempel, vaste sleutelvolgorde, twee spaties inspringing en een newline aan het eind. De sha256 van beide bronnen staat in `meta.sources`.

`npm run build` draait het script niet. Een schone checkout bouwt met het JSON-bestand dat in de repository staat.

### Wat erin zit

Het bestand heeft `meta` en `words`. Elk woord heeft deze velden:

| Veld | Inhoud |
|---|---|
| `id` | `{woord}__{pos}`, bijvoorbeeld `huis__noun` |
| `word` | het lemma |
| `pos` | `noun`, `verb`, `adj`, `adv`, `num` of `intj` |
| `posLabel` | de Nederlandse woordsoort uit het extract, in kleine letters |
| `article` | `de`, `het`, `de/het` of `null` |
| `senses` | één tot acht betekenissen |
| `example` | de eerste voorbeeldzin, of `null` |
| `rank` | 1 is het meest frequente lemma in deze set |

De set in deze repository, uit het extract van 2026-10-01:

| | |
|---|---|
| Regels in het extract | 1.121.234 |
| Nederlandse items | 669.494 |
| Lemmas met een inhoudswoord | 171.213 |
| Lemma’s in de frequentielijst | 13.604 |
| Woorden in de set | 2.000 |
| Met een voorbeeldzin | 1.907 |
| Met een lidwoord | 945 |
| Zelfstandige naamwoorden | 1.178 |
| Werkwoorden | 365 |
| Bijvoeglijke naamwoorden | 256 |
| Bijwoorden | 159 |
| Tussenwerpsels | 34 |
| Telwoorden | 8 |

Ontbreekt een lidwoord of een voorbeeldzin, dan verbergt de site dat veld. Op de woordpagina blijft de kop Voorbeeld staan, met de zin “Voor dit woord is geen voorbeeldzin beschikbaar.”

### Hoe de set gekozen wordt

1. Vormvarianten (`form-of`) en verouderde betekenissen vallen weg.
2. Alleen zelfstandig naamwoord, werkwoord, bijvoeglijk naamwoord, bijwoord, telwoord en tussenwerpsel blijven over.
3. Een vaste lijst functiewoorden valt weg: lidwoorden, voornaamwoorden, voegwoorden, voorzetsels en woorden als *niet*, *wel*, *ja* en *nee*. Een lemma valt ook weg als de beste inhoudelijke lezing maar één betekenis heeft en een gesloten woordklasse minstens evenveel betekenissen heeft.
4. Per lemma blijft één woordsoort. Van de lezingen die hoogstens één betekenis achterlopen op de drukste lezing, wint de volgorde zelfstandig naamwoord, werkwoord, bijvoeglijk naamwoord, bijwoord, telwoord, tussenwerpsel.
5. Het script loopt de frequentielijst af tot 2.000 lemma’s. Rank 1 is het meest frequente item. Homografen van hetzelfde lemma komen niet allebei in de set.

Het lidwoord komt uit de labels in het extract: alleen onzijdig wordt *het*, mannelijk en/of vrouwelijk wordt *de*, allebei wordt *de/het*. Een leidende dubbele punt en indices als `[1]` gaan uit de betekenis. Buigingsglossen (meervoud, verkleinwoord, genitief, partitief) vallen weg. De tekst van een betekenis of voorbeeld wordt verder niet herschreven. De eerste voorbeeldzin van 8 tot 240 tekens blijft staan.

### De tien startwoorden

“Voeg 10 woorden toe” kiest tien id’s uit `meta.starterIds`. Het script zoekt die bij het bouwen: een zelfstandig naamwoord, werkwoord of bijvoeglijk naamwoord, bij voorkeur tussen rank 400 en 1400, met een voorbeeldzin van hoogstens 130 tekens waarin het lemma als heel woord staat. Het lemma *seks* en glossen met *genitief*, *partitief* of *geslachtsgemeenschap* vallen alleen voor deze tien af. De verhouding is vier zelfstandige naamwoorden, drie werkwoorden en drie bijvoeglijke naamwoorden.

### Woord van de dag

De set wordt gesorteerd op rank. De pool is het deel met een rank strikt boven 60% van de lengte, dus de minder frequente woorden. De index is FNV-1a van de lokale datum `YYYY-MM-DD`, modulo de lengte van die pool. Dezelfde datum geeft op elk toestel hetzelfde woord. De daggrens is middernacht op het toestel.

## Oefenen en voortgang

Een oefening heeft hoogstens tien woorden: eerst wat aan de beurt is, daarna hoogstens vijf nieuwe woorden. Een extra ronde pakt hoogstens tien woorden, de laatst gemiste eerst, zonder die limiet voor nieuwe woorden.

- Nieuw, of de laatste beoordeling was Niet geweten: betekenis raden.
- De laatste twee beoordelingen waren Goed of Makkelijk, en de voorbeeldzin bevat het lemma: het ontbrekende woord invullen.
- Anders: vier betekenissen kiezen. Zijn er geen drie afleiders van dezelfde woordsoort, dan valt de kaart terug op raden.

Een fout antwoord komt in dezelfde oefening terug, minstens drie kaarten later, tot drie keer.

De herhaling is SM-2. Niet geweten zet het interval op één dag. Moeilijk, Goed en Makkelijk volgen de SM-2-stappen (één dag, zes dagen, daarna interval maal gemak). Het gemak begint op 2,5 en zakt niet onder 1,3. Het interval wordt nergens getoond.

*Geleerd* staat los van dat interval. Een woord is geleerd als je het drie keer na elkaar Goed of Makkelijk had, op drie verschillende dagen. Moeilijk onderbreekt die reeks, maar haalt een geleerd woord niet terug. Niet geweten zet het woord terug naar Bezig.

Een dag telt voor de reeks als je minstens vijf verschillende woorden hebt beantwoord, of alle woorden die aan het begin van die dag aan de beurt waren als dat er minder dan vijf zijn. De reeks van vandaag telt mee zodra de dag telt. Anders blijft de reeks van gisteren zichtbaar tot middernacht. Een wijziging van de klok of de tijdzone wordt niet gecorrigeerd.

Alles staat in `localStorage` onder de sleutel `woordwijs.v1`. Een lopende oefening staat in `sessionStorage` onder `woordwijs.sessie`, zodat een tussendoor bezochte woordpagina terugkomt op dezelfde kaart. Er zijn geen cookies, geen analytics en geen export of import. De pagina Bronnen zegt dat in één zin.

## Licentie

De woorden, betekenissen en voorbeelden komen uit WikiWoordenboek, het Nederlandstalige Wiktionary. Kaikki.org publiceert het extract; Wiktextract heeft de gegevens omgezet. De frequentievolgorde komt uit de lemmatized frequency lists. Beide bronnen vallen onder [Creative Commons Naamsvermelding-GelijkDelen 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.nl).

De site past de gegevens aan: vormvarianten en functiewoorden vallen weg, per lemma blijft één woordsoort, het lidwoord is afgeleid, en betekenissen zijn ingekort zoals hierboven. De tekst zelf is niet herschreven. Dezelfde toelichting staat op Bronnen.

De code van deze site is vrij te gebruiken. De woordgegevens blijven CC BY-SA 4.0.
