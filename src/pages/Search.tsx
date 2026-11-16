import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckIcon, CloseIcon, PlusIcon, SearchIcon } from "../components/Icons";
import { StorageBanner, useBrowserPath, usePageTitle, useRowArrows, useSearchKeys, WordLink } from "../components/ui";
import { searchWords, words, type Word } from "../lib/words";
import { useDeck } from "../state/DeckContext";

const dictionary = [...words].sort((a, b) => a.word.localeCompare(b.word, "nl"));

export function SearchPage() {
  usePageTitle("Woord toevoegen");
  const deck = useDeck();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [debounced, setDebounced] = useState(query);
  const pending = query !== debounced;
  const visible = Math.max(20, Math.min(dictionary.length, Math.floor(Number(params.get("toon"))) || 20));
  const [status, setStatus] = useState("");
  const [stuck, setStuck] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  function setQuery(value: string) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set("q", value); else next.delete("q");
      next.delete("toon");
      return next;
    }, { replace: true, preventScrollReset: true });
  }
  function clearQuery() { setQuery(""); inputRef.current?.focus(); }
  useSearchKeys(inputRef, clearQuery);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 150);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { threshold: 1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const results = debounced.trim() ? searchWords(debounced) : dictionary;
  const shown = results.slice(0, visible);
  useRowArrows(pending ? [] : shown.map(word => word.id));
  const browserPath = useBrowserPath();
  const openId = browserPath.startsWith("/woord/") ? decodeURIComponent(browserPath.slice("/woord/".length)) : "";
  function showMore(keyboard: boolean) {
    const firstNew = results[visible]?.id;
    setParams(previous => {
      const next = new URLSearchParams(previous); next.set("toon", String(visible + 20)); return next;
    }, { replace: true, preventScrollReset: true });
    requestAnimationFrame(() => {
      if (!firstNew) return;
      const row = document.querySelector<HTMLAnchorElement>(`[data-word-id="${CSS.escape(firstNew)}"]`);
      if (keyboard) row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "nearest" });
    });
  }
  function add(word: Word) {
    if (deck.addWord(word.id)) setStatus(`${word.word} is toegevoegd.`);
  }
  return (
    <div className="page search-page">
      <StorageBanner />
      <h1 className="page-title">Woord toevoegen</h1>
      <p className="page-intro">Zoek een woord of blader door de {dictionary.length} woorden in deze verzameling.</p>
      <div ref={sentinelRef} className="sticky-sentinel" />
      <div className={stuck ? "search-sticky is-stuck" : "search-sticky"}>
        <label className="field-label" htmlFor="zoeken">Zoek een woord</label>
        <div className="search-field">
          <SearchIcon size={20} />
          <input ref={inputRef} id="zoeken" type="search" value={query}
            onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") setDebounced(query); }}
            placeholder="Bijvoorbeeld: kwistig" aria-keyshortcuts="/" aria-controls="dictionary-results" lang="nl" autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="search" />
          {query ? <button type="button" className="icon-button" aria-label="Zoekopdracht wissen" onClick={clearQuery}><CloseIcon /></button> : null}
        </div>
      </div>
      <p className="count-line" role="status" aria-live="polite">
        {pending ? "Zoeken…" : query.trim() ? `${results.length} ${results.length === 1 ? "woord gevonden" : "woorden gevonden"}` : `Alle ${results.length} woorden · alfabetisch`}
      </p>
      {query.trim() && !pending && results.length === 0 ? (
        <div className="empty-state">
          <h2>Geen woord gevonden voor ‘{query.trim()}’</h2>
          <p>Probeer een deel van het woord. Deze verzameling bevat niet alle Nederlandse woorden.</p>
          <button type="button" className="text-button" onClick={clearQuery}>Bekijk alle woorden</button>
        </div>
      ) : null}
      <ul id="dictionary-results" className={`result-list${pending ? " is-updating" : ""}`} aria-busy={pending} inert={pending || undefined}>
        {shown.map(word => {
          const added = deck.inDeck(word.id);
          return (
            <li key={word.id}>
              <WordLink id={word.id} current={openId === word.id} className={openId === word.id ? "is-selected" : undefined}>
                <strong>{word.word}</strong>
                <span>{word.article ? `${word.article} · ` : ""}{word.posLabel}{word.senses[0] ? ` · ${word.senses[0]}` : ""}</span>
              </WordLink>
              <button type="button" className={added ? "icon-button added-mark" : "icon-button add-outline"}
                aria-label={added ? `${word.word} staat in je woorden` : `Voeg ${word.word} toe aan mijn woorden`}
                aria-disabled={added || undefined} onClick={() => { if (!added) add(word); }}>
                {added ? <CheckIcon /> : <PlusIcon />}
              </button>
            </li>
          );
        })}
      </ul>
      {visible < results.length ? (
        <button type="button" className="secondary load-more" disabled={pending} aria-controls="dictionary-results" onClick={event => showMore(event.detail === 0)}>Toon nog {Math.min(20, results.length - visible)} woorden <span className="more-count">{Math.min(visible, results.length)} van {results.length}</span></button>
      ) : null}
      <p className="sr-only" role="status">{status}</p>
    </div>
  );
}
