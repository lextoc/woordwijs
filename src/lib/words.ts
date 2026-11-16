import payload from "../data/words.json";
import { blankExample, containsWord, fold, hashString, mulberry32, shuffle } from "./text";

export type Article = "de" | "het" | "de/het";

export type Word = {
  id: string;
  word: string;
  pos: string;
  posLabel: string;
  article: Article | null;
  senses: string[];
  example: string | null;
  rank: number;
  labels?: string[];
};

function asArticle(value: string | null): Article | null {
  if (value === "de" || value === "het" || value === "de/het") return value;
  return null;
}

export const words: Word[] = payload.words.map((entry) => ({
  id: entry.id,
  word: entry.word,
  pos: entry.pos,
  posLabel: entry.posLabel,
  article: asArticle(entry.article),
  senses: entry.senses,
  example: entry.example,
  rank: entry.rank,
}));

export const wordById = new Map(words.map((word) => [word.id, word]));
// Keep the small approved starter set bundled. Additional entries are loaded on demand.
export function registerWords(entries: Word[]) {
  for (const entry of entries) {
    if (typeof entry?.id !== "string" || typeof entry.word !== "string" || typeof entry.pos !== "string" || !Array.isArray(entry.senses) || !entry.senses.every(sense => typeof sense === "string")) throw new Error("Ongeldige woordgegevens.");
    if (!wordById.has(entry.id)) wordById.set(entry.id, entry);
  }
}

export const starterIds = payload.meta.starterIds.filter((id) => wordById.has(id));
export const meta = payload.meta;

export function wordOfTheDay(isoDate: string): Word {
  const ordered = [...words].sort((a, b) => a.id.localeCompare(b.id, "nl"));
  return ordered[hashString(isoDate) % ordered.length];
}

export function searchWords(query: string): Word[] {
  const needle = fold(query);
  if (!needle.length) return [];
  const exact: Word[] = [];
  const starts: Word[] = [];
  const contains: Word[] = [];
  for (const word of words) {
    const name = fold(word.word);
    if (name === needle) exact.push(word);
    else if (name.startsWith(needle)) starts.push(word);
    else if (name.includes(needle)) contains.push(word);
  }
  const byRank = (a: Word, b: Word) => a.rank - b.rank || a.id.localeCompare(b.id);
  exact.sort(byRank);
  starts.sort(byRank);
  contains.sort(byRank);
  return [...exact, ...starts, ...contains];
}

export function canBlank(word: Word): boolean {
  return Boolean(word.example && blankExample(word.example, word.word));
}

export type ChoiceOption = { text: string; correct: boolean };

export function choiceOptions(target: Word, seed: string): ChoiceOption[] | null {
  const answer = target.senses[0];
  if (!answer) return null;
  const samePos = words.filter((word) => {
    if (word.id === target.id || word.pos !== target.pos) return false;
    const text = word.senses[0];
    if (!text || fold(text) === fold(answer)) return false;
    if (containsWord(text, target.word)) return false;
    return true;
  });
  const random = shuffle(samePos, mulberry32(hashString(seed)));
  const picked: string[] = [];
  const seen = new Set<string>([fold(answer)]);
  for (const word of random) {
    const text = word.senses[0];
    const key = fold(text);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(text);
    if (picked.length === 3) break;
  }
  if (picked.length < 3) return null;
  const options = [{ text: answer, correct: true }, ...picked.map((text) => ({ text, correct: false }))];
  return shuffle(options, mulberry32(hashString(`${seed}:options`)));
}
