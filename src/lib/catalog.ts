import { registerWords, wordById, type Word } from "./words";

export type CatalogStats = { entries: number; recommended: number; withExample: number; importedAt: string; source: string; sourceSha256: string };
export type CatalogPage = { words: Word[]; total: number; offset: number; limit: number; dictionaryTotal: number; recommendedTotal: number; hasMore: boolean };

async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(), 15000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout.signal]) : timeout.signal;
  try {
    const response = await fetch(path, { ...options, signal, credentials: "omit" });
    if (!response.ok) throw new Error("Het woordenboek is tijdelijk niet bereikbaar.");
    return await response.json();
  } catch (error) {
    if (timeout.signal.aborted && !options.signal?.aborted) throw new Error("Het laden duurt te lang. Probeer opnieuw.");
    throw error;
  } finally { window.clearTimeout(timer); }
}

export async function searchCatalog(query: string, scope: "recommended" | "all", offset: number, signal: AbortSignal): Promise<CatalogPage> {
  const params = new URLSearchParams({ q: query, scope, offset: String(offset), limit: "20" });
  const data = await request(`/api/words?${params}`, { signal }) as CatalogPage;
  if (!Array.isArray(data.words) || !Number.isSafeInteger(data.total)) throw new Error("Het woordenboek gaf geen geldig antwoord.");
  registerWords(data.words);
  return data;
}

export async function ensureWords(ids: string[], signal: AbortSignal): Promise<void> {
  const missing = [...new Set(ids)].filter(id => !wordById.has(id));
  for (let start = 0; start < missing.length; start += 100) {
    const data = await request("/api/words/by-id", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: missing.slice(start, start + 100) }), signal,
    }) as { words: Word[]; missing: string[] };
    if (!Array.isArray(data.words) || !Array.isArray(data.missing)) throw new Error("De woorden konden niet worden geladen.");
    registerWords(data.words);
    if (data.missing.length) throw new Error("Een opgeslagen woord is niet beschikbaar. Je voortgang is niet gewist.");
  }
}

export async function catalogStats(signal: AbortSignal): Promise<CatalogStats> {
  return await request("/api/stats", { signal }) as CatalogStats;
}
