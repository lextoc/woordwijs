import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckIcon, CloseIcon, PlusIcon, SearchIcon } from "../components/Icons";
import { StorageBanner, useBrowserPath, usePageTitle, useRowArrows, useSearchKeys, WordLink } from "../components/ui";
import { searchCatalog, type CatalogPage } from "../lib/catalog";
import type { Word } from "../lib/words";
import { useDeck } from "../state/DeckContext";

export function SearchPage() {
  usePageTitle("Woord toevoegen");
  const deck = useDeck();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [debounced, setDebounced] = useState(query);
  const page = Math.max(0, Math.min(50000, Math.floor(Number(params.get("pagina"))) || 0));
  const scope = query.trim() || params.get("selectie") === "alle" ? "all" : "recommended";
  const key = JSON.stringify([debounced, scope, page]);
  const [data, setData] = useState<{ key: string; page: CatalogPage | null }>({ key: "", page: null });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState("");
  const [stuck, setStuck] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  function changeParams(name: string, value: string) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set(name, value); else next.delete(name);
      if (name !== "pagina") next.delete("pagina");
      next.delete("toon");
      return next;
    }, { replace: true, preventScrollReset: true });
  }
  function clearQuery() { changeParams("q", ""); inputRef.current?.focus(); }
  useSearchKeys(inputRef, clearQuery);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 150);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);setError("");
    searchCatalog(debounced, scope, page * 20, controller.signal).then(result => {
      if (!controller.signal.aborted) { setData({ key, page: result }); setLoading(false); }
    }).catch(() => {
      if (!controller.signal.aborted) { setError("Het woordenboek is even niet bereikbaar. Je woorden en voortgang blijven bewaard."); setLoading(false); }
    });
    return () => controller.abort();
  }, [key, retry]);
  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { threshold: 1 });
    observer.observe(element);return () => observer.disconnect();
  }, []);
  const result = data.key === key ? data.page : null;
  const pending = query !== debounced || loading || data.key !== key && !error;
  const shown = result?.words ?? [];
  useRowArrows(pending ? [] : shown.map(word => word.id));
  const browserPath = useBrowserPath();
  const openId = browserPath.startsWith("/woord/") ? decodeURIComponent(browserPath.slice(7)) : "";
  function add(word: Word) { if (deck.addWord(word.id)) setStatus(`${word.word} is toegevoegd.`); }
  function turnPage(next: number) {
    changeParams("pagina", next ? String(next) : "");
    inputRef.current?.scrollIntoView({ block: "start" });
  }
  return <div className="page search-page">
    <StorageBanner />
    <h1 className="page-title">Woord toevoegen</h1>
    <p className="page-intro">Zoek in WikiWoordenboek. Zonder zoekopdracht krijg je eerst moeilijke woorden voorgesteld.</p>
    <div ref={sentinelRef} className="sticky-sentinel" />
    <div className={stuck ? "search-sticky is-stuck" : "search-sticky"}>
      <label className="field-label" htmlFor="zoeken">Zoek een woord</label>
      <div className="search-field">
        <SearchIcon size={20} />
        <input ref={inputRef} id="zoeken" type="search" value={query} maxLength={80}
          onChange={event => changeParams("q", event.target.value)} onKeyDown={event => { if (event.key === "Enter") setDebounced(query); }}
          placeholder="Bijvoorbeeld: onverkwikkelijk" aria-keyshortcuts="/" aria-controls="dictionary-results" lang="nl" autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="search" />
        {query ? <button type="button" className="icon-button" aria-label="Zoekopdracht wissen" onClick={clearQuery}><CloseIcon /></button> : null}
      </div>
    </div>
    {!query.trim() ? <div className="view-switch catalog-scope" role="group" aria-label="Woorden bekijken">
      <button aria-pressed={scope === "recommended"} onClick={() => changeParams("selectie", "")}>Moeilijke woorden</button>
      <button aria-pressed={scope === "all"} onClick={() => changeParams("selectie", "alle")}>Alle woorden</button>
    </div> : query.trim().length < 3 ? <p className="hint-line">Zoekt op het begin van een woord. Vanaf 3 letters ook op woorddelen.</p> : null}
    <p className="count-line" role="status">{pending ? "Woorden laden…" : error ? "" : result ? `${result.total.toLocaleString("nl")} ${result.total === 1 ? "woord" : "woorden"}${scope === "recommended" ? " voorgesteld" : " gevonden"}` : ""}</p>
    {error ? <div className="empty-state"><h2>Even geen verbinding</h2><p>{error}</p><button className="secondary" onClick={() => setRetry(value => value + 1)}>Opnieuw proberen</button></div> : null}
    {result && !pending && !error && !shown.length ? <div className="empty-state"><h2>Geen woorden gevonden</h2><p>Probeer het hoofdwoord of een andere spelling. Losse vervoegingen en verbuigingen staan niet apart in de verzameling.</p><button className="text-button" onClick={() => { setParams({}); inputRef.current?.focus(); }}>Bekijk voorgestelde woorden</button></div> : null}
    <ul id="dictionary-results" className={`result-list${pending ? " is-updating" : ""}`} aria-busy={pending} inert={pending || !!error || undefined}>
      {shown.map(word => {
        const added = deck.inDeck(word.id);
        return <li key={word.id}>
          <WordLink id={word.id} current={openId === word.id} className={openId === word.id ? "is-selected" : undefined}>
            <strong>{word.word}</strong><span>{word.article ? `${word.article} · ` : ""}{word.posLabel}{word.senses[0] ? ` · ${word.senses[0]}` : ""}</span>
          </WordLink>
          <button type="button" className={added ? "icon-button added-mark" : "icon-button add-outline"}
            aria-label={added ? `${word.word} staat in je woorden` : `Voeg ${word.word} toe aan mijn woorden`} aria-disabled={added || undefined} onClick={() => { if (!added) add(word); }}>
            {added ? <CheckIcon /> : <PlusIcon />}
          </button>
        </li>;
      })}
    </ul>
    {result && !error ? <nav className="catalog-pagination" aria-label="Bladeren door woorden">
      <button className="secondary" disabled={pending || page === 0} onClick={() => turnPage(page - 1)}>Vorige</button>
      <span>{result.total ? `${result.offset + 1}–${result.offset + shown.length}` : "0"} van {result.total.toLocaleString("nl")}</span>
      <button className="secondary" disabled={pending || !result.hasMore} onClick={() => turnPage(page + 1)}>Volgende</button>
    </nav> : null}
    <p className="sr-only" role="status">{status}</p>
  </div>;
}
