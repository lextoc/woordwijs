import { useEffect, useRef, useState, type RefObject } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRightIcon, CheckIcon, CloseIcon } from "../components/Icons";
import { Dialog, StorageBanner, WriteError } from "../components/ui";
import { blankExample, judgeFill, letterCount } from "../lib/text";
import type { Rating } from "../lib/model";
import { exerciseFor, extraSession, dueSession } from "../lib/session";
import { choiceOptions, wordById, type ChoiceOption } from "../lib/words";
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
};

const SESSION_KEY = "woordwijs.sessie";

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

export function Practice() {
  const deck = useDeck();
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = (location.state ?? null) as { mode?: "due" | "extra"; startedAt?: number } | null;
  const [stop, setStop] = useState(false);
  const setup = useRef<Saved | null | undefined>(undefined);
  if (setup.current === undefined) setup.current = createSession(incoming, deck);
  const saved = setup.current;
  const [queue, setQueue] = useState(saved?.queue ?? []);
  const [index, setIndex] = useState(saved?.index ?? 0);
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? { kind: "recall-front" });
  const tally = useRef<Tally>(saved?.tally ?? emptyTally(deck.streak, deck.todayCounted));
  const countedAtStart = useRef(saved?.countedAtStart ?? deck.todayCounted);
  const startedAt = saved?.startedAt ?? 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const meaningRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!saved) return;
    const snapshot: Saved = { startedAt, queue, index, phase, tally: tally.current, countedAtStart: countedAtStart.current };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
  }, [index, phase, queue, saved, startedAt]);

  useEffect(() => {
    document.title = "Oefenen · Woordwijs";
  }, []);

  useEffect(() => {
    if (phase.kind === "recall-back") meaningRef.current?.focus();
    else headingRef.current?.focus();
  }, [index, phase.kind]);

  useEffect(() => {
    if (phase.kind === "fill" && phase.result && phase.result !== "empty") nextRef.current?.focus();
  }, [phase]);

  if (!saved) return <Navigate to="/" replace />;

  const current = queue[index];
  const word = current ? wordById.get(current.id) : undefined;
  const card = current ? deck.store.cards[current.id] : undefined;
  if (!current || !word || !card) return <Navigate to="/" replace />;

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
      sessionStorage.removeItem(SESSION_KEY);
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

  function onKey(event: KeyboardEvent) {
    if (stop) return;
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (event.key === "Escape") {
      event.preventDefault();
      setStop(true);
      return;
    }
    if (phase.kind === "recall-front" && (event.key === " " || event.key === "Enter") && !typing) {
      event.preventDefault();
      setPhase({ kind: "recall-back" });
    }
    if (phase.kind === "recall-back" && ["1", "2", "3", "4"].includes(event.key) && !typing) {
      event.preventDefault();
      finish((["niet", "moeilijk", "goed", "makkelijk"] as Rating[])[Number(event.key) - 1]);
    }
    if (phase.kind === "choice" && phase.picked === null && ["1", "2", "3", "4"].includes(event.key) && !typing) {
      event.preventDefault();
      pickChoice(Number(event.key) - 1);
    }
    if (phase.kind === "choice" && phase.picked !== null && event.key === "Enter" && !typing) {
      event.preventDefault();
      const choice = phase.options[phase.picked];
      finish(choice.correct ? "goed" : "niet");
    }
    if (phase.kind === "fill" && phase.result && phase.result !== "empty" && event.key === "Enter" && !typing) {
      event.preventDefault();
      event.stopPropagation();
      const rating: Rating = phase.result === "fout" ? "niet" : phase.hint ? "moeilijk" : "goed";
      finish(rating);
    }
  }

  function pickChoice(optionIndex: number) {
    if (phase.kind !== "choice" || phase.picked !== null) return;
    setPhase({ ...phase, picked: optionIndex });
  }

  return (
    <div className="practice" onKeyDownCapture={(event) => onKey(event.nativeEvent)}>
      <StorageBanner />
      <header className="session-bar">
        <button type="button" onClick={() => setStop(true)} aria-label="Stoppen met oefenen">
          <CloseIcon />
          <span>Stoppen</span>
        </button>
        <span className="session-count">
          {index + 1} van {queue.length}
        </span>
      </header>
      <div
        className="ticks"
        role="progressbar"
        aria-valuemin={1}
        aria-valuenow={index + 1}
        aria-valuemax={queue.length}
        aria-label={`Voortgang van deze oefening, ${index + 1} van ${queue.length}`}
      >
        {queue.map((item, tick) => (
          <i key={`${item.id}-${tick}`} className={tick < index ? "is-done" : tick === index ? "is-current" : undefined} aria-hidden="true" />
        ))}
      </div>
      <div className={`card-area ${phase.kind === "recall-front" || phase.kind === "recall-back" ? "is-recall" : ""}`}>
        {phase.kind === "recall-front" || phase.kind === "recall-back" ? (
          <>
            {phase.kind === "recall-front" ? <p className="eyebrow">Weet je wat dit betekent?</p> : null}
            <h1 ref={headingRef} tabIndex={-1} className={phase.kind === "recall-back" ? "practice-word is-back" : "practice-word"}>
              {word.word}
            </h1>
            <p className="word-class">
              {phase.kind === "recall-back" && word.article ? `${word.article} · ` : ""}
              {word.posLabel}
            </p>
            {phase.kind === "recall-back" ? (
              <div ref={meaningRef} tabIndex={-1} className="meaning-block">
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
            <p className="eyebrow">Kies de betekenis</p>
            <h1 ref={headingRef} tabIndex={-1} className="practice-word is-choice">
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
                    className={`option${showCorrect ? " is-correct" : ""}${showWrong ? " is-wrong" : ""}`}
                    aria-disabled={locked}
                    onClick={() => pickChoice(optionIndex)}
                  >
                    {showCorrect ? <CheckIcon /> : null}
                    {showWrong ? <CloseIcon /> : null}
                    <span className="hotkey">{optionIndex + 1}</span>
                    <span>
                      {option.text}
                      {showCorrect ? <small>Juist antwoord</small> : null}
                      {showWrong ? <small>Niet juist</small> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {phase.picked !== null ? (
              <p className="feedback" role="status">
                {phase.options[phase.picked].correct ? "Juist." : `Niet juist. Het goede antwoord: ${word.senses[0]}.`}
              </p>
            ) : null}
          </>
        ) : null}
        {phase.kind === "fill" && word.example ? (
          <FillCard
            word={word.word}
            example={word.example}
            meaning={word.senses[0]}
            phase={phase}
            headingRef={headingRef}
            inputRef={inputRef}
            onChange={(value) => setPhase({ ...phase, value, result: phase.result === "empty" ? null : phase.result })}
            onHint={() => setPhase({ ...phase, hint: true })}
          />
        ) : null}
      </div>
      <div className="practice-actions">
        <WriteError />
        {phase.kind === "recall-front" ? (
          <button type="button" className="primary" onClick={() => setPhase({ kind: "recall-back" })}>
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
          <button type="button" className="primary split" onClick={() => finish(phase.options[phase.picked!].correct ? "goed" : "niet")}>
            <span>Volgende</span>
            <ArrowRightIcon />
          </button>
        ) : null}
        {phase.kind === "fill" && !phase.result ? (
          <>
            {phase.result === null ? null : null}
            <button
              type="button"
              className="primary"
              onClick={() => {
                const judgement = judgeFill(phase.value, word.word);
                if (judgement === "empty") {
                  setPhase({ ...phase, result: "empty" });
                  inputRef.current?.focus();
                  return;
                }
                setPhase({ ...phase, result: judgement });
              }}
            >
              Controleer
            </button>
            <button
              type="button"
              className="text-button center"
              onClick={() => setPhase({ ...phase, result: "fout" })}
            >
              Ik weet het niet
            </button>
          </>
        ) : null}
        {phase.kind === "fill" && phase.result === "empty" ? (
          <>
            <p className="error" role="alert">
              Vul een woord in.
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => {
                const judgement = judgeFill(phase.value, word.word);
                if (judgement === "empty") {
                  inputRef.current?.focus();
                  return;
                }
                setPhase({ ...phase, result: judgement });
              }}
            >
              Controleer
            </button>
            <button type="button" className="text-button center" onClick={() => setPhase({ ...phase, result: "fout" })}>
              Ik weet het niet
            </button>
          </>
        ) : null}
        {phase.kind === "fill" && phase.result && phase.result !== "empty" ? (
          <button
            ref={nextRef}
            type="button"
            className="primary split"
            onClick={() => finish(phase.result === "fout" ? "niet" : phase.hint ? "moeilijk" : "goed")}
          >
            <span>Volgende</span>
            <ArrowRightIcon />
          </button>
        ) : null}
      </div>
      {stop ? (
        <Dialog title="Stoppen met oefenen?" onClose={() => setStop(false)}>
          <p>
            {deck.storageOk
              ? "Je antwoorden tot nu toe zijn bewaard. De rest van de woorden blijft voor vandaag staan."
              : "Je antwoorden gaan verloren zodra je de pagina sluit."}
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => {
              sessionStorage.removeItem(SESSION_KEY);
              navigate("/");
            }}>
              Stoppen
            </button>
            <button type="button" className="primary" onClick={() => setStop(false)}>
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
      <span className="hotkey">{hotkey}</span>
      <strong>{label}</strong>
      <small>{hint}</small>
    </button>
  );
}

function FillCard({
  word,
  example,
  meaning,
  phase,
  headingRef,
  inputRef,
  onChange,
  onHint,
}: {
  word: string;
  example: string;
  meaning: string;
  phase: Extract<Phase, { kind: "fill" }>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onHint: () => void;
}) {
  const parts = blankExample(example, word);
  const checked = phase.result && phase.result !== "empty";
  const hint = `Hint: ${letterCount(word)} letters, begint met ${[...word][0]?.toLocaleLowerCase("nl") ?? ""}`;
  return (
    <>
      <p className="eyebrow">Vul het ontbrekende woord in</p>
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {word}
      </h1>
      <p className="fill-sentence">
        {parts?.before}
        {checked ? (
          <span className={phase.result === "fout" ? "blank is-wrong" : "blank is-filled"}>{word}</span>
        ) : (
          <span className="blank" aria-label="ontbrekend woord" />
        )}
        {parts?.after}
      </p>
      {!checked ? (
        <label className="field-label" htmlFor="ontbrekend">
          Welk woord ontbreekt?
          <input
            ref={inputRef}
            id="ontbrekend"
            value={phase.value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit?.();
                event.currentTarget.closest(".practice")?.querySelector<HTMLButtonElement>(".practice-actions .primary")?.click();
              }
            }}
            lang="nl"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
          />
        </label>
      ) : null}
      {!checked ? <p className="hint-line">Hoofdletters en accenten maken niet uit.</p> : null}
      {!checked && !phase.hint ? (
        <button type="button" className="text-button" onClick={onHint}>
          {hint}
        </button>
      ) : null}
      {phase.hint && !checked ? <p>{hint}</p> : null}
      {checked ? (
        <p className="feedback" role="status">
          {phase.result === "juist" ? "Juist." : null}
          {phase.result === "bijna" ? (
            <>
              Bijna goed. Het woord is <strong>{word}</strong>.
            </>
          ) : null}
          {phase.result === "fout" ? (
            <>
              Niet juist. Het woord is <strong>{word}</strong>.
            </>
          ) : null}
        </p>
      ) : null}
      {checked ? <p className="reading small-reading">{meaning}</p> : null}
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
  };
}
