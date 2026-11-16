import { Attribution, SourceLink, StorageBanner, usePageTitle } from "../components/ui";
import { useEffect, useState } from "react";
import { catalogStats, type CatalogStats } from "../lib/catalog";

export function Bronnen() {
  usePageTitle("Bronnen");
  const [stats, setStats] = useState<CatalogStats | null>(null);
  useEffect(() => { const controller = new AbortController(); catalogStats(controller.signal).then(setStats).catch(() => {}); return () => controller.abort(); }, []);
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
          Het Nederlandse woordenboek wordt op onze server geïndexeerd. {stats ? `${stats.entries.toLocaleString("nl")} woorden en woordsoorten zijn doorzoekbaar; ${stats.recommended.toLocaleString("nl")} worden voorgesteld.` : "De actuele aantallen staan bij het zoeken."} Woorden die alleen een buigingsvorm zijn of geen betekenis hebben worden overgeslagen. Woordsoorten blijven afzonderlijke ingangen. Betekenissen en voorbeelden worden opgeschoond; per ingang blijven maximaal twintig betekenissen bewaard. Historische en regionale betekenissen krijgen waar beschikbaar een label.
          De voorstellen combineren een minder hoge positie in een openbare frequentielijst met labels zoals formeel, literair en zeldzaam. Dit is een automatische selectie, geen garantie dat ieder woord moeilijk is. De oorspronkelijke 140 beoordeelde woorden blijven behouden voor de startset en het woord van de dag. Ontbreekt een voorbeeldzin, dan wordt geen invuloefening gemaakt. Je browser vraagt alleen zoekresultaten en je opgeslagen woorden op bij onze server, niet bij WikiWoordenboek.
        </p>
      </details>
      <SourceLink href="https://github.com/bnpd/freqListsLemmatized" title="Frequentielijst" sub="CC BY-SA 4.0 · gebruikt voor woordvoorstellen" />
      <Attribution />
    </div>
  );
}
