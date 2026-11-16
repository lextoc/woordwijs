import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowRightIcon, BackIcon, CloseIcon } from "../components/Icons";
import { Dialog, readState, Sheet, SidePanel, StorageBanner, usePageTitle, useWidePanel } from "../components/ui";
import { cardStatus } from "../lib/model";
import { wordById, type Word } from "../lib/words";
import { useDeck } from "../state/DeckContext";

export function WordDetail({ mode }: { mode: "page" | "overlay" }) {
  const { id = "" } = useParams();
  const word = wordById.get(decodeURIComponent(id));
  usePageTitle(word ? word.word : "Woord");
  const deck = useDeck();
  const navigate = useNavigate();
  const location = useLocation();
  const panel = useWidePanel();
  const confirm = readState(location.state)?.dialog === "remove";
  const background = readState(location.state)?.backgroundLocation;

  function closeOverlay() {
    navigate(-1);
  }

  function openConfirm() {
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { state: { ...(readState(location.state) ?? {}), dialog: "remove" } },
    );
  }

  function closeConfirm() {
    if (readState(window.history.state?.usr)?.dialog) navigate(-1);
  }

  if (!word) {
    const missing = (
      <div className="empty-state">
        <h1 id="missing-title">Dit woord vinden we niet</h1>
        <p>Dit woord staat niet in het woordenboek van deze site.</p>
        <Link className="primary" to="/zoeken">
          Zoek een woord
        </Link>
      </div>
    );
    if (mode === "overlay" && panel) {
      return (
        <SidePanel onClose={closeOverlay} header={<CloseRow onClose={closeOverlay} />} footer={null}>
          {missing}
        </SidePanel>
      );
    }
    if (mode === "overlay") {
      return (
        <Sheet labelledBy="missing-title" onClose={closeOverlay} header={<CloseRow onClose={closeOverlay} />} footer={null}>
          {missing}
        </Sheet>
      );
    }
    return (
      <div className="page">
        <StorageBanner />
        {missing}
      </div>
    );
  }

  const card = deck.store.cards[word.id];
  const headingId = `woord-${word.id}`;

  function add() {
    deck.addWord(word!.id);
  }

  function remove() {
    const saved = deck.removeWord(word!.id);
    if (!saved) return;
    deck.showToast(`${word!.word} is verwijderd.`);
    const idx = (window.history.state?.idx as number | undefined) ?? 0;
    if (background && idx >= 2) navigate(-2);
    else navigate("/woorden", { replace: true });
  }

  const action = card ? (
    <button type="button" className="secondary" onClick={openConfirm}>
      Verwijder uit mijn woorden
    </button>
  ) : (
    <button type="button" className="primary split" onClick={add}>
      <span>Voeg toe aan mijn woorden</span>
      <ArrowRightIcon />
    </button>
  );

  const dialog = confirm ? (
    <Dialog title="Woord verwijderen?" onClose={closeConfirm}>
      <p>
        {word.word} verdwijnt uit je woorden en je voortgang voor dit woord wordt gewist. Je kunt het woord later opnieuw toevoegen, maar dan begin je
        opnieuw. Dit kan niet ongedaan worden gemaakt.
      </p>
      <div className="modal-actions">
        <button type="button" className="danger-button" onClick={remove}>
          Verwijder woord
        </button>
        <button type="button" className="secondary" data-initial-focus onClick={closeConfirm}>
          Annuleren
        </button>
      </div>
    </Dialog>
  ) : null;

  const header = (
    <>
      <HeadMeta word={word} />
      <button type="button" className="icon-button" aria-label="Woordblad sluiten" onClick={closeOverlay}>
        <CloseIcon />
      </button>
    </>
  );

  if (mode === "overlay" && panel) {
    return (
      <>
        <SidePanel onClose={closeOverlay} header={header} footer={action}>
          <WordBody word={word} headingId={headingId} heading="h2" />
        </SidePanel>
        {dialog}
      </>
    );
  }

  if (mode === "overlay") {
    return (
      <>
        <Sheet labelledBy={headingId} onClose={closeOverlay} header={header} footer={action}>
          <WordBody word={word} headingId={headingId} heading="h2" />
        </Sheet>
        {dialog}
      </>
    );
  }

  function goBack() {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate("/woorden");
  }

  return (
    <div className="page word-page">
      <StorageBanner />
      <button type="button" className="text-button back" onClick={goBack}>
        <BackIcon size={18} /> Terug
      </button>
      <HeadMeta word={word} />
      <WordBody word={word} headingId={headingId} heading="h1" />
      <div className="word-actions">{action}</div>
      {dialog}
    </div>
  );
}

function CloseRow({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="icon-button" aria-label="Woordblad sluiten" onClick={onClose}>
      <CloseIcon />
    </button>
  );
}

function HeadMeta({ word }: { word: Word }) {
  return (
    <div className="word-kicker">
      {word.article ? <span className="article-chip">{word.article}</span> : null}
      <p className="eyebrow">{word.posLabel}</p>
    </div>
  );
}

function WordBody({ word, headingId, heading }: { word: Word; headingId: string; heading: "h1" | "h2" }) {
  const deck = useDeck();
  const card = deck.store.cards[word.id];
  const status = card ? cardStatus(card) : null;
  const goods = card?.consecutiveGood ?? 0;
  const Title = heading;
  return (
    <div className="word-body">
      <Title id={headingId} tabIndex={-1} className={word.word.length >= 12 ? "detail-word is-long" : "detail-word"}>
        {word.word}
      </Title>
      {word.labels?.length ? <p className="word-labels">{word.labels.join(" · ")}</p> : null}
      <p className="eyebrow">Betekenis</p>
      {word.senses.length > 1 ? (
        <ol className="senses">
          {word.senses.map((sense) => (
            <li key={sense}>{sense}</li>
          ))}
        </ol>
      ) : (
        <p className="sense">{word.senses[0]}</p>
      )}
      <p className="eyebrow">Voorbeeld</p>
      {word.example ? <blockquote className="quote">{word.example}</blockquote> : <p className="lede">Voor dit woord is geen voorbeeldzin beschikbaar.</p>}
      {status ? (
        <div className="status-row">
          <p>
            <i className={`status-dot status-${status}`} />
            {status === "nieuw" ? "Nieuw" : status === "bezig" ? "Bezig" : "Geleerd"}
          </p>
          {status === "nieuw" ? null : <p>{status === "geleerd" ? "Drie keer goed" : `${Math.min(goods, 3)} van 3 keer goed`}</p>}
        </div>
      ) : null}
      <p className="source-line">
        {"Bron: "}
        <a href={`https://nl.wiktionary.org/wiki/${encodeURIComponent(word.word)}`} target="_blank" rel="noopener noreferrer">
          WikiWoordenboek
          <span className="sr-only"> (opent in een nieuw tabblad)</span>
        </a>
        {", "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.nl" target="_blank" rel="noopener noreferrer">
          CC BY-SA 4.0
          <span className="sr-only"> (opent in een nieuw tabblad)</span>
        </a>
      </p>
    </div>
  );
}
