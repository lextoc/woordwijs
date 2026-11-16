import { practiceProgress } from "../lib/practice-progress";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRightIcon, BookIcon, CheckIcon, FlameIcon, PlusIcon, SearchIcon } from "../components/Icons";
import { Attribution, WordDecor, Stats, StorageBanner, StorageNote, usePageTitle, WordLink } from "../components/ui";
import { dagen } from "../lib/text";
import { dueSession } from "../lib/session";
import { cardStatus } from "../lib/model";
import { useDeck } from "../state/DeckContext";
import { wordOfTheDay } from "../lib/words";
import { useState } from "react";

export function Home() {
  usePageTitle("Vandaag");
  const deck = useDeck();
  const navigate = useNavigate();
  const cards = Object.values(deck.store.cards);
  const firstRun = cards.length === 0 && !deck.store.hasHistory;
  const due = dueSession(deck.store.cards, deck.today);
  const resume = practiceProgress(deck.store.cards);
  const learned = cards.filter((card) => cardStatus(card) === "geleerd").length;
  const practicedToday = deck.store.dayLog?.date === deck.today && deck.store.dayLog.answeredIds.length > 0;
  const daily = wordOfTheDay(deck.today);
  const inDeck = deck.inDeck(daily.id);
  const [added, setAdded] = useState("");

  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    main.classList.toggle("is-home", !firstRun);
    return () => main.classList.remove("is-home");
  }, [firstRun]);

  function addTen() {
    const saved = deck.addStarter();
    if (saved) deck.showToast("10 woorden toegevoegd.");
  }

  function addDaily() {
    const saved = deck.addWord(daily.id);
    if (saved) setAdded(`${daily.word} staat nu in je woorden.`);
  }

  return (
    <div className={firstRun ? "home home-first" : "home"}>
      <StorageBanner />
      {resume ? <Link className="resume-card" to="/oefenen">
        <span><strong>Ga verder met je oefening</strong><small>Nog {resume.remaining} {resume.remaining === 1 ? "woord" : "woorden"} in deze ronde</small></span>
        <ArrowRightIcon />
      </Link> : null}
      {firstRun ? (
        <FirstRun onAdd={addTen} />
      ) : (
        <>
          <h1 className="sr-only">Vandaag</h1>
          <section className="word-panel" aria-labelledby="wotd-word">
            <p className="eyebrow">Woord van de dag</p>
            <h2 id="wotd-word" className={daily.word.length >= 12 ? "is-long" : undefined}>
              {daily.word}
            </h2>
            <p className="word-meta">
              {daily.article ? <span>{daily.article}</span> : null}
              {daily.article ? <span aria-hidden="true"> · </span> : null}
              <span>{daily.posLabel}</span>
            </p>
            {daily.senses[0] ? <p className="wotd-meaning">{daily.senses[0]}</p> : null}
            <div className="panel-actions">
              {inDeck ? (
                <p className="on-ink-marker">
                  <CheckIcon size={18} /> In je woorden
                </p>
              ) : (
                <button type="button" className="inverted" onClick={addDaily}>
                  <PlusIcon size={18} /> Toevoegen
                </button>
              )}
              <WordLink id={daily.id} className="text-link">
                Bekijk woord
              </WordLink>
            </div>
          </section>
          {resume ? null : due.length > 0 ? (
            <section className="practice-block">
              <p className="eyebrow">Oefenen</p>
              <h2>{due.length === 1 ? "1 woord voor vandaag" : `${due.length} woorden voor vandaag`}</h2>
              <p>{practiceLine(due.length, deck.streak, deck.todayCounted, deck.store.countedDays.length === 0)}</p>
              <button type="button" className="primary split" onClick={() => navigate("/oefenen", { state: { mode: "due", startedAt: Date.now() } })}>
                <span>Begin met oefenen</span>
                <ArrowRightIcon />
              </button>
            </section>
          ) : practicedToday ? (
            <section className="practice-block">
              <p className="eyebrow">Oefenen</p>
              <h2>Vandaag ben je klaar</h2>
              <p>Morgen staan er weer woorden voor je klaar.</p>
              {cards.length > 0 ? (
                <button type="button" className="secondary split" onClick={() => navigate("/oefenen", { state: { mode: "extra", startedAt: Date.now() } })}>
                  <span>Extra ronde</span>
                  <ArrowRightIcon />
                </button>
              ) : null}
            </section>
          ) : (
            <section className="practice-block">
              <p className="eyebrow">Oefenen</p>
              <h2>Niets te herhalen vandaag</h2>
              <p>
                {cards.length > 0
                  ? "Al je woorden komen later terug. Voeg een woord toe of oefen een extra ronde."
                  : "Voeg een woord toe om te oefenen."}
              </p>
              {deck.streak > 0 && !deck.todayCounted ? <p>Oefen vandaag om je reeks van {dagen(deck.streak)} te houden.</p> : null}
              <div className="button-stack">
                <Link className="primary split" to="/zoeken">
                  <span>Woord toevoegen</span>
                  <ArrowRightIcon />
                </Link>
                {cards.length > 0 ? (
                  <button type="button" className="secondary split" onClick={() => navigate("/oefenen", { state: { mode: "extra", startedAt: Date.now() } })}>
                    <span>Extra ronde</span>
                    <ArrowRightIcon />
                  </button>
                ) : null}
              </div>
            </section>
          )}
          <Stats
            items={[
              { label: "Reeks", value: dagen(deck.streak), icon: <FlameIcon size={20} /> },
              { label: "Geleerd", value: String(learned), icon: <CheckIcon size={20} /> },
              { label: "Aan de beurt", value: String(due.length), icon: <BookIcon size={20} /> },
            ]}
          />
          {deck.store.countedDays.length === 0 ? null : deck.streak === 0 ? (
            <p className="streak-note">Je reeks begint opnieuw. Oefen vandaag om een nieuwe te starten.</p>
          ) : null}
          <Attribution />
          <p className="sr-only" role="status">
            {added}
          </p>
        </>
      )}
    </div>
  );
}

function practiceLine(count: number, streak: number, todayCounted: boolean, noStreakYet: boolean): string {
  if (streak > 0 && !todayCounted) return `Oefen vandaag om je reeks van ${dagen(streak)} te houden.`;
  if (noStreakYet) return "Oefen vandaag om je eerste reeks te starten.";
  if (count >= 7) return "Ongeveer 3 minuten.";
  if (count >= 3) return "Ongeveer 2 minuten.";
  return "Ongeveer 1 minuut.";
}

function FirstRun({ onAdd }: { onAdd: () => void }) {
  return (
    <>
      <p className="eyebrow">Welkom</p>
      <h1 className="welcome-title">Leer woorden die je nog niet kent.</h1>
      <p className="lede">Zoek een woord op, voeg het toe en oefen elke dag een paar minuten. Moeilijke woorden komen vaker terug.</p>
      <div className="button-stack loose">
        <button type="button" className="primary split" onClick={onAdd}>
          <span>Voeg 10 woorden toe</span>
          <ArrowRightIcon />
        </button>
        <Link className="secondary split" to="/zoeken">
          <span>Zoek zelf een woord</span>
          <SearchIcon />
        </Link>
      </div>
      <StorageNote>
        Je voortgang blijft in deze browser. Wis je browsergegevens, dan verdwijnt ze ook. Op een ander toestel begin je opnieuw.
      </StorageNote>
      <WordDecor />
    </>
  );
}
