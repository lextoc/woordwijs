import { useRef } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRightIcon, ChevronIcon, FlameIcon } from "../components/Icons";
import { readState, Stats, StorageBanner, useBarHeight, useBrowserPath, usePageTitle, WordLink } from "../components/ui";
import { dagen } from "../lib/text";
import { wordById } from "../lib/words";
import { useDeck } from "../state/DeckContext";

export type SummaryState = {
  answers: number;
  goed: number;
  moeilijk: number;
  niet: number;
  learnedIds: string[];
  missIds: string[];
  streak: number;
  streakIncreased: boolean;
};

function isSummary(value: unknown): value is SummaryState {
  if (!value || typeof value !== "object") return false;
  const item = value as SummaryState;
  return typeof item.answers === "number" && Array.isArray(item.missIds) && typeof item.streak === "number";
}

export function Summary() {
  usePageTitle("Klaar");
  const location = useLocation();
  const navigate = useNavigate();
  const deck = useDeck();
  const barRef = useRef<HTMLDivElement>(null);
  useBarHeight(barRef, true);
  const browserPath = useBrowserPath();
  const nested = readState(location.state)?.backgroundLocation?.state;
  const summary = isSummary(location.state) ? location.state : isSummary(nested) ? nested : null;
  if (!summary) return <Navigate to="/" replace />;
  const learned = summary.learnedIds.length;
  const line =
    learned > 0
      ? learned === 1
        ? "1 woord is nu geleerd."
        : `${learned} woorden zijn nu geleerd.`
      : summary.niet + summary.moeilijk > 0
        ? "Moeilijke woorden komen vaker terug."
        : "Alles goed.";
  const openId = browserPath.startsWith("/woord/") ? decodeURIComponent(browserPath.slice("/woord/".length)) : "";
  return (
    <div className="summary-screen">
      <div className="summary-body">
        <StorageBanner />
        <p className="eyebrow">Klaar</p>
        <h1 className="welcome-title">{summary.answers === 1 ? "1 woord geoefend" : `${summary.answers} woorden geoefend`}</h1>
        <p className="lede">{line}</p>
        <Stats
          items={[
            { label: "Goed", value: String(summary.goed) },
            { label: "Moeilijk", value: String(summary.moeilijk) },
            { label: "Niet geweten", value: String(summary.niet) },
          ]}
        />
        <p className="streak-line">
          <FlameIcon size={24} />
          <strong>Reeks: {dagen(summary.streak)}</strong>
          {summary.streakIncreased ? <span className="count-badge">+1</span> : null}
        </p>
        {summary.missIds.length > 0 ? (
          <>
            <h2>Komt snel terug</h2>
            <ul className="deck-list">
              {summary.missIds.map((id) => {
                const word = wordById.get(id);
                if (!word) return null;
                return (
                  <li key={id}>
                    <WordLink id={id} current={openId === id} className={openId === id ? "is-selected" : undefined}>
                      <strong>{word.word}</strong>
                      <span>{word.posLabel}</span>
                      <ChevronIcon size={20} />
                    </WordLink>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>
      <div className="action-bar summary-bar" ref={barRef}>
        <button type="button" className="primary split" onClick={() => navigate("/")}>
          <span>Terug naar vandaag</span>
          <ArrowRightIcon />
        </button>
        {Object.keys(deck.store.cards).length > 0 ? (
          <button type="button" className="secondary split" onClick={() => navigate("/oefenen", { state: { mode: "extra", startedAt: Date.now() } })}>
            <span>Extra ronde</span>
            <ArrowRightIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
}
