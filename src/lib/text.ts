export function fold(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("nl")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function normalizeAnswer(value: string): string {
  return fold(value).replace(/[’']/g, "").replace(/-/g, "");
}

export function containsWord(haystack: string, needle: string): boolean {
  const escaped = fold(needle).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return false;
  return new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "u").test(fold(haystack));
}

export function blankExample(example: string, word: string): { before: string; after: string } | null {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?<![\\p{L}\\p{M}])(${escaped})(?![\\p{L}\\p{M}])`, "iu").exec(example);
  if (!match || match.index === undefined) return null;
  return {
    before: example.slice(0, match.index),
    after: example.slice(match.index + match[0].length),
  };
}

export function letterCount(word: string): number {
  return [...word].length;
}

export function levenshtein(left: string, right: string): number {
  const a = [...left];
  const b = [...right];
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + cost);
      previous = current;
    }
  }
  return row[b.length];
}

export type FillJudgement = "empty" | "juist" | "bijna" | "fout";

export function judgeFill(input: string, word: string): FillJudgement {
  if (!input.trim()) return "empty";
  const given = normalizeAnswer(input);
  const expected = normalizeAnswer(word);
  if (given === expected) return "juist";
  if ([...word].length >= 6 && levenshtein(given, expected) === 1) return "bijna";
  return "fout";
}

export function dagen(count: number): string {
  return count === 1 ? "1 dag" : `${count} dagen`;
}

export function woorden(count: number): string {
  return count === 1 ? "1 woord" : `${count} woorden`;
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap];
    copy[swap] = current;
  }
  return copy;
}
