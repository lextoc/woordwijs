# Woordwijs

Leer Nederlandse woorden die je nog niet kent. De React-client gebruikt een kleine, alleen-lezen Python/SQLite-woordenboek-API. Er zijn geen accounts. Je voortgang blijft in deze browser.

## Starten

```bash
npm ci
npm run dev
```

`npm run build` maakt de site in `dist/`. `npm run preview` toont die build. De client haalt zoekresultaten en opgeslagen woorden op via onze eigen `/api/`. Alleen de oorspronkelijke 140 startwoorden zitten in de bundel. Er zijn geen verzoeken naar WikiWoordenboek tijdens het zoeken. Inter (OFL) wordt meegeleverd. Georgia komt van het toestel, met Times New Roman als reserve.

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

## Serverwoordenboek

Python 3.11+ en SQLite met FTS5/trigram zijn vereist. Download het gecomprimeerde extract naar een datamap buiten Git en voer uit:

```bash
python3 backend/import_dictionary.py --source /var/lib/woordwijs/imports/nlwiktionary.jsonl.gz --output /var/lib/woordwijs/databases/dictionary.sqlite
WOORDWIJS_DB=/var/lib/woordwijs/databases/dictionary.sqlite python3 backend/server.py
```

De import streamt de gzip, selecteert Nederlandse ingangen met echte definities en publiceert de database atomair na een integriteitscontrole. De frequentielijst wordt eenmaal naast het extract gecachet. Metadata bevat aantallen, importdatum en bronhash. Bij herimport blijft de bestaande database beschikbaar totdat de vervanger klaar is. Voer imports niet gelijktijdig uit.

De API luistert uitsluitend op 127.0.0.1:8098. `deploy/nginx.conf` proxyt `/api/`; `deploy/woordwijs-api.service` bevat de productie-unit. Vite proxyt lokaal dezelfde routes. GET `/api/words` geeft maximaal twintig resultaten, POST `/api/words/by-id` maximaal honderd opgeslagen woorden. De server bewaart geen persoonlijke voortgang en logt geen zoekopdrachten. Die blijft in localStorage; een tijdelijke API-fout wist niets. Een woord zonder voorbeeld krijgt geen invuloefening.

Volledige woordenboekbestanden en downloads horen buiten de repository en buiten de publieke webroot. Alleen frontend-builds gaan naar `/var/www/woordwijs-static/releases/`; backend-releases staan in `/var/lib/woordwijs/releases/`. De `current`-symlinks wijzen naar de actieve release. Herstart de API na een backend-update.

## Oorspronkelijke startset opnieuw maken

Onderstaande procedure betreft alleen de behouden 140 beoordeelde startwoorden, niet het volledige serverwoordenboek.


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
| Kandidaten vóór één woordsoort per lemma | 229 |
| Lemma’s in de frequentielijst | 13.604 |
| Woorden in de set | 140 |
| Met een voorbeeldzin | 140 |
| Met een lidwoord | 18 |
| Zelfstandige naamwoorden | 31 |
| Werkwoorden | 53 |
| Bijvoeglijke naamwoorden | 40 |
| Bijwoorden | 16 |

Ontbreekt een lidwoord of een voorbeeldzin, dan verbergt de site dat veld. Op de woordpagina blijft de kop Voorbeeld staan, met de zin “Voor dit woord is geen voorbeeldzin beschikbaar.”

### Hoe de set gekozen wordt

De set is een lijst zeldzame, formele of literaire lemma’s, geen frequentielijst van alledaags Nederlands. Het script houdt een lemma als het een duidelijke Nederlandse betekenis heeft en een voorbeeldzin waarin het woord (of een korte buiging) staat.

1. Alleen zelfstandig naamwoord, werkwoord, bijvoeglijk naamwoord en bijwoord. Eén token van 7 tot 20 letters. Geen hoofdletters, streepjes, woordgroepen, afkortingen of eigennamen.
2. Vormvarianten, dialect, alleen verouderde betekenissen en vaktaal (geneeskunde, plantkunde, scheikunde en vergelijkbare onderwerpen) vallen weg.
3. De eerste 6.000 lemma’s van de frequentielijst vallen weg. Die lijst dekt het alledaagse woord. De staart ervan is geen literaire zeldzaamheid (namen, leenwoorden, gewone woorden), dus een laag rangnummer is niet genoeg om een woord te houden.
4. De automatische filters maken alleen een kandidatenlijst. Doorzichtige samenstellingen en productieve afleidingen vallen daar al uit, net als voltooide en tegenwoordige deelwoorden. Een betekenis die het lemma herhaalt, valt weg. Hetzelfde geldt voor een *-ig*-woord dat uit gewone delen bestaat, zoals *dikbuikig*. Een vaste lijst alledaagse lemma’s die de frequentielijst te laag zet of mist, valt ook weg. Een afleiding op *-erij*, *-arij*, *-nij*, *-erig*, *-ig*, *-heid*, *-schap*, *-shalve*, *-ing* of *-wijze* valt weg zodra het grondwoord bekend is: het staat in de frequentielijst, of het Leesonderzoek zet het boven de 80 procent. Dat geldt ook als de afleiding zelf een cijfer van 90 procent of minder heeft. Een betekenis met een kapot sjabloon (*van iets dat het…*), een cirkelredenering of een ander begrip dan het woord, valt weg. Een spellingvariant die alleen een koppel-s scheelt van een bekend lemma, valt ook weg. Wat hier overblijft is nog geen eindset.
5. Elk kandidaatwoord is met de hand beoordeeld en vastgelegd in `data/curated.json`, met keep of drop en een reden. `words.json` bevat alleen de woorden met keep. Een woord valt af als de betekenis uit een bekend grondwoord volgt of de glos dat grondwoord alleen napraat, als het alleen regionaal is, als de glos cirkelvormig, een sjabloonrest, ongrammaticaal of vaag is, als de glos niet bij de woordsoort past, als het alledaags is of als meer dan 90 procent het herkent, of als het alleen nog archaïsch is. Een grote kloof tussen Nederland en Vlaanderen, zoals bij *teljoor*, telt daarbij als waarschuwing. `data/denylist.json` zet elk woord vast dat QA heeft afgekeurd. `npm run data` faalt als zo’n woord in de set staat, of als een id uit `meta.starterIds` ontbreekt. De herkenningstabel blijft het vaste bestand `data/nl-recognition.json`; het script controleert de sha256 en haalt hem niet live op. *onverkwikkelijk* blijft, met ongeveer 78 procent. *tabbaard* ook.
6. Per lemma blijft één woordsoort: formeel eerst, dan bijwoord, bijvoeglijk naamwoord, zelfstandig naamwoord, werkwoord. De kandidatenlijst telt 228 woorden. De beoordeling houdt er 140 en laat er 88 vallen: 58 omdat de betekenis uit een bekend grondwoord volgt, 16 om de glos, 9 omdat het woord regionaal is, 4 omdat het alledaags is, en 1 omdat het alleen nog archaïsch is. De eindset telt 16 bijwoorden, 40 bijvoeglijke naamwoorden, 31 zelfstandige naamwoorden en 53 werkwoorden. Het Leesonderzoek haalt vóór die beoordeling 77 lemma’s uit de kandidaten, de afleidingsfilter 123, de glosfilter 8, en één spellingvariant valt daar weg.

Het lidwoord komt uit de labels in het extract: alleen onzijdig wordt *het*, mannelijk en/of vrouwelijk wordt *de*, allebei wordt *de/het*. Een leidende dubbele punt en indices als `[1]` gaan uit de betekenis. Buigingsglossen vallen weg. Bij een handvol bijvoeglijke naamwoorden is een bijwoordelijke glos teruggebracht tot een bijvoeglijke formulering. Verder wordt de tekst van een betekenis of voorbeeld niet herschreven. Een voorbeeldzin langer dan 240 tekens wordt ingekort op een zinseinde, zolang het woord er nog in staat.

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

## Productie

De site staat op https://woordwijs.alexanderclaes.com. De nginx-configuratie staat in `deploy/nginx.conf` en gebruikt een SPA-fallback voor diepe links. Publiceer uitsluitend `dist/` naar een nieuwe map onder `/var/www/woordwijs-static/releases/<git-revisie>` en vervang de `current`-symlink atomair. De broncode, brongegevens, caches en `node_modules` horen niet in de publieke webmap. HTTPS gebruikt het eigen automatisch vernieuwde Let's Encrypt-certificaat voor dit subdomein.

## Gebruiksgemak

Woord toevoegen toont ook zonder zoekterm een alfabetische lijst. Zoekopdrachten, het aantal getoonde resultaten en de filters/sortering van Mijn woorden staan in de URL, zodat terugkeren uit een woordpaneel dezelfde lijst herstelt. Mijn woorden toont aantallen per status en kan sorteren op toevoegdatum, alfabet of herhaling. De legenda in Voortgang verwijst naar die filters.

Een open oefening kan via ‘Later verdergaan’ opzij worden gezet en op Vandaag worden hervat. De oefening gebruikt de bestaande sessieopslag en verandert de herhaalregels niet. Hints worden pas na aanklikken getoond; ingedrukt gehouden sneltoetsen mogen geen antwoorden overslaan. Een mislukte schrijfactie naar sessieopslag blokkeert het oefenen niet.
