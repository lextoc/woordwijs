# Woordwijs

Leer Nederlandse woorden die je nog niet kent. De site is statisch: er is geen account en geen server. Je voortgang blijft in deze browser.

## Starten

```bash
npm ci
npm run dev
```

`npm run build` maakt de site in `dist/`. `npm run preview` toont die build. De gebouwde site haalt geen gegevens en geen lettertypen op van internet. Het woordenboek zit in de JavaScript-bundel. Inter (OFL) wordt meegeleverd. Georgia komt van het toestel, met Times New Roman als reserve.

### Diepe links

De site gebruikt paden als `/voortgang` en `/woord/kwistig__adj`. `npm run preview` stuurt zo’n pad naar `index.html`. Een host die alleen bestanden uitdeelt, doet dat niet: een verversing of een directe link geeft dan een 404. Zet daar een rewrite naar `index.html`. Bij nginx is dat `try_files $uri $uri/ /index.html;`. Bij Netlify of Cloudflare Pages volstaat een bestand `_redirects` met de regel `/* /index.html 200`.

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
| `id` | `{woord}__{pos}`, bijvoorbeeld `kwistig__adj` |
| `word` | het lemma |
| `pos` | `noun`, `verb`, `adj` of `adv` |
| `posLabel` | de Nederlandse woordsoort uit het extract, in kleine letters |
| `article` | `de`, `het`, `de/het` of `null` |
| `senses` | één tot acht betekenissen |
| `example` | de eerste voorbeeldzin, of `null` |
| `rank` | plaats in de set: formeel eerst, dan bijwoord, bijvoeglijk naamwoord, zelfstandig naamwoord en werkwoord, en daarbinnen alfabetisch. Geen frequentie |

De set in deze repository, uit het extract van 2026-10-01:

| | |
|---|---|
| Regels in het extract | 1.121.234 |
| Nederlandse items | 669.494 |
| Kandidaten vóór één woordsoort per lemma | 404 |
| Lemma’s in de frequentielijst | 13.604 |
| Woorden in de set | 400 |
| Met een voorbeeldzin | 400 |
| Met een lidwoord | 35 |
| Zelfstandige naamwoorden | 114 |
| Werkwoorden | 98 |
| Bijvoeglijke naamwoorden | 136 |
| Bijwoorden | 52 |

Ontbreekt een lidwoord of een voorbeeldzin, dan verbergt de site dat veld. Op de woordpagina blijft de kop Voorbeeld staan, met de zin “Voor dit woord is geen voorbeeldzin beschikbaar.”

### Hoe de set gekozen wordt

De set is een lijst zeldzame, formele of literaire lemma’s, geen frequentielijst van alledaags Nederlands. Het script houdt een lemma als het een duidelijke Nederlandse betekenis heeft en een voorbeeldzin waarin het woord (of een korte buiging) staat.

1. Alleen zelfstandig naamwoord, werkwoord, bijvoeglijk naamwoord en bijwoord. Eén token van 7 tot 20 letters. Geen hoofdletters, streepjes, woordgroepen, afkortingen of eigennamen.
2. Vormvarianten, dialect, alleen verouderde betekenissen en vaktaal (geneeskunde, plantkunde, scheikunde en vergelijkbare onderwerpen) vallen weg.
3. De eerste 6.000 lemma’s van de frequentielijst vallen weg. Die lijst dekt het alledaagse woord. De staart ervan is geen literaire zeldzaamheid (namen, leenwoorden, gewone woorden), dus een laag rangnummer is niet genoeg om een woord te houden.
4. Doorzichtige samenstellingen en productieve afleidingen van een frequent woord vallen weg, net als voltooide en tegenwoordige deelwoorden. Een betekenis die het lemma herhaalt, valt weg. Hetzelfde geldt voor een *-ig*-woord dat uit gewone delen bestaat, zoals *dikbuikig*. Een vaste lijst alledaagse lemma’s die de frequentielijst te laag zet of mist, valt ook weg.
5. Wat overblijft heeft een formeel of poëtisch label, een literaire vorm (zoals *-lijk*, *-ig*, *-temin*, *-aard*, *-nis*) of is een bijwoord van minstens acht letters. Een zelfstandig naamwoord of werkwoord zonder die vorm blijft als het zeldzaam maar echt is: een duidelijke Nederlandse betekenis, geen scheidbaar werkwoord, geen leenwoordspelling, en bij een zelfstandig naamwoord een Nederlandse uitgang. Gewone werkwoorden vallen weg: klanknabootsing, een gewone lichamelijke handeling en een leenwerkwoord op *-eren* of *-en*. Een formeel of literair werkwoord zoals *wrochten*, *verschalken*, *verbeuzelen*, *vermeien*, *verguizen* en *kuieren* blijft. Spelfouten en alternatieve spellingen vallen weg, ook als het extract ze alleen als vorm van een ander lemma markeert. *desalniettemin*, *kwistig*, *onverkwikkelijk* en *tabbaard* horen daarbij.
6. Per lemma blijft één woordsoort: formeel eerst, dan bijwoord, bijvoeglijk naamwoord, zelfstandig naamwoord, werkwoord. De set stopt bij 1.200; deze invoer levert 400 woorden.

Het lidwoord komt uit de labels in het extract: alleen onzijdig wordt *het*, mannelijk en/of vrouwelijk wordt *de*, allebei wordt *de/het*. Een leidende dubbele punt en indices als `[1]` gaan uit de betekenis. Buigingsglossen vallen weg. De tekst van een betekenis of voorbeeld wordt verder niet herschreven. Een voorbeeldzin langer dan 240 tekens wordt ingekort op een zinseinde, zolang het woord er nog in staat.

### De tien startwoorden

“Voeg 10 woorden toe” kiest tien id’s uit `meta.starterIds`. Het script zoekt die bij het bouwen: drie bijwoorden, drie bijvoeglijke naamwoorden, twee zelfstandige naamwoorden en twee werkwoorden, formeel en langer eerst. De voorbeeldzin telt hoogstens 150 tekens en bevat het lemma als heel woord. Glossen met *titel*, *uitroep* of *benaming* vallen alleen voor deze tien af.

### Woord van de dag

Het woord van de dag komt uit de hele set. De lemma’s worden op `id` gesorteerd. De index is FNV-1a van de lokale datum `YYYY-MM-DD`, modulo het aantal woorden. Dezelfde datum geeft op elk toestel hetzelfde woord. De daggrens is middernacht op het toestel.

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

De woorden, betekenissen en voorbeelden komen uit WikiWoordenboek, het Nederlandstalige Wiktionary. Kaikki.org publiceert het extract; Wiktextract heeft de gegevens omgezet. De frequentielijst filtert alledaagse lemma’s weg en komt uit de lemmatized frequency lists. Beide bronnen vallen onder [Creative Commons Naamsvermelding-GelijkDelen 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.nl).

De site past de gegevens aan: alledaagse woorden, eigennamen, afkortingen, vaktaal en doorzichtige samenstellingen vallen weg, per lemma blijft één woordsoort, het lidwoord is afgeleid, en lange voorbeeldzinnen zijn ingekort zoals hierboven. De tekst zelf is niet herschreven. Dezelfde toelichting staat op Bronnen.

De code van deze site is vrij te gebruiken. De woordgegevens blijven CC BY-SA 4.0.
