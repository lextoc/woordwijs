import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, ChevronIcon } from "../components/Icons";
import { StorageBanner, usePageTitle } from "../components/ui";
import { cardStatus, type Status } from "../lib/model";
import { fold } from "../lib/text";
import { wordById } from "../lib/words";
import { useDeck } from "../state/DeckContext";

export function MyWords() {
  usePageTitle("Mijn woorden");
  const { store } = useDeck();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<"alle" | Status>("alle");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 150);
    return () => window.clearTimeout(timer);
  }, [query]);

  const rows = useMemo(() => {
    const needle = fold(debounced);
    return Object.values(store.cards)
      .map((card) => ({ card, word: wordById.get(card.id), status: cardStatus(card) }))
      .filter((row) => row.word)
      .filter((row) => (status === "alle" ? true : row.status === status))
      .filter((row) => (needle.length < 2 ? true : fold(row.word?.word ?? "").includes(needle)))
      .sort((a, b) => b.card.addedAt.localeCompare(a.card.addedAt) || a.card.id.localeCompare(b.card.id));
  }, [debounced, status, store.cards]);

  const total = Object.keys(store.cards).length;
  const filtering = debounced.trim().length >= 2 || status !== "alle";

  return (
    <div className="page">
      <StorageBanner />
      <div className="title-row">
        <h1 className="page-title">Mijn woorden</h1>
        <span className="count-badge" aria-label={`${total} woorden`}>
          {total}
        </span>
      </div>
      {total === 0 ? (
        <div className="empty-state">
          <p className="eyebrow">Nog geen woorden</p>
          <h2>Hier staan nog geen woorden</h2>
          <p>Voeg je eerste woord toe.</p>
          <Link className="primary split" to="/zoeken">
            <span>Woord toevoegen</span>
            <ArrowRightIcon />
          </Link>
          <StarterButton />
        </div>
      ) : (
        <>
          <label className="field-label" htmlFor="mijn-zoeken">
            Zoek tussen je woorden
          </label>
          <div className="search-field">
            <input
              id="mijn-zoeken"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              lang="nl"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <label className="field-label" htmlFor="toon">
            Toon
          </label>
          <div className="sort-field">
            <select id="toon" value={status} onChange={(event) => setStatus(event.target.value as "alle" | Status)}>
              <option value="alle">Alle woorden</option>
              <option value="nieuw">Nieuw</option>
              <option value="bezig">Bezig</option>
              <option value="geleerd">Geleerd</option>
            </select>
          </div>
          {rows.length === 0 && filtering ? (
            <div className="empty-state">
              <h2>Geen woorden gevonden in je woorden.</h2>
              <p>Probeer een ander woord of kies een andere status.</p>
              <Link className="text-button" to={`/zoeken${debounced.trim() ? `?q=${encodeURIComponent(debounced.trim())}` : ""}`}>
                Zoek in het woordenboek
              </Link>
            </div>
          ) : (
            <ul className="deck-list">
              {rows.map((row) => (
                <li key={row.card.id}>
                  <Link to={`/woord/${encodeURIComponent(row.card.id)}`}>
                    <strong>{row.word?.word}</strong>
                    <span>
                      <i className={`status-dot status-${row.status}`} />
                      {row.word?.posLabel} · {label(row.status)}
                    </span>
                    <ChevronIcon />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function label(status: Status): string {
  if (status === "nieuw") return "Nieuw";
  if (status === "bezig") return "Bezig";
  return "Geleerd";
}

function StarterButton() {
  const deck = useDeck();
  return (
    <button
      type="button"
      className="secondary split"
      onClick={() => {
        const saved = deck.addStarter();
        if (saved) deck.showToast("10 woorden toegevoegd.");
      }}
    >
      <span>Voeg 10 woorden toe</span>
      <ArrowRightIcon />
    </button>
  );
}
