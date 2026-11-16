import { useEffect, useRef, useState, type RefObject } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRightIcon, CheckIcon, CloseIcon } from "../components/Icons";
import { Dialog, readState, StorageBanner, useBarHeight } from "../components/ui";
import { blankExample, judgeFill, letterCount } from "../lib/text";
import type { Rating } from "../lib/model";
import { exerciseFor, extraSession, dueSession } from "../lib/session";
import { choiceOptions, wordById, type ChoiceOption, type Word } from "../lib/words";
import { useDeck } from "../state/DeckContext";
import type { SummaryState } from "./Summary";

type Phase =
  | { kind: "recall-front" }
  | { kind: "recall-back" }
  | { kind: "choice"; options: ChoiceOption[]; picked: number | null }
  | { kind: "fill"; value: string; hint: boolean; result: "juist" | "bijna" | "fout" | "empty" | null };

type Tally = {
  answers: number;
  goed: number;
  moeilijk: number;
  niet: number;
  learned: string[];
  misses: string[];
  streak: number;
  todayCounted: boolean;
};

type Saved = {
  startedAt: number;
  queue: { id: string }[];
  index: number;
  phase: Phase;
  tally: Tally;
  countedAtStart: boolean;
  plannedIds?: string[];
  doneIds?: string[];
};

const SESSION_KEY = "woordwijs.sessie";
const STOPPED_KEY = "woordwijs.gestopt";

function readSaved(): Saved | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Saved;
    if (!parsed.queue?.length || !parsed.phase) return null;
    return parsed;
  } catch {
    return null;
  }
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  ids.forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

function phaseFor(id: string, appearance: number, cards: ReturnType<typeof useDeck>["store"]["cards"]): Phase {
  const word = wordById.get(id);
  const card = cards[id];
  if (!word || !card) return { kind: "recall-front" };
  const exercise = exerciseFor(card, word);
  if (exercise === "choice") {
    const options = choiceOptions(word, `${id}:${appearance}`);
    if (options) return { kind: "choice", options, picked: null };
  }
  if (exercise === "fill" && word.example && blankExample(word.example, word.word)) {
    return { kind: "fill", value: "", hint: false, result: null };
  }
  return { kind: "recall-front" };
}

function eyebrow(base: string, repeat: boolean) {
  return repeat ? `Nog een keer · ${base}` : base;
}

export function Practice() {
  const deck = useDeck();
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = (location.state ?? null) as { mode?: "due" | "extra"; startedAt?: number; dialog?: string } | null;
  const stop = readState(location.state)?.dialog === "stop";
  const setup = useRef<Saved | null | undefined>(undefined);
  if (setup.current === undefined) setup.current = createSession(incoming, deck);
  const saved = setup.current;
  const [sessionError, setSessionError] = useState(false);
  const [queue, setQueue] = useState(saved?.queue ?? []);
  const [index, setIndex] = useState(saved?.index ?? 0);
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? { kind: "recall-front" });
  const [plannedIds] = useState<string[]>(() => uniqueIds(saved?.plannedIds ?? saved?.queue.map((item) => item.id) ?? []));
  const [doneIds, setDoneIds] = useState<string[]>(saved?.doneIds ?? []);
  const tally = useRef<Tally>(saved?.tally ?? emptyTally(deck.streak, deck.todayCounted));
  const countedAtStart = useRef(saved?.countedAtStart ?? deck.todayCounted);
  const startedAt = saved?.startedAt ?? 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const meaningRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const showRef = useRef<HTMLButtonElement>(null);
  const correctRef = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const showBar = phase.kind !== "choice" || phase.picked !== null;
  useBarHeight(barRef, showBar);

  useEffect(() => {
    if (!saved) return;
    const snapshot: Saved = {
      startedAt,
      queue,
      index,
      phase,
      tally: tally.current,
      countedAtStart: countedAtStart.current,
      plannedIds,
      doneIds,
    };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(snapshot)); } catch { setSessionError(true); }
  }, [doneIds, index, phase, plannedIds, queue, saved, startedAt]);

  useEffect(() => {
    document.title = "Oefenen · Woordwijs";
  }, []);

  useEffect(() => {
    const element = rootRef.current;
    const apply = () => {
      const viewport = window.visualViewport;
      const open = viewport ? viewport.height < window.innerHeight - 120 : false;
      element?.classList.toggle("kb-open", open);
    };
    apply();
    window.visualViewport?.addEventListener("resize", apply);
    window.addEventListener("resize", apply);
    return () => {
      window.visualViewport?.removeEventListener("resize", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

  const phaseKey = phase.kind === "choice" ? `choice:${phase.picked ?? "open"}` : phase.kind === "fill" ? `fill:${phase.result ?? "open"}` : phase.kind;

  useEffect(() => {
    if (phase.kind === "recall-back") {
      meaningRef.current?.focus();
      return;
    }
    if (phase.kind === "recall-front") {
      showRef.current?.focus();
      return;
    }
    if (phase.kind === "choice" && phase.picked !== null) {
      nextRef.current?.focus();
      if (window.innerHeight <= 667) correctRef.current?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (phase.kind === "fill" && phase.result && phase.result !== "empty") {
      nextRef.current?.focus();
      return;
    }
    if (phase.kind === "fill" && phase.result === "empty") {
      inputRef.current?.focus();
      return;
    }
    if (phase.kind === "fill") {
      if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
      else headingRef.current?.focus();
      return;
    }
    headingRef.current?.focus();
  }, [index, phase.kind, phaseKey]);

  if (!saved) return <Navigate to="/" replace />;

  const current = queue[index];
  const word = current ? wordById.get(current.id) : undefined;
  const card = current ? deck.store.cards[current.id] : undefined;
  if (!current || !word || !card) return <Navigate to="/" replace />;

  const seenBefore = queue.slice(0, index).some((item) => item.id === current.id);
  const total = plannedIds.length || queue.length;
  const position = Math.min(total, Math.max(1, seenBefore ? doneIds.length : doneIds.length + 1));

  function finish(rating: Rating, nextQueue = queue) {
    const result = deck.rate(word!.id, rating);
    const score = tally.current;
    score.answers += 1;
    if (rating === "goed" || rating === "makkelijk") score.goed += 1;
    else if (rating === "moeilijk") score.moeilijk += 1;
    else {
      score.niet += 1;
      score.misses = [...score.misses.filter((id) => id !== word!.id), word!.id];
    }
    if (result.becameMastered) score.learned = [...new Set([...score.learned, word!.id])];
    score.streak = result.streak;
    score.todayCounted = result.todayCounted;
    setDoneIds((prev) => (prev.includes(word!.id) ? prev : [...prev, word!.id]));
    const appearances = nextQueue.filter((item) => item.id === word!.id).length;
    const remaining = nextQueue.length - index - 1;
    let queued = nextQueue;
    if (rating === "niet" && appearances < 3 && remaining >= 3) {
      queued = [...nextQueue];
      queued.splice(index + 4, 0, { id: word!.id });
      setQueue(queued);
    }
    const nextIndex = index + 1;
    if (nextIndex >= queued.length) {
      try { sessionStorage.removeItem(SESSION_KEY); } catch {}
      const summary: SummaryState = {
        answers: score.answers,
        goed: score.goed,
        moeilijk: score.moeilijk,
        niet: score.niet,
        learnedIds: score.learned,
        missIds: score.misses.slice(-5).reverse(),
        streak: score.streak,
        streakIncreased: !countedAtStart.current && score.todayCounted,
      };
      navigate("/oefenen/klaar", { replace: true, state: summary });
      return;
    }
    setIndex(nextIndex);
    const nextId = queued[nextIndex].id;
    const seen = queued.slice(0, nextIndex).filter((item) => item.id === nextId).length;
    setPhase(phaseFor(nextId, seen, deck.store.cards));
  }

  function openStop() {
    if (readState(location.state)?.dialog === "stop") return;
    rootRef.current?.querySelector<HTMLButtonElement>(".session-bar button")?.focus();
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { state: { ...(readState(location.state) ?? {}), dialog: "stop", mode: incoming?.mode, startedAt } },
    );
  }

  function closeStop() {
    if (readState(window.history.state?.usr)?.dialog === "stop") navigate(-1);
  }

  function quit() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.setItem(STOPPED_KEY, String(startedAt));
    } catch {}
    const idx = (window.history.state?.idx as number | undefined) ?? 0;
    if (idx >= 2) navigate(-2);
    else navigate("/", { replace: true });
  }

  function onKey(event: KeyboardEvent) {
    if (event.repeat) {
      if (["Enter", " ", "1", "2", "3", "4", "Escape"].includes(event.key) && !(event.target instanceof HTMLInputElement)) event.preventDefault();
      return;
    }
    if (stop || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (event.key === "Escape") {
      event.preventDefault();
      openStop();
      return;
    }
    if (phase.kind === "recall-front" && (event.key === " " || event.key === "Enter") && !typing) {
      event.preventDefault();
      setPhase({ kind: "recall-back" });
    }
    if (fine && phase.kind === "recall-back" && ["1", "2", "3", "4"].includes(event.key) && !typing) {
      event.preventDefault();
      finish((["niet", "moeilijk", "goed", "makkelijk"] as Rating[])[Number(event.key) - 1]);
    }
    if (fine && phase.kind === "choice" && phase.picked === null && ["1", "2", "3", "4"].includes(event.key) && !typing) {
      event.preventDefault();
      pickChoice(Number(event.key) - 1);
    }
    if (phase.kind === "choice" && phase.picked !== null && (event.key === "Enter" || event.key === " ") && !typing) {
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      const choice = phase.options[phase.picked];
      finish(choice.correct ? "goed" : "niet");
    }
    if (phase.kind === "fill" && phase.result && phase.result !== "empty" && (event.key === "Enter" || event.key === " ") && !typing) {
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      const rating: Rating = phase.result === "fout" ? "niet" : phase.hint ? "moeilijk" : "goed";
      finish(rating);
    }
  }

  function pickChoice(optionIndex: number) {
    if (phase.kind !== "choice" || phase.picked !== null) return;
    setPhase({ ...phase, picked: optionIndex });
  }

  function checkFill() {
    if (phase.kind !== "fill") return;
    const judgement = judgeFill(phase.value, word!.word);
    if (judgement === "empty") {
      setPhase({ ...phase, result: "empty" });
      return;
    }
    setPhase({ ...phase, result: judgement });
  }

  const long = word.word.length >= 12;

  return (
    <div className="practice" ref={rootRef} onKeyDownCapture={(event) => onKey(event.nativeEvent)}>
      <StorageBanner />
      {sessionError && deck.storageOk ? <p className="session-save-note" role="status">Je antwoorden worden bewaard, maar deze browser kan de open oefening niet onthouden.</p> : null}
      <header className="session-bar">
        <button type="button" onClick={openStop} aria-label="Stoppen met oefenen">
          <CloseIcon />
          <span>Stoppen</span>
          <kbd className="hotkey">Esc</kbd>
        </button>
        <span className="session-count">
          {position} van {total}
        </span>
      </header>
      <div
        className="ticks"
        role="progressbar"
        aria-valuemin={1}
        aria-valuenow={position}
        aria-valuemax={total}
        aria-label={`Voortgang van deze oefening, ${position} van ${total}`}
      >
        {plannedIds.map((id) => {
          const answered = doneIds.includes(id);
          const currentTick = id === current.id && !seenBefore;
          return <i key={id} className={currentTick ? "is-current" : answered ? "is-done" : undefined} aria-hidden="true" />;
        })}
      </div>
      <div className="card-area">
        {phase.kind === "recall-front" || phase.kind === "recall-back" ? (
          <>
            <p className="eyebrow">{eyebrow("Betekenis", seenBefore)}</p>
            <h1 ref={headingRef} tabIndex={-1} className={long ? "practice-word is-long" : "practice-word"}>
              {word.word}
            </h1>
            <p className="word-class">
              {phase.kind === "recall-back" && word.article ? `${word.article} · ` : ""}
              {word.posLabel}
            </p>
            {phase.kind === "recall-back" ? (
              <div ref={meaningRef} tabIndex={-1} className="meaning-block" aria-live="polite">
                <p className="reveal">{word.senses[0]}</p>
                {word.senses.length > 1 ? (
                  <Link className="text-link" to={`/woord/${encodeURIComponent(word.id)}`}>
                    Meer betekenissen
                  </Link>
                ) : null}
                {word.example ? <blockquote className="quote">{word.example}</blockquote> : null}
              </div>
            ) : null}
          </>
        ) : null}
        {phase.kind === "choice" ? (
          <>
            <p className="eyebrow">{eyebrow("Kies de betekenis", seenBefore)}</p>
            <h1 ref={headingRef} tabIndex={-1} className={long ? "practice-word is-long" : "practice-word"}>
              {word.word}
            </h1>
            <p className="word-class">{word.posLabel}</p>
            <div className="options">
              {phase.options.map((option, optionIndex) => {
                const locked = phase.picked !== null;
                const showCorrect = locked && option.correct;
                const showWrong = locked && phase.picked === optionIndex && !option.correct;
                return (
                  <button
                    key={option.text}
                    type="button"
                    ref={option.correct ? correctRef : undefined}
                    className={`option${showCorrect ? " is-correct" : ""}${showWrong ? " is-wrong" : ""}`}
                    aria-disabled={locked || undefined}
                    onClick={() => pickChoice(optionIndex)}
                  >
                    {showCorrect ? <CheckIcon /> : null}
                    {showWrong ? <CloseIcon /> : null}
                    {locked ? null : <kbd className="hotkey">{optionIndex + 1}</kbd>}
                    <span>{option.text}</span>
                    {showCorrect ? <span className="sr-only">Juist antwoord</span> : null}
                    {showWrong ? <span className="sr-only">Niet juist</span> : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
        {phase.kind === "fill" && word.example ? (
          <FillCard
            word={word}
            phase={phase}
            headingRef={headingRef}
            repeat={seenBefore}
            onHint={() => setPhase({ ...phase, hint: true })}
          />
        ) : null}
      </div>
      {showBar ? (
        <div className="action-bar" ref={barRef}>
          {phase.kind === "recall-front" ? (
            <button ref={showRef} type="button" className="primary" onClick={() => setPhase({ kind: "recall-back" })}>
              Toon betekenis
            </button>
          ) : null}
          {phase.kind === "recall-back" ? (
            <>
              <p className="rate-label">Hoe goed wist je het?</p>
              <div className="ratings">
                <RateButton hotkey="1" label="Niet geweten" hint="Komt snel terug" onClick={() => finish("niet")} />
                <RateButton hotkey="2" label="Moeilijk" hint="Komt vaker terug" onClick={() => finish("moeilijk")} />
                <RateButton hotkey="3" label="Goed" hint="Komt later terug" onClick={() => finish("goed")} />
                <RateButton hotkey="4" label="Makkelijk" hint="Komt veel later terug" onClick={() => finish("makkelijk")} />
              </div>
            </>
          ) : null}
          {phase.kind === "choice" && phase.picked !== null ? (
            <>
              <p className="bar-feedback" id="practice-feedback" role="status">
                {phase.options[phase.picked].correct ? <CheckIcon size={20} /> : <CloseIcon size={20} />}
                <span>{phase.options[phase.picked].correct ? "Juist." : "Niet juist."}</span>
              </p>
              <button
                ref={nextRef}
                type="button"
                className="primary split"
                aria-describedby="practice-feedback"
                onClick={() => finish(phase.options[phase.picked!].correct ? "goed" : "niet")}
              >
                <span>Volgende</span>
                <ArrowRightIcon />
              </button>
            </>
          ) : null}
          {phase.kind === "fill" && (!phase.result || phase.result === "empty") ? (
            <>
              <p className={phase.result === "empty" ? "bar-label is-alert" : "bar-label"} role={phase.result === "empty" ? "alert" : undefined}>
                {phase.result === "empty" ? (
                  <>
                    <CloseIcon size={16} /> Vul een woord in.
                  </>
                ) : (
                  "Welk woord ontbreekt?"
                )}
              </p>
              <div className="fill-row">
                <input
                  ref={inputRef}
                  id="ontbrekend"
                  aria-label="Welk woord ontbreekt?"
                  value={phase.value}
                  onChange={(event) => setPhase({ ...phase, value: event.target.value, result: phase.result === "empty" ? null : phase.result })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      checkFill();
                    }
                  }}
                  lang="nl"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="done"
                />
                <button type="button" className="primary" onClick={checkFill}>
                  Controleer
                </button>
              </div>
              <button type="button" className="text-button center" onClick={() => setPhase({ ...phase, result: "fout" })}>
                Ik weet het niet
              </button>
            </>
          ) : null}
          {phase.kind === "fill" && phase.result && phase.result !== "empty" ? (
            <>
              <p className="bar-feedback" id="practice-feedback" role="status">
                {phase.result === "juist" ? <CheckIcon size={20} /> : <CloseIcon size={20} />}
                <span>
                  {phase.result === "juist" ? "Juist." : null}
                  {phase.result === "bijna" ? (
                    <>
                      Bijna goed. Het woord is <strong>{word.word}</strong>.
                    </>
                  ) : null}
                  {phase.result === "fout" ? (
                    <>
                      Niet juist. Het woord is <strong>{word.word}</strong>.
                    </>
                  ) : null}
                </span>
              </p>
              <button
                ref={nextRef}
                type="button"
                className="primary split"
                aria-describedby="practice-feedback"
                onClick={() => finish(phase.result === "fout" ? "niet" : phase.hint ? "moeilijk" : "goed")}
              >
                <span>Volgende</span>
                <ArrowRightIcon />
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {stop ? (
        <Dialog title="Stoppen met oefenen?" onClose={closeStop} role="dialog">
          <p>
            {deck.storageOk
              ? "Je antwoorden tot nu toe zijn bewaard. De rest van de woorden blijft voor vandaag staan."
              : "Je antwoorden gaan verloren zodra je de pagina sluit."}
          </p>
          <div className="modal-actions">
            <button type="button" className="danger-button" onClick={quit}>
              Stoppen
            </button>
            {!sessionError ? <button type="button" className="secondary" onClick={() => navigate("/", { replace: true })}>Later verdergaan</button> : null}
            <button type="button" className="secondary" data-initial-focus onClick={closeStop}>
              Doorgaan met oefenen
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function RateButton({ hotkey, label, hint, onClick }: { hotkey: string; label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" className="rating" aria-label={`${label}, ${hint.charAt(0).toLocaleLowerCase("nl")}${hint.slice(1)}`} onClick={onClick}>
      <kbd className="hotkey">{hotkey}</kbd>
      <strong>{label}</strong>
      <small>{hint}</small>
    </button>
  );
}

function FillCard({
  word,
  phase,
  headingRef,
  repeat,
  onHint,
}: {
  word: Word;
  phase: Extract<Phase, { kind: "fill" }>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  repeat: boolean;
  onHint: () => void;
}) {
  const parts = word.example ? blankExample(word.example, word.word) : null;
  const checked = Boolean(phase.result && phase.result !== "empty");
  const hint = `Hint: ${letterCount(word.word)} letters, begint met ${[...word.word][0]?.toLocaleLowerCase("nl") ?? ""}`;
  const sentence = word.example ?? "";
  return (
    <>
      <p className="eyebrow">{eyebrow("Vul het ontbrekende woord in", repeat)}</p>
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {word.word}
      </h1>
      <p className={sentence.length > 80 ? "fill-sentence is-long" : "fill-sentence"}>
        {parts?.before}
        {checked ? (
          <span className={phase.result === "juist" ? "blank is-filled" : "blank is-wrong"}>{word.word}</span>
        ) : (
          <span className="blank" aria-label="ontbrekend woord" />
        )}
        {parts?.after}
      </p>
      {!checked ? <p className="hint-line">Hoofdletters en accenten maken niet uit.</p> : null}
      {!checked && !phase.hint ? (
        <button type="button" className="text-button" onClick={onHint}>
          Toon hint
        </button>
      ) : null}
      {phase.hint && !checked ? <p className="hint-line">{hint}</p> : null}
      {checked ? <p className="fill-meaning">{word.senses[0]}</p> : null}
    </>
  );
}

function emptyTally(streak: number, todayCounted: boolean): Tally {
  return { answers: 0, goed: 0, moeilijk: 0, niet: 0, learned: [], misses: [], streak, todayCounted };
}

function createSession(incoming: { mode?: "due" | "extra"; startedAt?: number } | null, deck: ReturnType<typeof useDeck>): Saved | null {
  const existing = readSaved();
  if (existing && incoming?.startedAt && existing.startedAt === incoming.startedAt) return existing;
  if (existing && !incoming?.startedAt) return existing;
  if (!incoming?.mode || !incoming.startedAt) return null;
  try { if (sessionStorage.getItem(STOPPED_KEY) === String(incoming.startedAt)) return null; } catch {}
  const ids = incoming.mode === "extra" ? extraSession(deck.store.cards) : dueSession(deck.store.cards, deck.today);
  if (ids.length === 0) return null;
  const queue = ids.map((id) => ({ id }));
  return {
    startedAt: incoming.startedAt,
    queue,
    index: 0,
    phase: phaseFor(ids[0], 0, deck.store.cards),
    tally: emptyTally(deck.streak, deck.todayCounted),
    countedAtStart: deck.todayCounted,
    plannedIds: ids,
    doneIds: [],
  };
}
