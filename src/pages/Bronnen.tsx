import { Attribution, SourceLink, StorageBanner, usePageTitle } from "../components/ui";
import { meta } from "../lib/words";

export function Bronnen() {
  usePageTitle("Bronnen");
  const entries = meta.counts.entries;
  const withExample = meta.counts.withExample;
  return (
    <div className="page bronnen-page">
      <StorageBanner />
      <p className="eyebrow">Bronnen</p>
      <h1 className="page-title">Waar de woorden vandaan komen</h1>
      <div className="prose">
        <p className="lede">
          De woorden, betekenissen en voorbeeldzinnen komen uit <strong>WikiWoordenboek</strong>, het Nederlandstalige Wiktionary. De gegevens zijn
          omgezet met Wiktextract en beschikbaar gemaakt door Kaikki.org.
        </p>
        <p className="lede">De gegevens vallen onder de licentie Creative Commons Naamsvermelding-GelijkDelen 4.0 (CC BY-SA 4.0).</p>
        <p className="lede">Deze site plaatst geen cookies en meet geen bezoek. Je voortgang blijft in deze browser.</p>
      </div>
      <div className="source-list">
        <SourceLink href="https://nl.wiktionary.org/" title="WikiWoordenboek" sub="nl.wiktionary.org" />
        <SourceLink href="https://kaikki.org/nlwiktionary/" title="Kaikki.org" sub="Gegevens uit Wiktionary" />
        <SourceLink href="https://github.com/tatuylonen/wiktextract" title="Wiktextract" sub="github.com/tatuylonen/wiktextract" />
        <SourceLink href="https://creativecommons.org/licenses/by-sa/4.0/deed.nl" title="Licentie CC BY-SA 4.0" sub="creativecommons.org" />
      </div>
      <details className="explain">
        <summary>Aanpassingen</summary>
        <p className="lede">
          Voor deze site zijn {entries} Nederlandse lemma’s gekozen uit het nlwiktionary-extract van Kaikki.org. Het script stelt eerst kandidaten voor:
          ongebruikelijke woorden, formeel, literair of zeldzaam, met een duidelijke Nederlandse betekenis. Alledaagse woorden uit het begin van een
          openbare frequentielijst, ook onder CC BY-SA 4.0, zijn weggelaten. Hetzelfde geldt voor eigennamen, afkortingen, woordgroepen, buigingsvormen,
          dialect, alleen verouderde betekenissen en vaktaal. Staat een lemma in het Leesonderzoek 2013 van het Centrum voor Leesonderzoek, dan komt het
          alleen in aanmerking als hoogstens 90 procent van de mensen het herkent. Die tabel is een vast bestand in deze bron en wordt niet live opgehaald.
          Elk kandidaatwoord is daarna met de hand beoordeeld. Een doorzichtige afleiding, een alleen regionaal woord, een kapotte of vage glos, een
          alledaags woord en een louter archaïsch woord vallen af. Per lemma blijft één woordsoort. Het lidwoord is afgeleid uit de labels in het extract.
          Per woord staan hoogstens zes betekenissen. Een leidende dubbele punt en verwijzingen als [1] zijn verwijderd. Een voorbeeldzin die langer is
          dan 240 tekens is ingekort op een zinseinde, als het woord er nog in staat. {withExample} van de {entries} woorden hebben een voorbeeldzin. Bij
          een handvol bijvoeglijke naamwoorden is een bijwoordelijke glos teruggebracht tot een bijvoeglijke formulering. Verder is de tekst van een
          betekenis of voorbeeld niet herschreven.
        </p>
      </details>
      <Attribution />
    </div>
  );
}
