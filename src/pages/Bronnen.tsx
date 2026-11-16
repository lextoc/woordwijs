import { SourceLink, StorageBanner, usePageTitle } from "../components/ui";
import { meta } from "../lib/words";

export function Bronnen() {
  usePageTitle("Bronnen");
  const entries = meta.counts.entries;
  const withExample = meta.counts.withExample;
  return (
    <div className="page">
      <StorageBanner />
      <p className="eyebrow">Bronnen</p>
      <h1 className="page-title">Waar de woorden vandaan komen</h1>
      <p>
        De woorden, betekenissen en voorbeeldzinnen komen uit <strong>WikiWoordenboek</strong>, het Nederlandstalige Wiktionary. De gegevens zijn
        omgezet met Wiktextract en beschikbaar gemaakt door Kaikki.org.
      </p>
      <p>De gegevens vallen onder de licentie Creative Commons Naamsvermelding-GelijkDelen 4.0 (CC BY-SA 4.0).</p>
      <p>Deze site plaatst geen cookies en meet geen bezoek. Je voortgang blijft in deze browser.</p>
      <div className="source-list">
        <SourceLink href="https://nl.wiktionary.org/" title="WikiWoordenboek" sub="nl.wiktionary.org" />
        <SourceLink href="https://kaikki.org/nlwiktionary/" title="Kaikki.org" sub="Gegevens uit Wiktionary" />
        <SourceLink href="https://github.com/tatuylonen/wiktextract" title="Wiktextract" sub="github.com/tatuylonen/wiktextract" />
        <SourceLink href="https://creativecommons.org/licenses/by-sa/4.0/deed.nl" title="Licentie CC BY-SA 4.0" sub="creativecommons.org" />
      </div>
      <h2>Aanpassingen</h2>
      <p>
        Voor deze site zijn {entries} Nederlandse lemma’s gekozen uit het nlwiktionary-extract van Kaikki.org. Het zijn ongebruikelijke woorden:
        formeel, literair of zeldzaam, met een duidelijke Nederlandse betekenis. Alledaagse woorden uit het begin van een openbare frequentielijst,
        ook onder CC BY-SA 4.0, zijn weggelaten. Hetzelfde geldt voor eigennamen, afkortingen, woordgroepen, buigingsvormen, dialect, alleen
        verouderde betekenissen en vaktaal. Doorzichtige samenstellingen van gewone woorden zijn ook weggelaten, net als een betekenis die het lemma herhaalt en een -ig-woord dat uit gewone delen bestaat. Een zeldzaam zelfstandig naamwoord of werkwoord blijft behouden als het een duidelijke Nederlandse betekenis heeft, ook zonder literaire uitgang. Per lemma blijft één woordsoort.
        Het lidwoord is afgeleid uit de labels in het extract. Per woord staan hoogstens zes betekenissen. Een leidende dubbele punt en verwijzingen
        als [1] zijn verwijderd. Een voorbeeldzin die langer is dan 240 tekens is ingekort op een zinseinde, als het woord er nog in staat.{" "}
        {withExample} van de {entries} woorden hebben een voorbeeldzin. De tekst van een betekenis of voorbeeld is verder niet herschreven.
      </p>
    </div>
  );
}
