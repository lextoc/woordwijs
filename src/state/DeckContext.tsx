import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { todayISO } from "../lib/dates";
import {
  addCard,
  applyRating,
  bestStreak,
  dayCounts,
  emptyStore,
  loadStore,
  removeCard,
  saveStore,
  storageAvailable,
  streakNow,
  type Rating,
  type Store,
} from "../lib/model";
import { starterIds } from "../lib/words";

type Toast = { id: number; message: string };

type DeckValue = {
  store: Store;
  today: string;
  storageOk: boolean;
  corrupt: boolean;
  writeError: boolean;
  toast: Toast | null;
  dismissToast: () => void;
  showToast: (message: string) => void;
  inDeck: (id: string) => boolean;
  addWord: (id: string) => boolean;
  addStarter: () => boolean;
  removeWord: (id: string) => boolean;
  rate: (id: string, rating: Rating) => { saved: boolean; becameMastered: boolean; todayCounted: boolean; streak: number };
  reset: () => boolean;
  reloadPage: () => void;
  streak: number;
  best: number;
  todayCounted: boolean;
};

const DeckContext = createContext<DeckValue | null>(null);

export function DeckProvider({ children }: { children: ReactNode }) {
  const initial = loadStore();
  const [store, setStore] = useState<Store>(initial.store);
  const [corrupt, setCorrupt] = useState(initial.corrupt);
  const [storageOk] = useState(storageAvailable);
  const [writeError, setWriteError] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const today = todayISO();

  const commit = useCallback(
    (next: Store) => {
      setStore(next);
      if (!storageOk) {
        setWriteError(true);
        return false;
      }
      const saved = saveStore(next);
      setWriteError(!saved);
      return saved;
    },
    [storageOk],
  );

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  const value = useMemo<DeckValue>(() => {
    return {
      store,
      today,
      storageOk,
      corrupt,
      writeError,
      toast,
      dismissToast: () => setToast(null),
      showToast,
      inDeck: (id) => Boolean(store.cards[id]),
      addWord: (id) => {
        const next = addCard(store, id, today, new Date().toISOString());
        if (next === store) return true;
        const saved = commit(next);
        return saved;
      },
      addStarter: () => {
        let next = store;
        const now = new Date().toISOString();
        starterIds.forEach((id, index) => {
          next = addCard(next, id, today, new Date(Date.now() + index).toISOString() || now);
        });
        return commit(next);
      },
      removeWord: (id) => commit(removeCard(store, id)),
      rate: (id, rating) => {
        const result = applyRating(store, id, rating, today);
        const saved = commit(result.store);
        return {
          saved,
          becameMastered: result.becameMastered,
          todayCounted: Boolean(result.store.dayLog?.date === today && dayCounts(result.store.dayLog)),
          streak: streakNow(result.store, today),
        };
      },
      reset: () => {
        const saved = commit(emptyStore());
        if (saved) setCorrupt(false);
        return saved;
      },
      reloadPage: () => window.location.reload(),
      streak: streakNow(store, today),
      best: bestStreak(store),
      todayCounted: Boolean(store.dayLog?.date === today && dayCounts(store.dayLog)),
    };
  }, [commit, corrupt, showToast, storageOk, store, today, toast, writeError]);

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeck(): DeckValue {
  const value = useContext(DeckContext);
  if (!value) throw new Error("Deck ontbreekt");
  return value;
}
