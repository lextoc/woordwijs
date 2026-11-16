import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ensureWords } from "../lib/catalog";
import { wordById } from "../lib/words";
import { useDeck } from "../state/DeckContext";

export function CatalogBoundary({ children }: { children: ReactNode }) {
  const { store } = useDeck();
  const location = useLocation();
  const ids = Object.keys(store.cards);
  if (location.pathname.startsWith("/woord/")) {
    try { ids.push(decodeURIComponent(location.pathname.slice(7))); } catch {}
  }
  const needed = [...new Set(ids)].sort();
  const signature = JSON.stringify(needed);
  const [result, setResult] = useState({ signature: "", error: "", revision: 0 });
  const [attempt, setAttempt] = useState(0);
  const missing = needed.some(id => !wordById.has(id));
  useEffect(() => {
    const controller = new AbortController();
    if (needed.every(id => wordById.has(id))) return;
    setResult(previous => ({ ...previous, signature, error: "" }));
    ensureWords(needed, controller.signal).then(() => {
      if (!controller.signal.aborted) setResult(previous => ({ signature, error: "", revision: previous.revision + 1 }));
    }).catch(error => {
      if (!controller.signal.aborted) setResult(previous => ({ ...previous, signature, error: error instanceof Error ? error.message : "Je woorden konden niet worden geladen." }));
    });
    return () => controller.abort();
  }, [signature, attempt]);
  if (!missing) return children;
  const error = result.signature === signature ? result.error : "";
  return <main className="page catalog-loading" aria-busy={!error}>
    <h1 className="page-title">{error ? "Je woorden konden niet worden geladen" : "Je woorden laden…"}</h1>
    <p role="status">{error || "Alleen de woorden die je nodig hebt worden opgehaald."}</p>
    {error ? <><p>Je opgeslagen woorden en voortgang blijven bewaard.</p><button className="primary" onClick={() => setAttempt(value => value + 1)}>Opnieuw proberen</button></> : null}
  </main>;
}
