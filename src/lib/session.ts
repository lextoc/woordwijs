import type { Card } from "./model";
import { cardStatus } from "./model";
import type { Word } from "./words";
import { canBlank } from "./words";

export type Exercise = "recall" | "choice" | "fill";

export function exerciseFor(card: Card, word: Word): Exercise {
  if (cardStatus(card) === "nieuw" || card.lastRating === "niet") return "recall";
  const recent = card.ratings.slice(-2);
  const trending = recent.length === 2 && recent.every((item) => item.rating === "goed" || item.rating === "makkelijk");
  if (trending && canBlank(word)) return "fill";
  return "choice";
}

export function dueSession(cards: Record<string, Card>, today: string): string[] {
  const values = Object.values(cards);
  const reviews = values
    .filter((card) => card.due <= today && cardStatus(card) !== "nieuw")
    .sort((a, b) => a.due.localeCompare(b.due) || a.ease - b.ease || a.id.localeCompare(b.id));
  const fresh = values
    .filter((card) => card.due <= today && cardStatus(card) === "nieuw")
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id));
  return [...reviews, ...fresh.slice(0, 5)].slice(0, 10).map((card) => card.id);
}

export function extraSession(cards: Record<string, Card>): string[] {
  const values = Object.values(cards);
  const missed = values
    .filter((card) => card.lastRating === "niet" || card.lastRating === "moeilijk")
    .sort((a, b) => (b.ratings.at(-1)?.date ?? "").localeCompare(a.ratings.at(-1)?.date ?? "") || a.id.localeCompare(b.id));
  const rest = values
    .filter((card) => card.lastRating !== "niet" && card.lastRating !== "moeilijk")
    .sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
  return [...missed, ...rest].slice(0, 10).map((card) => card.id);
}
