import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckIcon, CloseIcon, PlusIcon, SearchIcon } from "../components/Icons";
import { StorageBanner, useBrowserPath, usePageTitle, useRowArrows, useSearchKeys, WordLink } from "../components/ui";
import { searchWords, type Word } from "../lib/words";
import { useDeck } from "../state/DeckContext";

export function SearchPage() {
  usePageTitle("Woord toevoegen");
  const deck = useDeck();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState("");
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(20);
  const [status, setStatus] = useState("");
  const [stuck, setStuck] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useSearchKeys(inputRef, () => setQuery(""));

  useEffect(() => {
    setPending(true);
    const timer = window.setTimeout(() => {
      setDebounced(query);
      setPending(false);
      setVisible(20);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { threshold: 1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const results = searchWords(debounced);
  const shown = results.slice(0, visible);
  useRowArrows(shown.map((word) => word.id));
  const browserPath = useBrowserPath();
  const openId = browserPath.startsWith("/woord/") ? decodeURIComponent(browserPath.slice("/woord/".length)) : "";

  function add(word: Word) {
    const saved = deck.addWord(word.id);
    if (saved) setStatus(`${word.word} is toegevoegd.`);
  }

  return (
    <div className="page search-page">
      <StorageBanner />
      <h1 className="page-title">Woord toevoegen</h1>
      <div ref={sentinelRef} className="sticky-sentinel" />
      <div className={stuck ? "search-sticky is-stuck" : "search-sticky"}>
        <label className="field-label" htmlFor="zoeken">
          Zoek een woord
        </label>
        <div className="search-field">
          <SearchIcon size={20} />
          <input
            ref={inputRef}
            id="zoeken"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            lang="nl"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          {query ? (
            <button type="button" className="icon-button" aria-label="Zoekopdracht wissen" onClick={() => setQuery("")}>
              <CloseIcon />
            </button>
          ) : null}
        </div>
        {query.trim().length === 1 ? <p className="hint-line">Typ minstens 2 letters.</p> : null}
      </div>
      {query.trim().length >= 2 ? (
        <p className="count-line" role="status">
          {pending ? "Zoeken…" : results.length === 1 ? "1 woord gevonden" : `${results.length} woorden gevonden`}
        </p>
      ) : null}
      {query.trim().length === 0 ? <p className="lede">Zoek in het woordenboek van deze site. Typ het begin of een deel van een woord.</p> : null}
      {query.trim().length >= 2 && !pending && results.length === 0 ? (
        <div className="empty-state">
          <p className="eyebrow">Geen resultaten</p>
          <h2>Geen woord gevonden voor ‘{query.trim()}’</h2>
          <p>Controleer de spelling of zoek op het begin van het woord. Je kunt alleen woorden toevoegen die in het woordenboek van deze site staan.</p>
          <button type="button" className="text-button" onClick={() => setQuery("")}>
            Wis zoekopdracht
          </button>
        </div>
      ) : null}
      <ul className="result-list">
        {shown.map((word) => {
          const added = deck.inDeck(word.id);
          return (
            <li key={word.id}>
              <WordLink id={word.id} current={openId === word.id} className={openId === word.id ? "is-selected" : undefined}>
                <strong>{word.word}</strong>
                <span>
                  {word.article ? `${word.article} · ` : ""}
                  {word.posLabel}
                  {word.senses[0] ? ` · ${word.senses[0]}` : ""}
                </span>
              </WordLink>
              <button
                type="button"
                className={added ? "icon-button added-mark" : "icon-button add-outline"}
                aria-label={added ? `${word.word} staat in je woorden` : `Voeg ${word.word} toe aan mijn woorden`}
                aria-disabled={added || undefined}
                onClick={() => {
                  if (!added) add(word);
                }}
              >
                {added ? <CheckIcon /> : <PlusIcon />}
              </button>
            </li>
          );
        })}
      </ul>
      {visible < results.length ? (
        <button type="button" className="text-button" onClick={() => setVisible((value) => value + 20)}>
          Toon meer
        </button>
      ) : null}
      <p className="sr-only" role="status">
        {status}
      </p>
    </div>
  );
}
