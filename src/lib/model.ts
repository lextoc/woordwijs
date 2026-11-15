import { addDays, currentStreak, longestStreak } from "./dates";

export type Rating = "niet" | "moeilijk" | "goed" | "makkelijk";
export type Status = "nieuw" | "bezig" | "geleerd";

export type Card = {
  id: string;
  addedAt: string;
  ease: number;
  interval: number;
  repetitions: number;
  due: string;
  lastRating: Rating | null;
  ratings: { date: string; rating: Rating }[];
  consecutiveGood: number;
  consecutiveGoodDates: string[];
  mastered: boolean;
};

export type DayLog = {
  date: string;
  answeredIds: string[];
  dueIdsAtStart: string[];
};

export type Store = {
  version: 1;
  cards: Record<string, Card>;
  countedDays: string[];
  hasHistory: boolean;
  dayLog: DayLog | null;
};

const KEY = "woordwijs.v1";
const QUALITY: Record<Rating, number> = { niet: 0, moeilijk: 3, goed: 4, makkelijk: 5 };

export function emptyStore(): Store {
  return { version: 1, cards: {}, countedDays: [], hasHistory: false, dayLog: null };
}

export function cardStatus(card: Card): Status {
  if (card.mastered) return "geleerd";
  if (card.ratings.length === 0) return "nieuw";
  return "bezig";
}

export function storageAvailable(): boolean {
  try {
    const probe = "__woordwijs_probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== "object") return false;
  const card = value as Card;
  return typeof card.id === "string" && Array.isArray(card.ratings) && typeof card.due === "string";
}

export function loadStore(): { store: Store; corrupt: boolean } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return { store: emptyStore(), corrupt: false };
  }
  if (!raw) return { store: emptyStore(), corrupt: false };
  try {
    const parsed = JSON.parse(raw) as Store;
    if (parsed.version !== 1 || !parsed.cards || typeof parsed.cards !== "object" || !Array.isArray(parsed.countedDays)) {
      return { store: emptyStore(), corrupt: true };
    }
    if (!Object.values(parsed.cards).every(isCard)) return { store: emptyStore(), corrupt: true };
    return { store: parsed, corrupt: false };
  } catch {
    return { store: emptyStore(), corrupt: true };
  }
}

export function saveStore(store: Store): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function dueCards(store: Store, today: string): Card[] {
  return Object.values(store.cards)
    .filter((card) => card.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due) || a.ease - b.ease || a.id.localeCompare(b.id));
}

export function dayCounts(log: DayLog | null): boolean {
  if (!log) return false;
  const answered = new Set(log.answeredIds);
  if (answered.size >= 5) return true;
  if (log.dueIdsAtStart.length > 0 && log.dueIdsAtStart.length < 5) {
    return log.dueIdsAtStart.every((id) => answered.has(id));
  }
  return false;
}

export function streakNow(store: Store, today: string): number {
  return currentStreak(store.countedDays, today);
}

export function bestStreak(store: Store): number {
  return longestStreak(store.countedDays);
}

export function addCard(store: Store, id: string, today: string, now: string): Store {
  if (store.cards[id]) return store;
  const next = structuredClone(store);
  next.cards[id] = {
    id,
    addedAt: now,
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    due: today,
    lastRating: null,
    ratings: [],
    consecutiveGood: 0,
    consecutiveGoodDates: [],
    mastered: false,
  };
  next.hasHistory = true;
  if (next.dayLog?.date === today && !next.dayLog.dueIdsAtStart.includes(id)) {
    next.dayLog.dueIdsAtStart.push(id);
  }
  return next;
}

export function removeCard(store: Store, id: string): Store {
  if (!store.cards[id]) return store;
  const next = structuredClone(store);
  delete next.cards[id];
  if (next.dayLog) {
    next.dayLog.answeredIds = next.dayLog.answeredIds.filter((item) => item !== id);
    next.dayLog.dueIdsAtStart = next.dayLog.dueIdsAtStart.filter((item) => item !== id);
  }
  return next;
}

export function applyRating(store: Store, id: string, rating: Rating, today: string): { store: Store; becameMastered: boolean } {
  const card = store.cards[id];
  if (!card) return { store, becameMastered: false };
  const next = structuredClone(store);
  const current = next.cards[id];
  const wasMastered = current.mastered;
  if (!next.dayLog || next.dayLog.date !== today) {
    next.dayLog = {
      date: today,
      answeredIds: [],
      dueIdsAtStart: Object.values(next.cards)
        .filter((item) => item.due <= today)
        .map((item) => item.id)
        .sort(),
    };
  }
  if (!next.dayLog.answeredIds.includes(id)) next.dayLog.answeredIds.push(id);

  const quality = QUALITY[rating];
  let ease = current.ease;
  if (quality < 3) {
    current.repetitions = 0;
    current.interval = 1;
  } else {
    if (current.repetitions === 0) current.interval = 1;
    else if (current.repetitions === 1) current.interval = 6;
    else current.interval = Math.max(1, Math.round(current.interval * ease));
    current.repetitions += 1;
  }
  ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  current.ease = Math.round(Math.max(1.3, ease) * 100) / 100;
  current.due = addDays(today, current.interval);
  current.lastRating = rating;
  current.ratings = [...current.ratings, { date: today, rating }].slice(-20);

  if (rating === "goed" || rating === "makkelijk") {
    current.consecutiveGood += 1;
    if (!current.consecutiveGoodDates.includes(today)) current.consecutiveGoodDates.push(today);
    if (current.consecutiveGood >= 3 && new Set(current.consecutiveGoodDates).size >= 3) current.mastered = true;
  } else if (rating === "niet") {
    current.consecutiveGood = 0;
    current.consecutiveGoodDates = [];
    current.mastered = false;
  } else {
    current.consecutiveGood = 0;
    current.consecutiveGoodDates = [];
  }

  if (dayCounts(next.dayLog) && !next.countedDays.includes(today)) {
    next.countedDays = [...next.countedDays, today].sort();
  }
  next.hasHistory = true;
  return { store: next, becameMastered: !wasMastered && current.mastered };
}
