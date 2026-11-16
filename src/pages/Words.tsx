import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRightIcon, ChevronIcon, CloseIcon, SearchIcon } from "../components/Icons";
import { StorageBanner, useBrowserPath, usePageTitle, useRowArrows, useSearchKeys, WordLink } from "../components/ui";
import { cardStatus, type Status } from "../lib/model";
import { fold } from "../lib/text";
import { wordById } from "../lib/words";
import { useDeck } from "../state/DeckContext";

const filters: { id: "alle" | Status; label: string }[] = [
  { id: "alle", label: "Alle" },
  { id: "nieuw", label: "Nieuw" },
  { id: "bezig", label: "Bezig" },
  { id: "geleerd", label: "Geleerd" },
];

export function MyWords() {
  usePageTitle("Mijn woorden");
  const { store } = useDeck();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [debounced, setDebounced] = useState(query);
  const status = filters.some(filter => filter.id === params.get("status")) ? params.get("status") as "alle" | Status : "alle";
  const sort = ["recent", "alpha", "due"].includes(params.get("sort") ?? "") ? params.get("sort")! : "recent";
  function setOption(key: string, value: string) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value && !(key === "status" && value === "alle") && !(key === "sort" && value === "recent")) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true, preventScrollReset: true });
  }
  const setQuery = (value: string) => setOption("q", value);
  const setStatus = (value: string) => setOption("status", value);
  const inputRef = useRef<HTMLInputElement>(null);
  useSearchKeys(inputRef, () => { setQuery(""); inputRef.current?.focus(); });

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
      .filter((row) => (!needle.length ? true : fold(row.word?.word ?? "").includes(needle)))
      .sort((a, b) => sort === "alpha" ? (a.word?.word ?? "").localeCompare(b.word?.word ?? "", "nl") : sort === "due" ? a.card.due.localeCompare(b.card.due) || a.card.id.localeCompare(b.card.id) : b.card.addedAt.localeCompare(a.card.addedAt) || a.card.id.localeCompare(b.card.id));
  }, [debounced, status, sort, store.cards]);

  useRowArrows(rows.map((row) => row.card.id));

  const total = Object.keys(store.cards).length;
  const counts = { alle: total, nieuw: 0, bezig: 0, geleerd: 0 };
  for (const card of Object.values(store.cards)) counts[cardStatus(card)]++;
  const filtering = debounced.trim().length > 0 || status !== "alle";
  const browserPath = useBrowserPath();
  const openId = browserPath.startsWith("/woord/") ? decodeURIComponent(browserPath.slice("/woord/".length)) : "";

  return (
    <div className="page words-page">
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
          <div className="button-stack">
            <Link className="primary split" to="/zoeken">
              <span>Woord toevoegen</span>
              <ArrowRightIcon />
            </Link>
            <StarterButton />
          </div>
        </div>
      ) : (
        <>
          <label className="field-label" htmlFor="mijn-zoeken">
            Zoek tussen je woorden
          </label>
          <div className="search-field">
            <SearchIcon size={20} />
            <input
              ref={inputRef}
              id="mijn-zoeken"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek op een woord"
              lang="nl"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button type="button" className="icon-button" aria-label="Zoekopdracht wissen" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>
                <CloseIcon />
              </button>
            ) : null}
          </div>
          <div className="view-switch" role="radiogroup" aria-label="Toon">
            {filters.map((filter, index) => (
              <button
                key={filter.id}
                type="button"
                role="radio"
                aria-checked={status === filter.id}
                tabIndex={status === filter.id ? 0 : -1}
                onClick={() => setStatus(filter.id)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                  event.preventDefault();
                  const next = event.key === "ArrowRight" ? (index + 1) % filters.length : (index - 1 + filters.length) % filters.length;
                  setStatus(filters[next].id);
                  event.currentTarget.parentElement?.querySelectorAll("button")[next]?.focus();
                }}
              >
                {filter.label} <span className="filter-count">{counts[filter.id]}</span>
              </button>
            ))}
          </div>
          <div className="list-tools">
            <p role="status">{rows.length} van {total} woorden</p>
            <label htmlFor="word-sort">Sorteer <select id="word-sort" value={sort} onChange={event => setOption("sort", event.target.value)}>
              <option value="recent">Laatst toegevoegd</option><option value="alpha">Alfabetisch</option><option value="due">Eerst te herhalen</option>
            </select></label>
          </div>
          {rows.length === 0 && filtering ? (
            <div className="empty-state">
              <h2>Geen woorden gevonden in je woorden.</h2>
              <p>Probeer een ander woord of kies een andere status.</p>
              <button type="button" className="secondary" onClick={() => { setParams({}, { replace: true, preventScrollReset: true }); setDebounced(""); inputRef.current?.focus(); }}>Toon al mijn woorden</button>
              <Link className="text-button" to={`/zoeken${debounced.trim() ? `?q=${encodeURIComponent(debounced.trim())}` : ""}`}>
                Zoek in het woordenboek
              </Link>
            </div>
          ) : (
            <ul className="deck-list">
              {rows.map((row) => (
                <li key={row.card.id}>
                  <WordLink id={row.card.id} current={openId === row.card.id} className={openId === row.card.id ? "is-selected" : undefined}>
                    <strong>{row.word?.word}</strong>
                    <span>
                      <i className={`status-dot status-${row.status}`} />
                      {row.word?.posLabel} · {label(row.status)}
                    </span>
                    <ChevronIcon size={20} />
                  </WordLink>
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
      <span>Begin met 10 woorden</span>
      <ArrowRightIcon />
    </button>
  );
}
