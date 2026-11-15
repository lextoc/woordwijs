import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRightIcon, BackIcon } from "../components/Icons";
import { Attribution, Dialog, StorageBanner, usePageTitle } from "../components/ui";
import { cardStatus } from "../lib/model";
import { wordById } from "../lib/words";
import { useDeck } from "../state/DeckContext";

export function WordDetail() {
  const { id = "" } = useParams();
  const word = wordById.get(decodeURIComponent(id));
  usePageTitle(word ? word.word : "Woord");
  const deck = useDeck();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  if (!word) {
    return (
      <div className="page">
        <StorageBanner />
        <div className="empty-state">
          <h1>Dit woord staat niet meer in het woordenboek.</h1>
          <Link className="primary split" to="/woorden">
            <span>Naar mijn woorden</span>
          </Link>
        </div>
      </div>
    );
  }
  const card = deck.store.cards[word.id];
  const status = card ? cardStatus(card) : null;
  const goods = card?.consecutiveGood ?? 0;

  function goBack() {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate("/woorden");
  }

  function add() {
    const saved = deck.addWord(word!.id);
    if (saved) deck.showToast(`${word!.word} staat nu in je woorden.`);
  }

  function remove() {
    const saved = deck.removeWord(word!.id);
    if (!saved) return;
    deck.showToast(`${word!.word} is verwijderd.`);
    setConfirm(false);
    goBack();
  }

  return (
    <div className="page">
      <StorageBanner />
      <button type="button" className="text-button back" onClick={goBack}>
        <BackIcon size={18} /> Terug
      </button>
      <p className="eyebrow">{word.posLabel}</p>
      {word.article ? <p className="article-chip">{word.article}</p> : null}
      <h1 className={word.word.length >= 14 ? "detail-word is-long" : "detail-word"}>{word.word}</h1>
      <p className="eyebrow">Betekenis</p>
      {word.senses.length > 1 ? (
        <ol className="senses">
          {word.senses.map((sense) => (
            <li key={sense}>{sense}</li>
          ))}
        </ol>
      ) : (
        <p className="reading">{word.senses[0]}</p>
      )}
      <p className="eyebrow">Voorbeeld</p>
      {word.example ? <blockquote className="quote">{word.example}</blockquote> : <p>Voor dit woord is geen voorbeeldzin beschikbaar.</p>}
      {status ? (
        <div className="status-row">
          <p>
            <i className={`status-dot status-${status}`} />
            {status === "nieuw" ? "Nieuw" : status === "bezig" ? "Bezig" : "Geleerd"}
          </p>
          {status === "nieuw" ? null : <p>{status === "geleerd" ? "Drie keer goed" : `${Math.min(goods, 3)} van 3 keer goed`}</p>}
        </div>
      ) : null}
      {status ? (
        <button type="button" className="secondary" onClick={() => setConfirm(true)}>
          Verwijder uit mijn woorden
        </button>
      ) : (
        <button type="button" className="primary split" onClick={add}>
          <span>Voeg toe aan mijn woorden</span>
          <ArrowRightIcon />
        </button>
      )}
      <p className="source-line">
        Bron:{" "}
        <a href={`https://nl.wiktionary.org/wiki/${encodeURIComponent(word.word)}`} target="_blank" rel="noopener noreferrer">
          WikiWoordenboek
          <span className="sr-only"> (opent in een nieuw tabblad)</span>
        </a>
        ,{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.nl" target="_blank" rel="noopener noreferrer">
          CC BY-SA 4.0
          <span className="sr-only"> (opent in een nieuw tabblad)</span>
        </a>
      </p>
      <Attribution />
      {confirm ? (
        <Dialog title="Woord verwijderen?" onClose={() => setConfirm(false)}>
          <p>
            {word.word} verdwijnt uit je woorden en je voortgang voor dit woord wordt gewist. Je kunt het woord later opnieuw toevoegen, maar dan
            begin je opnieuw. Dit kan niet ongedaan worden gemaakt.
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setConfirm(false)}>
              Annuleren
            </button>
            <button type="button" className="danger-button" onClick={remove}>
              Verwijder woord
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
