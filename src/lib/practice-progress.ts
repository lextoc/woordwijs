import type { Card } from "./model";
import { wordById } from "./words";

// Only offer recovery when the current saved exercise still belongs to this deck.
export function practiceProgress(cards: Record<string, Card>): { remaining: number } | null {
  try {
    const raw = sessionStorage.getItem("woordwijs.sessie");
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved.queue) || !Number.isInteger(saved.index) || saved.index < 0 || saved.index >= saved.queue.length || !["recall-front", "recall-back", "choice", "fill"].includes(saved.phase?.kind)) return null;
    const current = saved.queue[saved.index]?.id;
    if (!cards[current] || !wordById.has(current)) return null;
    const remaining = new Set<string>();
    for (const item of saved.queue.slice(saved.index)) if (cards[item?.id] && wordById.has(item.id)) remaining.add(item.id);
    return { remaining: remaining.size };
  } catch { return null; }
}
